package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"strings"
)

// FounderAdminService implements port.FounderService (plan/22: confirmed = eligible with real activity in 90
// days; nobody is deleted for not being a founder)
type FounderAdminService struct {
	repo port.FounderRepository
}

// NewFounderAdminService creates a FounderAdminService
func NewFounderAdminService(repo port.FounderRepository) *FounderAdminService {
	return &FounderAdminService{repo: repo}
}

// List returns the eligible users grouped in active in 90 days and without activity
func (s *FounderAdminService) List(ctx context.Context) (*domain.FounderList, error) {
	list, err := s.repo.List(ctx, domain.FounderActiveDays)
	if err != nil {
		return nil, err
	}
	return &list, nil
}

// ConfirmActive previews (dryRun) or confirms every active eligible user
func (s *FounderAdminService) ConfirmActive(ctx context.Context, adminID string, dryRun bool) (*domain.FounderBulkResult, error) {
	if adminID == "" {
		return nil, domain.ErrForbidden
	}
	result, err := s.repo.ConfirmActive(ctx, adminID, domain.FounderActiveDays, dryRun)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// Confirm confirms one eligible user
func (s *FounderAdminService) Confirm(ctx context.Context, adminID, userID string) error {
	return s.set(ctx, adminID, userID, true)
}

// Unconfirm removes the confirmation of one user (the user and its data stay)
func (s *FounderAdminService) Unconfirm(ctx context.Context, adminID, userID string) error {
	return s.set(ctx, adminID, userID, false)
}

func (s *FounderAdminService) set(ctx context.Context, adminID, userID string, confirmed bool) error {
	if adminID == "" {
		return domain.ErrForbidden
	}
	if strings.TrimSpace(userID) == "" {
		return domain.ErrNotFounderEligible
	}
	return s.repo.SetConfirmed(ctx, adminID, userID, confirmed)
}
