package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newReadingService(t *testing.T) (*ReadingAppService, *mock.MockReadingRepository, *fakeMailService, *recordedEvents) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockReadingRepository(ctrl)
	mail := &fakeMailService{}
	events := &recordedEvents{}
	svc := NewReadingService(repo, mail, events)
	svc.now = func() time.Time { return time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC) }
	return svc, repo, mail, events
}

func TestReading_Status(t *testing.T) {
	svc, repo, _, _ := newReadingService(t)
	now := svc.now()
	repo.EXPECT().ConnectionStatuses(gomock.Any(), "u1").Return([]domain.ConnectionStatus{
		{ID: 1, Active: true, LinkedAccounts: 1, ConnectedAt: now.Add(-3 * time.Hour)},
		{ID: 2, Active: true, LinkedAccounts: 1, ConnectedAt: now.Add(-50 * time.Hour)},
	}, nil)

	status, err := svc.Status(context.Background(), "u1")
	require.NoError(t, err)
	assert.Equal(t, domain.ReadingFirst, status.Connections[0].Reading)
	assert.Equal(t, domain.ReadingNoTransaction, status.Connections[1].Reading)
	assert.NotEmpty(t, status.SupportedBanks)
}

func TestReading_OnboardingRecordsDoneSteps(t *testing.T) {
	svc, repo, _, _ := newReadingService(t)
	repo.EXPECT().OnboardingFacts(gomock.Any(), "u1").Return(domain.OnboardingFacts{HasConnection: true}, nil)
	repo.EXPECT().RecordOnboardingSteps(gomock.Any(), "u1", []string{domain.StepConnectEmail}).Return(nil, errors.New("db down"))

	status, err := svc.Onboarding(context.Background(), "u1")
	require.NoError(t, err, "recording the event never fails the request")
	assert.False(t, status.Complete)

	// nothing done: nothing to record
	svc, repo, _, _ = newReadingService(t)
	repo.EXPECT().OnboardingFacts(gomock.Any(), "u1").Return(domain.OnboardingFacts{}, nil)
	_, err = svc.Onboarding(context.Background(), "u1")
	require.NoError(t, err)
}

// plan/30: the first read decides the notice right away, without waiting 48 h
func TestReading_StatusSilentBanksRightAway(t *testing.T) {
	svc, repo := newReadingServiceRepo(t)
	now := svc.now()
	repo.EXPECT().ConnectionStatuses(gomock.Any(), "u1").Return([]domain.ConnectionStatus{
		{ID: 1, Active: true, LinkedAccounts: 1, ConnectedAt: now.Add(-10 * time.Minute),
			Banks: []domain.ConnectionBank{{ID: 3, Name: "ARQ", Reading: domain.BankNoEmails}}},
		{ID: 2, Active: true, LinkedAccounts: 2, ConnectedAt: now.Add(-10 * time.Minute),
			Banks: []domain.ConnectionBank{{ID: 4, Name: "ARQ", Reading: domain.BankUnreadable}, {ID: 5, Name: "BBVA", Reading: domain.BankReading}}},
	}, nil)

	status, err := svc.Status(context.Background(), "u1")
	require.NoError(t, err)
	assert.Equal(t, domain.ReadingNoTransaction, status.Connections[0].Reading)
	assert.Equal(t, domain.ReadingFirst, status.Connections[1].Reading, "BBVA still reading")
}

func newReadingServiceRepo(t *testing.T) (*ReadingAppService, *mock.MockReadingRepository) {
	svc, repo, _, _ := newReadingService(t)
	return svc, repo
}

func TestReading_ScheduleUnsupportedAlerts(t *testing.T) {
	svc, repo, mail, _ := newReadingService(t)
	repo.EXPECT().ClaimUnsupportedAlerts(gomock.Any(), domain.UnsupportedAfter, (*time.Time)(nil), unsupportedBatch).Return([]domain.UnsupportedAlert{
		{EmailID: 7, UserID: "u1", UserEmail: "ana@example.com"},
	}, nil)

	n, err := svc.ScheduleUnsupportedAlerts(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	require.Len(t, mail.queued, 1)
	email := mail.queued[0]
	assert.Equal(t, domain.TemplateBankUnsupported, email.Template)
	assert.Equal(t, domain.MailPriorityNotification, email.Priority)
	assert.Equal(t, "bank_unsupported:7", *email.DedupeKey)
	assert.JSONEq(t, `{"email_id":7}`, string(email.Payload), "only the connection id in the outbox")
}

func TestReading_EnrichUnsupported(t *testing.T) {
	ctx := context.Background()
	userID := "u1"
	outbox := domain.OutboxEmail{UserID: &userID, Template: domain.TemplateBankUnsupported}

	svc, repo, _, _ := newReadingService(t)
	repo.EXPECT().StillUnsupported(gomock.Any(), "u1", uint64(7)).Return(true, nil)
	data := map[string]any{"email_id": float64(7)}
	require.NoError(t, svc.Enrich(ctx, outbox, data))
	assert.NotContains(t, data, "samples_address", "plan/30: no samples, no list of banks")
	assert.NotContains(t, data, "supported_banks")

	svc, repo, _, _ = newReadingService(t)
	repo.EXPECT().StillUnsupported(gomock.Any(), "u1", uint64(7)).Return(false, nil)
	assert.ErrorIs(t, svc.Enrich(ctx, outbox, map[string]any{"email_id": float64(7)}), domain.ErrMailCancelled,
		"it started reading before the email went out")
}

func TestReading_PublicStatsCachedAndRounded(t *testing.T) {
	svc, repo, _, _ := newReadingService(t)
	start := svc.now()
	repo.EXPECT().PublicStats(gomock.Any()).Return(domain.RawPublicStats{Automated: 7485, Total: 8748, Banks: 12}, nil).Times(1)

	stats, err := svc.PublicStats(context.Background())
	require.NoError(t, err)
	assert.Equal(t, domain.PublicStats{AutomatedTransactions: 7400, AutomatedPct: 85, BanksRead: 12}, *stats)

	// within the hour: no new query
	svc.now = func() time.Time { return start.Add(30 * time.Minute) }
	_, err = svc.PublicStats(context.Background())
	require.NoError(t, err)

	// after the hour the database fails: the last good value is served
	svc.now = func() time.Time { return start.Add(2 * time.Hour) }
	repo.EXPECT().PublicStats(gomock.Any()).Return(domain.RawPublicStats{}, errors.New("db down"))
	stats, err = svc.PublicStats(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(7400), stats.AutomatedTransactions)
}

func TestReading_PublicStatsErrorWithoutCache(t *testing.T) {
	svc, repo, _, _ := newReadingService(t)
	repo.EXPECT().PublicStats(gomock.Any()).Return(domain.RawPublicStats{}, errors.New("db down"))
	_, err := svc.PublicStats(context.Background())
	assert.Error(t, err)
}
