package service

import (
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

// fakeOutbox is an in-memory email_outbox with the same claim rules as the SQL
type fakeOutbox struct {
	mu        sync.Mutex
	rows      map[int64]*domain.OutboxEmail
	lockedAt  map[int64]time.Time
	seq       int64
	statuses  map[string]string // users.email_status by user id
	sentToday int               // emails sent before the test (quota)
	now       func() time.Time
}

func newFakeOutbox(now func() time.Time) *fakeOutbox {
	return &fakeOutbox{
		rows:     map[int64]*domain.OutboxEmail{},
		lockedAt: map[int64]time.Time{},
		statuses: map[string]string{},
		now:      now,
	}
}

func (f *fakeOutbox) Enqueue(_ context.Context, e domain.OutboxEmail) (int64, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if e.DedupeKey != nil {
		for _, row := range f.rows {
			if row.DedupeKey != nil && *row.DedupeKey == *e.DedupeKey {
				return 0, false, nil
			}
		}
	}
	f.seq++
	e.ID = f.seq
	e.Status = domain.OutboxPending
	f.rows[e.ID] = &e
	return e.ID, true, nil
}

func (f *fakeOutbox) InsertSending(_ context.Context, e domain.OutboxEmail) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	e.ID = f.seq
	e.Status = domain.OutboxSending
	e.Attempts = 1
	f.rows[e.ID] = &e
	f.lockedAt[e.ID] = f.now()
	return e.ID, nil
}

func (f *fakeOutbox) Claim(_ context.Context, minP, maxP int16, limit int, stale time.Duration) ([]domain.OutboxEmail, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var ready []*domain.OutboxEmail
	for _, row := range f.rows {
		if row.Priority < minP || row.Priority > maxP {
			continue
		}
		due := row.Status == domain.OutboxPending && !row.SendAfter.After(f.now())
		stuck := row.Status == domain.OutboxSending && !row.HasSecret && f.lockedAt[row.ID].Before(f.now().Add(-stale))
		if due || stuck {
			ready = append(ready, row)
		}
	}
	sort.Slice(ready, func(i, j int) bool {
		if ready[i].Priority != ready[j].Priority {
			return ready[i].Priority < ready[j].Priority
		}
		return ready[i].ID < ready[j].ID
	})
	if len(ready) > limit {
		ready = ready[:limit]
	}
	out := make([]domain.OutboxEmail, 0, len(ready))
	for _, row := range ready {
		row.Status = domain.OutboxSending
		row.Attempts++
		f.lockedAt[row.ID] = f.now()
		copy := *row
		copy.RecipientStatus = domain.EmailStatusOK
		if row.UserID != nil && f.statuses[*row.UserID] != "" {
			copy.RecipientStatus = f.statuses[*row.UserID]
		}
		out = append(out, copy)
	}
	return out, nil
}

func (f *fakeOutbox) FailStaleSecrets(_ context.Context, stale time.Duration) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	for _, row := range f.rows {
		if row.Status == domain.OutboxSending && row.HasSecret && f.lockedAt[row.ID].Before(f.now().Add(-stale)) {
			row.Status = domain.OutboxFailed
			n++
		}
	}
	return n, nil
}

func (f *fakeOutbox) set(id int64, fn func(*domain.OutboxEmail)) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	row, ok := f.rows[id]
	if !ok {
		return domain.ErrDataNotFound
	}
	fn(row)
	return nil
}

func (f *fakeOutbox) MarkSent(_ context.Context, id int64, providerID string) error {
	return f.set(id, func(r *domain.OutboxEmail) {
		now := f.now()
		r.Status, r.ProviderID, r.SentAt = domain.OutboxSent, &providerID, &now
	})
}

func (f *fakeOutbox) MarkRetry(_ context.Context, id int64, lastError string, sendAfter time.Time) error {
	return f.set(id, func(r *domain.OutboxEmail) {
		r.Status, r.LastError, r.SendAfter = domain.OutboxPending, &lastError, sendAfter
	})
}

func (f *fakeOutbox) MarkFailed(_ context.Context, id int64, lastError string) error {
	return f.set(id, func(r *domain.OutboxEmail) { r.Status, r.LastError = domain.OutboxFailed, &lastError })
}

func (f *fakeOutbox) MarkSuppressed(_ context.Context, id int64, reason string) error {
	return f.set(id, func(r *domain.OutboxEmail) { r.Status, r.LastError = domain.OutboxSuppressed, &reason })
}

