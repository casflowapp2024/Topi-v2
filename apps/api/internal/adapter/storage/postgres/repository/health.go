package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"context"
	"time"
)

// HealthRepository implements port.HealthRepository
type HealthRepository struct {
	db *postgres.DB
}

func NewHealthRepository(db *postgres.DB) *HealthRepository {
	return &HealthRepository{db: db}
}

func (hr *HealthRepository) Ping(ctx context.Context) error {
	return hr.db.Ping(ctx)
}

func (hr *HealthRepository) WorkerLastSeen(ctx context.Context) (*time.Time, error) {
	var lastSeen *time.Time
	err := hr.db.QueryRow(ctx, "SELECT max(last_seen) FROM worker_heartbeat").Scan(&lastSeen)
	if err != nil {
		return nil, err
	}
	return lastSeen, nil
}
