package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=reading.go -destination=mock/reading.go -package=mock

// ReadingRepository reads the state of the user's connections and the welcome checklist (plan/27 §B, §C).
// Counts and dates only: never the content of an email.
type ReadingRepository interface {
	ConnectionStatuses(ctx context.Context, userID string) ([]domain.ConnectionStatus, error)
	OnboardingFacts(ctx context.Context, userID string) (domain.OnboardingFacts, error)
	// RecordOnboardingSteps stores onboarding_step_completed once per user and step; returns the new ones
	RecordOnboardingSteps(ctx context.Context, userID string, steps []string) ([]string, error)
	// ClaimUnsupportedAlerts marks (unsupported_alert_at) up to limit healthy connections with linked accounts,
	// connected at least `after` ago, without any automatic transaction, never alerted, whose user wants
	// connection alerts; returns who to tell
	ClaimUnsupportedAlerts(ctx context.Context, after time.Duration, limit int) ([]domain.UnsupportedAlert, error)
	// StillUnsupported: the connection exists, is healthy and still has no automatic transaction
	StillUnsupported(ctx context.Context, userID string, emailID uint64) (bool, error)
	// OwnsBank: the bank is one of the user's
	OwnsBank(ctx context.Context, userID string, bankID uint64) (bool, error)
}

// ReadingService is GET /email/status and GET /onboarding/status
type ReadingService interface {
	Status(ctx context.Context, userID string) (*domain.ReadingStatus, error)
	Onboarding(ctx context.Context, userID string) (*domain.OnboardingStatus, error)
}