func (f *fakeOutbox) CountSentSince(_ context.Context, since time.Time) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := f.sentToday
	for _, row := range f.rows {
		if row.Status == domain.OutboxSending || (row.Status == domain.OutboxSent && !row.SentAt.Before(since)) {
			n++
		}
	}
	return n, nil
}

func (f *fakeOutbox) RecipientStatus(_ context.Context, userID string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if status := f.statuses[userID]; status != "" {
		return status, nil
	}
	return domain.EmailStatusOK, nil
}

func (f *fakeOutbox) SetRecipientStatus(_ context.Context, providerID string, to []string, status string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var changed int64
	for _, row := range f.rows {
		if row.UserID == nil || row.ProviderID == nil || *row.ProviderID != providerID {
			continue
		}
		if current := f.statuses[*row.UserID]; current == status || (current == domain.EmailStatusComplained && status == domain.EmailStatusBounced) {
			continue
		}
		f.statuses[*row.UserID] = status
		changed++
	}
	return changed, nil
}

func (f *fakeOutbox) byStatus(status string) []domain.OutboxEmail {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []domain.OutboxEmail
	for _, row := range f.rows {
		if row.Status == status {
			out = append(out, *row)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

type fakeMailer struct {
	mu   sync.Mutex
	sent []domain.EmailMessage
	errs []error // returned in order, then nil
}

func (m *fakeMailer) Send(_ context.Context, msg domain.EmailMessage) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.errs) > 0 {
		err := m.errs[0]
		m.errs = m.errs[1:]
		if err != nil {
			return "", err
		}
	}
	m.sent = append(m.sent, msg)
	return fmt.Sprintf("re_%d", len(m.sent)), nil
}

func (m *fakeMailer) messages() []domain.EmailMessage {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]domain.EmailMessage(nil), m.sent...)
}

// fakeRenderer puts the template name in the subject and the data as JSON in the text
type fakeRenderer struct{ fail bool }

func (r fakeRenderer) Render(template string, data map[string]any) (*domain.RenderedEmail, error) {
	if r.fail {
		return nil, errors.New("broken template")
	}
	raw, _ := json.Marshal(data)
	return &domain.RenderedEmail{Subject: template, HTML: "<p>" + template + "</p>", Text: string(raw)}, nil
}

type fakeLinker struct{}

func (fakeLinker) UnsubscribeURL(userID, _ string) string {
	return "https://api.test/mail/unsubscribe?t=" + userID
}

type mailFixture struct {
	clock  time.Time
	repo   *fakeOutbox
	mailer *fakeMailer
	svc    *MailOutboxService
}

func newMailFixture(t *testing.T, settings MailSettings) *mailFixture {
	t.Helper()
	f := &mailFixture{clock: time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC), mailer: &fakeMailer{}}
	now := func() time.Time { return f.clock }
	f.repo = newFakeOutbox(now)
	if settings.DailyQuota == 0 {
		settings.DailyQuota = 100
	}
	settings.From = "Topi <hola@mail.topi.test>"
	settings.AppBaseURL = "https://app.test"
	f.svc = NewMailService(f.repo, f.mailer, fakeRenderer{}, settings)
	f.svc.now = now
	return f
}


func (f *mailFixture) enqueue(t *testing.T, template string, priority int16, to string) int64 {
	t.Helper()
	id, err := f.svc.Enqueue(context.Background(), domain.OutboxEmail{
		UserID: strPtr("u-" + to), To: to, Template: template, Priority: priority,
	})
	require.NoError(t, err)
	return id
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

func TestMail_ProcessSendsByPriority(t *testing.T) {
	f := newMailFixture(t, MailSettings{BatchSize: 10})
	f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, "bulk@example.com")
	f.enqueue(t, domain.TemplateConnectionDown, domain.MailPriorityNotification, "alert@example.com")
	f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "Tx@Example.com ")

	n, err := f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 3, n)

	sent := f.mailer.messages()
	require.Len(t, sent, 3)
	assert.Equal(t, "tx@example.com", sent[0].To, "transactional first, normalized")
	assert.Equal(t, "alert@example.com", sent[1].To)
	assert.Equal(t, "bulk@example.com", sent[2].To)
	assert.Equal(t, "Topi <hola@mail.topi.test>", sent[0].From)
	assert.Equal(t, domain.TemplateVerifyEmail, sent[0].Tags["template"])
	assert.Len(t, f.repo.byStatus(domain.OutboxSent), 3)
}

