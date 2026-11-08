//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewNotificationRepository(db)
	outbox := repository.NewOutboxRepository(db)

	newUser := func() string {
		id := uuid.NewString()
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: "np-" + id[:8] + "@example.com", Role: domain.RoleUser}))
		t.Cleanup(func() {
			_, _ = db.Exec(ctx, "DELETE FROM email_outbox WHERE user_id = $1", id)
			_, _ = db.Exec(ctx, "DELETE FROM notification_prefs WHERE user_id = $1", id)
			_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
		})
		return id
	}
	a, b, c, d := newUser(), newUser(), newUser(), newUser()

	prefs, err := repo.GetPrefs(ctx, a)
	require.NoError(t, err)
	assert.Equal(t, domain.DefaultNotificationPrefs(), prefs)

	require.NoError(t, repo.SavePrefs(ctx, a, domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: false}))
	prefs, _ = repo.GetPrefs(ctx, a)
	assert.Equal(t, domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: false}, prefs)

	// SetPref on a user without row keeps the other defaults
	require.NoError(t, repo.SetPref(ctx, b, domain.UnsubMonthlySummary, true))
	prefs, _ = repo.GetPrefs(ctx, b)
	assert.Equal(t, domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: true}, prefs)
	require.NoError(t, repo.SetPref(ctx, b, domain.UnsubConnectionAlerts, false))
	prefs, _ = repo.GetPrefs(ctx, b)
	assert.Equal(t, domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: false}, prefs)

	assert.ErrorIs(t, repo.SetPref(ctx, "does-not-exist", domain.UnsubMonthlySummary, false), domain.ErrUserNotFoundException)
	assert.Error(t, repo.SetPref(ctx, a, "unknown", false))

	// recipients: a and b (on); c bounced; d off; b already queued for the month
	require.NoError(t, repo.SetPref(ctx, c, domain.UnsubMonthlySummary, true))
	_, err = db.Exec(ctx, "UPDATE users SET email_status = 'bounced' WHERE id = $1", c)
	require.NoError(t, err)
	_ = d
	key := "monthly_summary:" + b + ":2026-10"
	_, _, err = outbox.Enqueue(ctx, domain.OutboxEmail{UserID: &b, To: "x@example.com", Template: domain.TemplateMonthlySummary,
		Payload: json.RawMessage(`{}`), Priority: 5, SendAfter: time.Now(), DedupeKey: &key})
	require.NoError(t, err)

	recipients, err := repo.MonthlySummaryRecipients(ctx, "2026-10")
	require.NoError(t, err)
	var ids []string
	for _, r := range recipients {
		ids = append(ids, r.UserID)
	}
	assert.Contains(t, ids, a)
	assert.NotContains(t, ids, b, "already queued")
	assert.NotContains(t, ids, c, "bounced")
	assert.NotContains(t, ids, d, "off by default")

	recipients, err = repo.MonthlySummaryRecipients(ctx, "2026-11")
	require.NoError(t, err)
	ids = nil
	for _, r := range recipients {
		ids = append(ids, r.UserID)
	}
	assert.Contains(t, ids, b, "another month")

	currency, err := repo.BaseCurrency(ctx, a)
	require.NoError(t, err)
	assert.Equal(t, "COP", currency)
}
