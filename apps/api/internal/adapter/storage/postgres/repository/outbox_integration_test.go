//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOutboxRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewOutboxRepository(db)
	users := repository.NewUserRepository(db)

	// the outbox is shared: start clean so counts are exact
	_, err := db.Exec(ctx, "DELETE FROM email_outbox")
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM email_outbox") })

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "ob-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID) })

	past := time.Now().Add(-time.Minute)
	enqueue := func(template string, priority int16, sendAfter time.Time, dedupe *string) int64 {
		id, created, err := repo.Enqueue(ctx, domain.OutboxEmail{
			UserID: &userID, To: "ob@example.com", Template: template, Payload: json.RawMessage(`{"month":"2026-10"}`),
			Priority: priority, SendAfter: sendAfter, DedupeKey: dedupe,
		})
		require.NoError(t, err)
		require.True(t, created)
		return id
	}

	bulk := enqueue(domain.TemplateMonthlySummary, domain.MailPriorityBulk, past, nil)
	tx := enqueue(domain.TemplateVerifyEmail, domain.MailPriorityTransactional, past, nil)
	later := enqueue(domain.TemplateConnectionDown, domain.MailPriorityNotification, time.Now().Add(time.Hour), nil)

	// dedupe key
	key := "monthly_summary:" + userID + ":2026-10"
	enqueue(domain.TemplateMonthlySummary, domain.MailPriorityBulk, time.Now().Add(time.Hour), &key)
	id, created, err := repo.Enqueue(ctx, domain.OutboxEmail{UserID: &userID, To: "ob@example.com",
		Template: domain.TemplateMonthlySummary, Payload: json.RawMessage(`{}`), Priority: 5, SendAfter: past, DedupeKey: &key})
	require.NoError(t, err)
	assert.False(t, created)
	assert.Zero(t, id)

	// priority window: only transactional
	claimed, err := repo.Claim(ctx, 1, 1, 10, 10*time.Minute)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	assert.Equal(t, tx, claimed[0].ID)
	assert.Equal(t, domain.OutboxSending, claimed[0].Status)
	assert.Equal(t, 1, claimed[0].Attempts)
	assert.Equal(t, domain.EmailStatusOK, claimed[0].RecipientStatus)
	assert.JSONEq(t, `{"month":"2026-10"}`, string(claimed[0].Payload))

	// the rest: only the due bulk email (later is not due)
	claimed, err = repo.Claim(ctx, 2, 32767, 10, 10*time.Minute)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	assert.Equal(t, bulk, claimed[0].ID)

	// nothing else is ready; the claimed ones are locked (not stale)
	claimed, err = repo.Claim(ctx, 1, 32767, 10, 10*time.Minute)
	require.NoError(t, err)
	assert.Empty(t, claimed)

	// quota counts sent + sending
	since := time.Now().Add(-time.Hour)
	count, err := repo.CountSentSince(ctx, since)
	require.NoError(t, err)
	assert.Equal(t, 2, count)

	require.NoError(t, repo.MarkSent(ctx, tx, "re_"+userID[:8]))
	require.NoError(t, repo.MarkRetry(ctx, bulk, "HTTP 503", past))
	count, err = repo.CountSentSince(ctx, since)
	require.NoError(t, err)
	assert.Equal(t, 1, count)

	// the retried one is claimed again with attempts 2
	claimed, err = repo.Claim(ctx, 2, 32767, 10, 10*time.Minute)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	assert.Equal(t, 2, claimed[0].Attempts)
	require.NoError(t, repo.MarkFailed(ctx, bulk, "gave up"))
	require.NoError(t, repo.MarkSuppressed(ctx, later, "recipient bounced"))

	// stale locks: a sending email without secret is claimed again; one with a secret is failed
	secret, err := repo.InsertSending(ctx, domain.OutboxEmail{UserID: &userID, To: "ob@example.com",
		Template: domain.TemplatePasswordCode, Payload: json.RawMessage(`{}`), Priority: 1, HasSecret: true})
	require.NoError(t, err)
	plain, err := repo.InsertSending(ctx, domain.OutboxEmail{UserID: &userID, To: "ob@example.com",
		Template: domain.TemplateConnectionDown, Payload: json.RawMessage(`{}`), Priority: 3})
	require.NoError(t, err)
	_, err = db.Exec(ctx, "UPDATE email_outbox SET locked_at = now() - interval '1 hour' WHERE id IN ($1, $2)", secret, plain)
	require.NoError(t, err)

	failed, err := repo.FailStaleSecrets(ctx, 10*time.Minute)
	require.NoError(t, err)
	assert.Equal(t, int64(1), failed)

	claimed, err = repo.Claim(ctx, 1, 32767, 10, 10*time.Minute)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	assert.Equal(t, plain, claimed[0].ID)

	// recipient status
	_, err = db.Exec(ctx, "UPDATE users SET email_status = 'bounced' WHERE id = $1", userID)
	require.NoError(t, err)
	status, err := repo.RecipientStatus(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, domain.EmailStatusBounced, status)
	status, err = repo.RecipientStatus(ctx, "does-not-exist")
	require.NoError(t, err)
	assert.Equal(t, domain.EmailStatusOK, status)
}