func TestMail_DailyQuotaReservesRoomForTransactional(t *testing.T) {
	// quota 10: bulk can use 8; 7 already sent today -> 1 bulk; transactional up to 3
	f := newMailFixture(t, MailSettings{DailyQuota: 10, BatchSize: 20})
	f.repo.sentToday = 7
	for i := 0; i < 5; i++ {
		f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, fmt.Sprintf("bulk%d@example.com", i))
	}
	f.enqueue(t, domain.TemplatePasswordCode, domain.MailPriorityTransactional, "tx@example.com")

	n, err := f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 2, n, "1 transactional + 1 bulk")
	assert.Len(t, f.repo.byStatus(domain.OutboxPending), 4, "the rest waits for tomorrow")

	// the quota is full for bulk: only transactional goes
	f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "tx2@example.com")
	n, err = f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, n)

	// next day (Bogotá) the counter resets
	f.repo.sentToday = 0
	f.clock = f.clock.Add(24 * time.Hour)
	n, err = f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 4, n)
}

func TestMail_DayStartIsBogota(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	// 03:00 UTC on the 8th is 22:00 on the 7th in Bogotá
	f.clock = time.Date(2026, 11, 8, 3, 0, 0, 0, time.UTC)
	assert.Equal(t, time.Date(2026, 11, 7, 5, 0, 0, 0, time.UTC), f.svc.dayStart().UTC())
}

func TestMail_RetryWithBackoffThenFail(t *testing.T) {
	f := newMailFixture(t, MailSettings{MaxAttempts: 3})
	transient := errors.New("resend: HTTP 503")
	f.mailer.errs = []error{transient, transient, transient}
	id := f.enqueue(t, domain.TemplateConnectionDown, domain.MailPriorityNotification, "a@example.com")
	ctx := context.Background()

	_, err := f.svc.ProcessOnce(ctx)
	require.NoError(t, err)
	row := f.repo.rows[id]
	assert.Equal(t, domain.OutboxPending, row.Status)
	assert.Equal(t, f.clock.Add(time.Minute), row.SendAfter, "first retry in 1 minute")

	// not due yet
	n, _ := f.svc.ProcessOnce(ctx)
	assert.Equal(t, 0, n)

	f.clock = f.clock.Add(time.Minute)
	_, _ = f.svc.ProcessOnce(ctx)
	assert.Equal(t, f.clock.Add(5*time.Minute), f.repo.rows[id].SendAfter, "second retry in 5 minutes")

	f.clock = f.clock.Add(5 * time.Minute)
	_, _ = f.svc.ProcessOnce(ctx)
	assert.Equal(t, domain.OutboxFailed, f.repo.rows[id].Status, "failed after MaxAttempts")
	assert.Equal(t, 3, f.repo.rows[id].Attempts)
	assert.Empty(t, f.mailer.messages())
}

func TestMail_RejectedIsNotRetried(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.mailer.errs = []error{fmt.Errorf("%w: 422 invalid to", domain.ErrMailRejected)}
	id := f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "bad@example.com")

	_, err := f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)
	assert.Equal(t, domain.OutboxFailed, f.repo.rows[id].Status)
}

func TestMail_RenderErrorFails(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.svc.renderer = fakeRenderer{fail: true}
	id := f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "a@example.com")

	_, _ = f.svc.ProcessOnce(context.Background())
	assert.Equal(t, domain.OutboxFailed, f.repo.rows[id].Status)
	assert.Contains(t, *f.repo.rows[id].LastError, "render")
}

func TestMail_SuppressedRecipients(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.repo.statuses["u-bounced@example.com"] = domain.EmailStatusBounced
	f.repo.statuses["u-complained@example.com"] = domain.EmailStatusComplained
	summary := f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, "bounced@example.com")
	alert := f.enqueue(t, domain.TemplateConnectionDown, domain.MailPriorityNotification, "complained@example.com")
	code := f.enqueue(t, domain.TemplatePasswordCode, domain.MailPriorityTransactional, "bounced@example.com")

	_, err := f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)

	assert.Equal(t, domain.OutboxSuppressed, f.repo.rows[summary].Status)
	assert.Equal(t, domain.OutboxSuppressed, f.repo.rows[alert].Status)
	assert.Equal(t, domain.OutboxSent, f.repo.rows[code].Status, "the password code ignores the suppression")
}

