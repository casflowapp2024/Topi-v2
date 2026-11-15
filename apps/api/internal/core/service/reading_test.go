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

func newReadingService(t *testing.T, address string) (*ReadingAppService, *mock.MockReadingRepository, *fakeMailService, *recordedEvents) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockReadingRepository(ctrl)
	mail := &fakeMailService{}
	events := &recordedEvents{}
	svc := NewReadingService(repo, mail, events, ReadingSettings{SamplesAddress: address})
	svc.now = func() time.Time { return time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC) }
	return svc, repo, mail, events
}

func TestReading_Status(t *testing.T) {
	svc, repo, _, _ := newReadingService(t, "bancos@topi.test")
	now := svc.now()
	repo.EXPECT().ConnectionStatuses(gomock.Any(), "u1").Return([]domain.ConnectionStatus{
		{ID: 1, Active: true, LinkedAccounts: 1, ConnectedAt: now.Add(-3 * time.Hour)},
		{ID: 2, Active: true, LinkedAccounts: 1, ConnectedAt: now.Add(-50 * time.Hour)},
	}, nil)

	status, err := svc.Status(context.Background(), "u1")
	require.NoError(t, err)
	assert.Equal(t, domain.ReadingFirst, status.Connections[0].Reading)
	assert.Equal(t, domain.ReadingNoTransaction, status.Connections[1].Reading)
	assert.Equal(t, "bancos@topi.test", status.SamplesAddress)
	assert.NotEmpty(t, status.SupportedBanks)
}

func TestReading_OnboardingRecordsDoneSteps(t *testing.T) {
	svc, repo, _, _ := newReadingService(t, "")
	repo.EXPECT().OnboardingFacts(gomock.Any(), "u1").Return(domain.OnboardingFacts{HasConnection: true}, nil)
	repo.EXPECT().RecordOnboardingSteps(gomock.Any(), "u1", []string{domain.StepConnectEmail}).Return(nil, errors.New("db down"))

	status, err := svc.Onboarding(context.Background(), "u1")
	require.NoError(t, err, "recording the event never fails the request")
	assert.False(t, status.Complete)

	// nothing done: nothing to record
	svc, repo, _, _ = newReadingService(t, "")
	repo.EXPECT().OnboardingFacts(gomock.Any(), "u1").Return(domain.OnboardingFacts{}, nil)
	_, err = svc.Onboarding(context.Background(), "u1")
	require.NoError(t, err)
}

func TestReading_RequestBankSample(t *testing.T) {
	ctx := context.Background()
	bankID := uint64(4)

	t.Run("no address configured: 404 and no event", func(t *testing.T) {
		svc, _, _, events := newReadingService(t, "")
		_, err := svc.RequestBankSample(ctx, "u1", &bankID)
		assert.ErrorIs(t, err, domain.ErrDataNotFound)
		assert.Empty(t, events.events)
	})

	t.Run("own bank: event with its id", func(t *testing.T) {
		svc, repo, _, events := newReadingService(t, "bancos@topi.test")
		repo.EXPECT().OwnsBank(gomock.Any(), "u1", bankID).Return(true, nil)
		address, err := svc.RequestBankSample(ctx, "u1", &bankID)
		require.NoError(t, err)
		assert.Equal(t, "bancos@topi.test", address)
		require.Len(t, events.events, 1)
		assert.Equal(t, map[string]any{"bank_id": bankID}, events.events[0].Props)
	})

	t.Run("someone else's bank: event without the id", func(t *testing.T) {
		svc, repo, _, events := newReadingService(t, "bancos@topi.test")
		repo.EXPECT().OwnsBank(gomock.Any(), "u1", bankID).Return(false, nil)
		_, err := svc.RequestBankSample(ctx, "u1", &bankID)
		require.NoError(t, err)
		assert.Equal(t, map[string]any{}, events.events[0].Props)
	})
}

func TestReading_ScheduleUnsupportedAlerts(t *testing.T) {
	svc, repo, mail, _ := newReadingService(t, "bancos@topi.test")
	repo.EXPECT().ClaimUnsupportedAlerts(gomock.Any(), domain.UnsupportedAfter, unsupportedBatch).Return([]domain.UnsupportedAlert{
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

	svc, repo, _, _ := newReadingService(t, "bancos@topi.test")
	repo.EXPECT().StillUnsupported(gomock.Any(), "u1", uint64(7)).Return(true, nil)
	data := map[string]any{"email_id": float64(7)}
	require.NoError(t, svc.Enrich(ctx, outbox, data))
	assert.Equal(t, "bancos@topi.test", data["samples_address"])
	assert.Contains(t, data["supported_banks"], "Bancolombia")

	svc, repo, _, _ = newReadingService(t, "bancos@topi.test")
	repo.EXPECT().StillUnsupported(gomock.Any(), "u1", uint64(7)).Return(false, nil)
	assert.ErrorIs(t, svc.Enrich(ctx, outbox, map[string]any{"email_id": float64(7)}), domain.ErrMailCancelled,
		"it started reading before the email went out")
}
