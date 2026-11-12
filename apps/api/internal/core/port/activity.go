package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=activity.go -destination=mock/activity.go -package=mock

// ActivityRepository stores the days a user opened the app (user_activity_days)
type ActivityRepository interface {
	// MarkActive inserts (user, day) and ignores it when it already exists
	MarkActive(ctx context.Context, userID string, day time.Time) error
}

// ActivityTracker records that an authenticated user used the app. It writes at most once per user and day.
type ActivityTracker interface {
	Touch(ctx context.Context, userID string)
}

// FounderRepository marks the founders (plan/22-modelo-negocio.md)
type FounderRepository interface {
	// MarkEligible sets founder_eligible for the users created before cutoff; it never unmarks anyone.
	// Returns how many users were marked now.
	MarkEligible(ctx context.Context, cutoff time.Time) (int64, error)
	// List returns the eligible users with their activity of the last activeDays days
	List(ctx context.Context, activeDays int) (domain.FounderList, error)
	// ConfirmActive confirms the active eligible users not confirmed yet and audits it in the same statement;
	// with dryRun it only counts
	ConfirmActive(ctx context.Context, adminID string, activeDays int, dryRun bool) (domain.FounderBulkResult, error)
	// SetConfirmed confirms (true) or removes the confirmation (false) of one eligible user, audited.
	// It never deletes a user. ErrNotFounderEligible if the user is not eligible (or does not exist).
	SetConfirmed(ctx context.Context, adminID, userID string, confirmed bool) error
}

// FounderService manages the founders list of the admin panel
type FounderService interface {
	List(ctx context.Context) (*domain.FounderList, error)
	ConfirmActive(ctx context.Context, adminID string, dryRun bool) (*domain.FounderBulkResult, error)
	Confirm(ctx context.Context, adminID, userID string) error
	Unconfirm(ctx context.Context, adminID, userID string) error
}

// ProductEventRepository stores product_events
type ProductEventRepository interface {
	Record(ctx context.Context, event domain.ProductEvent) error
}

// ProductEventRecorder emits product events from the services. It never fails the user's action:
// an invalid event or a failed write is logged and dropped.
type ProductEventRecorder interface {
	Emit(ctx context.Context, event domain.ProductEvent)
}