func TestMail_OnlyTo(t *testing.T) {
	f := newMailFixture(t, MailSettings{OnlyTo: []string{"Equipo@Example.com"}})
	allowed := f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "equipo@example.com")
	blocked := f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "usuario@example.com")

	_, _ = f.svc.ProcessOnce(context.Background())

	assert.Equal(t, domain.OutboxSent, f.repo.rows[allowed].Status)
	assert.Equal(t, domain.OutboxSuppressed, f.repo.rows[blocked].Status)
	assert.Len(t, f.mailer.messages(), 1)
}

func TestMail_DedupeKey(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	key := "monthly_summary:u1:2026-10"
	first, err := f.svc.Enqueue(context.Background(), domain.OutboxEmail{To: "a@example.com", Template: domain.TemplateMonthlySummary, DedupeKey: &key})
	require.NoError(t, err)
	second, err := f.svc.Enqueue(context.Background(), domain.OutboxEmail{To: "a@example.com", Template: domain.TemplateMonthlySummary, DedupeKey: &key})
	require.NoError(t, err)

	assert.NotZero(t, first)
	assert.Zero(t, second)
	assert.Len(t, f.repo.rows, 1)
}

func TestMail_UnsubscribeHeadersOnlyOnNonTransactional(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.svc.SetUnsubscribeLinker(fakeLinker{})
	f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "tx@example.com")
	f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, "bulk@example.com")

	_, _ = f.svc.ProcessOnce(context.Background())
	sent := f.mailer.messages()
	require.Len(t, sent, 2)

	assert.Empty(t, sent[0].Headers["List-Unsubscribe"])
	assert.Equal(t, "<https://api.test/mail/unsubscribe?t=u-bulk@example.com>", sent[1].Headers["List-Unsubscribe"])
	assert.Equal(t, "List-Unsubscribe=One-Click", sent[1].Headers["List-Unsubscribe-Post"])
	assert.Contains(t, sent[1].Text, "unsubscribe_url")
}

func TestMail_SendSecretKeepsTheSecretOutOfTheOutbox(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	payload := json.RawMessage(`{"minutes":10}`)

	err := f.svc.SendSecret(context.Background(), domain.OutboxEmail{
		UserID: strPtr("u1"), To: "a@example.com", Template: domain.TemplatePasswordCode, Payload: payload,
	}, map[string]any{"code": "123456"})
	require.NoError(t, err)
	f.svc.Wait()

	sent := f.mailer.messages()
	require.Len(t, sent, 1)
	assert.Contains(t, sent[0].Text, "123456", "the email has the code")

	rows := f.repo.byStatus(domain.OutboxSent)
	require.Len(t, rows, 1)
	assert.True(t, rows[0].HasSecret)
	assert.Equal(t, domain.MailPriorityTransactional, rows[0].Priority)
	assert.NotContains(t, string(rows[0].Payload), "123456", "the outbox never stores the code")
}

func TestMail_SendSecretIsNotRetried(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.mailer.errs = []error{errors.New("resend: HTTP 503")}

	require.NoError(t, f.svc.SendSecret(context.Background(), domain.OutboxEmail{
		To: "a@example.com", Template: domain.TemplatePasswordCode,
	}, map[string]any{"code": "123456"}))
	f.svc.Wait()

	assert.Len(t, f.repo.byStatus(domain.OutboxFailed), 1, "a lost code is requested again, never rebuilt")
}

func TestMail_SendSecretRespectsQuota(t *testing.T) {
	f := newMailFixture(t, MailSettings{DailyQuota: 5})
	f.repo.sentToday = 5

	require.NoError(t, f.svc.SendSecret(context.Background(), domain.OutboxEmail{
		To: "a@example.com", Template: domain.TemplatePasswordCode,
	}, map[string]any{"code": "123456"}))
	f.svc.Wait()

	assert.Empty(t, f.mailer.messages())
	assert.Len(t, f.repo.byStatus(domain.OutboxFailed), 1)
}

