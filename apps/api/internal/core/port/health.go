package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=health.go -destination=mock/health.go -package=mock

type HealthRepository interface {
	// Ping checks the database connection
	Ping(ctx context.Context) error
	// WorkerLastSeen returns the most recent worker heartbeat (nil if there is none)
	WorkerLastSeen(ctx context.Context) (*time.Time, error)
}

type HealthService interface {
	Check(ctx context.Context) domain.Health
}
