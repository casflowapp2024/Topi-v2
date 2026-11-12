package port

import (
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
}