func TestMail_StaleSecretsAreFailedAndStaleOthersRetried(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	secretID, _ := f.repo.InsertSending(context.Background(), domain.OutboxEmail{
		To: "a@example.com", Template: domain.TemplatePasswordCode, Priority: 1, HasSecret: true,
	})
	otherID := f.enqueue(t, domain.TemplateConnectionDown, domain.MailPriorityNotification, "b@example.com")
	f.repo.rows[otherID].Status = domain.OutboxSending
	f.repo.lockedAt[otherID] = f.clock

	f.clock = f.clock.Add(staleLock + time.Minute)
	_, err := f.svc.ProcessOnce(context.Background())
	require.NoError(t, err)

	assert.Equal(t, domain.OutboxFailed, f.repo.rows[secretID].Status)
	assert.Equal(t, domain.OutboxSent, f.repo.rows[otherID].Status)
}

type fakeEnricher struct {
	err error
}

func (e fakeEnricher) Enrich(_ context.Context, _ domain.OutboxEmail, data map[string]any) error {
	if e.err != nil {
		return e.err
	}
	data["income"] = "$1.000"
	return nil
}

func TestMail_Enricher(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.svc.SetEnricher(domain.TemplateMonthlySummary, fakeEnricher{})
	id := f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, "a@example.com")

	_, _ = f.svc.ProcessOnce(context.Background())

	assert.Equal(t, domain.OutboxSent, f.repo.rows[id].Status)
	assert.Contains(t, f.mailer.messages()[0].Text, "$1.000", "send-time data reaches the template")
	assert.NotContains(t, string(f.repo.rows[id].Payload), "1.000", "and never the outbox")
}

func TestMail_EnricherCancelAndRetry(t *testing.T) {
	f := newMailFixture(t, MailSettings{})
	f.svc.SetEnricher(domain.TemplateMonthlySummary, fakeEnricher{err: domain.ErrMailCancelled})
	cancelled := f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, "a@example.com")
	_, _ = f.svc.ProcessOnce(context.Background())
	assert.Equal(t, domain.OutboxSuppressed, f.repo.rows[cancelled].Status)

	f.svc.SetEnricher(domain.TemplateMonthlySummary, fakeEnricher{err: errors.New("db timeout")})
	retried := f.enqueue(t, domain.TemplateMonthlySummary, domain.MailPriorityBulk, "b@example.com")
	_, _ = f.svc.ProcessOnce(context.Background())
	assert.Equal(t, domain.OutboxPending, f.repo.rows[retried].Status)
	assert.Empty(t, f.mailer.messages())
}

func TestMail_HandleEvent(t *testing.T) {
	ctx := context.Background()
	f := newMailFixture(t, MailSettings{})
	f.enqueue(t, domain.TemplateVerifyEmail, domain.MailPriorityTransactional, "a@example.com")
	_, _ = f.svc.ProcessOnce(ctx)
	providerID := *f.repo.byStatus(domain.OutboxSent)[0].ProviderID

	// transient bounces and other events change nothing
	require.NoError(t, f.svc.HandleEvent(ctx, domain.MailEvent{Type: domain.MailEventBounced, ProviderID: providerID, BounceType: "Transient"}))
	require.NoError(t, f.svc.HandleEvent(ctx, domain.MailEvent{Type: "email.delivered", ProviderID: providerID}))
	assert.Empty(t, f.repo.statuses["u-a@example.com"])

	require.NoError(t, f.svc.HandleEvent(ctx, domain.MailEvent{Type: domain.MailEventBounced, ProviderID: providerID, BounceType: "Permanent"}))
	assert.Equal(t, domain.EmailStatusBounced, f.repo.statuses["u-a@example.com"])

	require.NoError(t, f.svc.HandleEvent(ctx, domain.MailEvent{Type: domain.MailEventComplained, ProviderID: providerID}))
	assert.Equal(t, domain.EmailStatusComplained, f.repo.statuses["u-a@example.com"])

	// a later bounce does not downgrade the complaint
	require.NoError(t, f.svc.HandleEvent(ctx, domain.MailEvent{Type: domain.MailEventBounced, ProviderID: providerID}))
	assert.Equal(t, domain.EmailStatusComplained, f.repo.statuses["u-a@example.com"])

	// and the next non transactional email is suppressed
	id := f.enqueue(t, domain.TemplateConnectionDown, domain.MailPriorityNotification, "a@example.com")
	_, _ = f.svc.ProcessOnce(ctx)
	assert.Equal(t, domain.OutboxSuppressed, f.repo.rows[id].Status)
}