func TestOutboxRepository_ClaimSkipsLocked(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewOutboxRepository(db)

	_, err := db.Exec(ctx, "DELETE FROM email_outbox")
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM email_outbox") })

	for i := 0; i < 20; i++ {
		_, _, err := repo.Enqueue(ctx, domain.OutboxEmail{To: "x@example.com", Template: domain.TemplateVerifyEmail,
			Payload: json.RawMessage(`{}`), Priority: 1, SendAfter: time.Now().Add(-time.Second)})
		require.NoError(t, err)
	}

	// two API instances claiming at once never get the same email
	var mu sync.Mutex
	seen := map[int64]int{}
	var wg sync.WaitGroup
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claimed, err := repo.Claim(ctx, 1, 1, 7, 10*time.Minute)
			assert.NoError(t, err)
			mu.Lock()
			defer mu.Unlock()
			for _, e := range claimed {
				seen[e.ID]++
			}
		}()
	}
	wg.Wait()

	assert.Len(t, seen, 20)
	for id, n := range seen {
		assert.Equal(t, 1, n, "email %d claimed twice", id)
	}
}

func TestOutboxRepository_SetRecipientStatus(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewOutboxRepository(db)
	users := repository.NewUserRepository(db)

	newUser := func() (string, string) {
		id := uuid.NewString()
		email := "rs-" + id[:8] + "@example.com"
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: email, Role: domain.RoleUser}))
		t.Cleanup(func() {
			_, _ = db.Exec(ctx, "DELETE FROM email_outbox WHERE user_id = $1", id)
			_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
		})
		return id, email
	}
	a, _ := newUser()
	b, bEmail := newUser()

	id, _, err := repo.Enqueue(ctx, domain.OutboxEmail{UserID: &a, To: "a@example.com", Template: domain.TemplateVerifyEmail,
		Payload: json.RawMessage(`{}`), Priority: 1, SendAfter: time.Now()})
	require.NoError(t, err)
	provider := "re_" + a[:8]
	require.NoError(t, repo.MarkSent(ctx, id, provider))

	status := func(userID string) string {
		s, err := repo.RecipientStatus(ctx, userID)
		require.NoError(t, err)
		return s
	}

	// by provider id
	n, err := repo.SetRecipientStatus(ctx, provider, nil, domain.EmailStatusBounced)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	assert.Equal(t, domain.EmailStatusBounced, status(a))

	// complaint wins and is never downgraded
	_, err = repo.SetRecipientStatus(ctx, provider, nil, domain.EmailStatusComplained)
	require.NoError(t, err)
	n, err = repo.SetRecipientStatus(ctx, provider, nil, domain.EmailStatusBounced)
	require.NoError(t, err)
	assert.Zero(t, n)
	assert.Equal(t, domain.EmailStatusComplained, status(a))

	// unknown provider id: by address (case insensitive)
	n, err = repo.SetRecipientStatus(ctx, "re_unknown", []string{"  " + strings.ToUpper(bEmail)}, domain.EmailStatusBounced)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	assert.Equal(t, domain.EmailStatusBounced, status(b))
}
