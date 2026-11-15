package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=reactivation.go -destination=mock/reactivation.go -package=mock

// ReactivationRepository reads what decides a personal reactivation email (plan/27 §G)
type ReactivationRepository interface {
	Target(ctx context.Context, userID string) (*domain.ReactivationTarget, error)
	SentSince(ctx context.Context, since time.Time) (int, error)
}

// ReactivationService: one person at a time from the admin panel, with the final email previewed first
type ReactivationService interface {
	View(ctx context.Context, userID string) (*domain.ReactivationView, error)
	Preview(ctx context.Context, userID string, draft domain.ReactivationDraft) (*domain.ReactivationPreview, error)
	Send(ctx context.Context, adminID, userID string, draft domain.ReactivationDraft) error
}
