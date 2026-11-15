package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"
	"time"
)

// unsupportedBatch bounds the bank_unsupported emails queued per run (they also go through the daily quota)
const unsupportedBatch = 50

// ReadingSettings are the launch settings the reading status needs
type ReadingSettings struct {
	// SamplesAddress is the team mailbox for bank notification samples ("" = not asked)
	SamplesAddress string
}

// ReadingAppService implements port.ReadingService, the bank_unsupported scheduler and its MailEnricher
// (plan/27 §B and §C)
type ReadingAppService struct {
	repo     port.ReadingRepository
	mail     port.MailService
	events   port.ProductEventRecorder
	settings ReadingSettings
	now      func() time.Time
}

// NewReadingService creates the reading status service
func NewReadingService(repo port.ReadingRepository, mail port.MailService, events port.ProductEventRecorder, settings ReadingSettings) *ReadingAppService {
	return &ReadingAppService{repo: repo, mail: mail, events: events, settings: settings, now: time.Now}
}

// Status: every connection with its reading state, the banks Topi reads and where to send a sample
func (s *ReadingAppService) Status(ctx context.Context, userID string) (*domain.ReadingStatus, error) {
	connections, err := s.repo.ConnectionStatuses(ctx, userID)
	if err != nil {
		return nil, err
	}
	now := s.now()
	for i := range connections {
		connections[i].ComputeReading(now)
	}
	return &domain.ReadingStatus{
		Connections:    connections,
		SupportedBanks: domain.SupportedBanks(),
		SamplesAddress: s.settings.SamplesAddress,
	}, nil
}

// Onboarding: the real state of the checklist. The first time a step is seen done it is recorded as
// onboarding_step_completed (once per user and step); recording never fails the request.
func (s *ReadingAppService) Onboarding(ctx context.Context, userID string) (*domain.OnboardingStatus, error) {
	facts, err := s.repo.OnboardingFacts(ctx, userID)
	if err != nil {
		return nil, err
	}
	status := domain.NewOnboardingStatus(facts)
	if done := status.DoneSteps(); len(done) > 0 {
		if _, err := s.repo.RecordOnboardingSteps(ctx, userID, done); err != nil {
			slog.Error("onboarding: could not record steps", "user_id", userID, "error", err)
		}
	}
	return &status, nil
}

// RequestBankSample returns the team address to forward a bank notification to and records
// bank_sample_requested. The email itself goes to the team mailbox: Topi never stores it.
func (s *ReadingAppService) RequestBankSample(ctx context.Context, userID string, bankID *uint64) (string, error) {
	if s.settings.SamplesAddress == "" {
		return "", domain.ErrDataNotFound
	}
	props := map[string]any{}
	if bankID != nil {
		owns, err := s.repo.OwnsBank(ctx, userID, *bankID)
		if err != nil {
			return "", err
		}
		if owns {
			props["bank_id"] = *bankID
		}
	}
	emit(ctx, s.events, domain.ProductEvent{UserID: userID, Name: domain.ProductEventBankSampleRequested, Props: props})
	return s.settings.SamplesAddress, nil
}

// ScheduleUnsupportedAlerts queues bank_unsupported (priority 3, once per connection) for the healthy
// connections with linked accounts that got no transaction in 48 h
func (s *ReadingAppService) ScheduleUnsupportedAlerts(ctx context.Context) (int, error) {
	if s.mail == nil {
		return 0, nil
	}
	alerts, err := s.repo.ClaimUnsupportedAlerts(ctx, domain.UnsupportedAfter, unsupportedBatch)
	if err != nil {
		return 0, err
	}
	queued := 0
	for _, alert := range alerts {
		userID := alert.UserID
		key := domain.TemplateBankUnsupported + ":" + strconv.FormatUint(alert.EmailID, 10)
		payload, _ := json.Marshal(map[string]any{"email_id": alert.EmailID})
		if _, err := s.mail.Enqueue(ctx, domain.OutboxEmail{
			UserID:    &userID,
			To:        alert.UserEmail,
			Template:  domain.TemplateBankUnsupported,
			Payload:   payload,
			Priority:  domain.MailPriorityNotification,
			DedupeKey: &key,
		}); err != nil {
			slog.Error("bank unsupported: could not enqueue", "email_id", alert.EmailID, "error", err)
			continue
		}
		queued++
	}
	return queued, nil
}

// RunScheduler checks every interval for connections that need the bank_unsupported email
func (s *ReadingAppService) RunScheduler(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if n, err := s.ScheduleUnsupportedAlerts(ctx); err != nil {
			slog.Error("bank unsupported: could not schedule", "error", err)
		} else if n > 0 {
			slog.Info("bank unsupported: queued", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Enrich fills bank_unsupported when sending (implements MailEnricher). Cancelled if the connection started
// reading, went down or was removed in the meantime.
func (s *ReadingAppService) Enrich(ctx context.Context, email domain.OutboxEmail, data map[string]any) error {
	rawID, _ := data["email_id"].(float64)
	if rawID <= 0 || email.UserID == nil {
		return domain.ErrMailCancelled
	}
	still, err := s.repo.StillUnsupported(ctx, *email.UserID, uint64(rawID))
	if err != nil {
		return err
	}
	if !still {
		return domain.ErrMailCancelled
	}
	data["supported_banks"] = strings.Join(domain.SupportedBanks(), ", ")
	data["samples_address"] = s.settings.SamplesAddress
	return nil
}
