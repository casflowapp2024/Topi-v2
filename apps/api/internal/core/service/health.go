package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"time"
)

// HealthService reports the state of the database and the worker heartbeat
type HealthService struct {
	repo port.HealthRepository
	now  func() time.Time
}

func NewHealthService(repo port.HealthRepository) *HealthService {
	return &HealthService{repo: repo, now: time.Now}
}

func (hs *HealthService) Check(ctx context.Context) domain.Health {
	if err := hs.repo.Ping(ctx); err != nil {
		return domain.NewHealth(err, nil, hs.now())
	}
	lastSeen, err := hs.repo.WorkerLastSeen(ctx)
	if err != nil {
		return domain.NewHealth(err, nil, hs.now())
	}
	return domain.NewHealth(nil, lastSeen, hs.now())
}
