package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"log/slog"
	"time"
)

// productEventTimeout bounds the write of an event (it runs after the user's action succeeded)
const productEventTimeout = 2 * time.Second

// ProductEventService implements port.ProductEventRecorder: validates against the closed list and stores
type ProductEventService struct {
	repo port.ProductEventRepository
}

// NewProductEventService creates a ProductEventService
func NewProductEventService(repo port.ProductEventRepository) *ProductEventService {
	return &ProductEventService{repo: repo}
}

// Emit stores a valid event; errors are logged (an event never fails the request)
func (s *ProductEventService) Emit(ctx context.Context, event domain.ProductEvent) {
	if err := event.Validate(); err != nil {
		slog.Warn("product event dropped", "name", event.Name, "error", err)
		return
	}
	writeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), productEventTimeout)
	defer cancel()
	if err := s.repo.Record(writeCtx, event); err != nil {
		slog.Warn("could not record product event", "name", event.Name, "error", err)
	}
}

// emit is a nil-safe helper for the services that may run without a recorder (tests, tools)
func emit(ctx context.Context, recorder port.ProductEventRecorder, event domain.ProductEvent) {
	if recorder != nil {
		recorder.Emit(ctx, event)
	}
}
