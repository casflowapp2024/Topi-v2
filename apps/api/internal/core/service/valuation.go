package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"strings"
	"time"
)

// ValuationService implements port.ValuationService
type ValuationService struct {
	repo port.ValuationRepository
	now  func() time.Time
}

// NewValuationService creates a new valuation service instance
func NewValuationService(repo port.ValuationRepository) *ValuationService {
	return &ValuationService{repo: repo, now: time.Now}
}

func (vs *ValuationService) ListValuations(ctx context.Context, userID string, accountID uint64) ([]domain.AccountValuation, error) {
	return vs.repo.ListValuations(ctx, userID, accountID)
}

func (vs *ValuationService) SaveValuation(ctx context.Context, valuation *domain.AccountValuation) error {
	valuation.Note = strings.TrimSpace(valuation.Note)
	valuation.Date = time.Date(valuation.Date.Year(), valuation.Date.Month(), valuation.Date.Day(), 0, 0, 0, 0, time.UTC)
	if valuation.Source == "" {
		valuation.Source = "manual"
	}
	if err := valuation.Validate(vs.now()); err != nil {
		return err
	}
	return vs.repo.UpsertValuation(ctx, valuation)
}

func (vs *ValuationService) DeleteValuation(ctx context.Context, userID string, accountID, id uint64) error {
	return vs.repo.DeleteValuation(ctx, userID, accountID, id)
}

func (vs *ValuationService) GetInvestmentPerformance(
	ctx context.Context,
	userID string,
	start, end time.Time,
) ([]domain.InvestmentPerformance, error) {
	if start.IsZero() || end.IsZero() || start.After(end) {
		return nil, domain.ErrInvalidDateRange
	}
	return vs.repo.GetInvestmentPerformance(ctx, userID, start, end)
}
