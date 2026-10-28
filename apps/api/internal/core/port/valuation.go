package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=valuation.go -destination=mock/valuation.go -package=mock

// ValuationRepository is an interface for the valuations of investment accounts in the database
type ValuationRepository interface {
	// ListValuations returns the valuations of an account of the user, newest first
	ListValuations(ctx context.Context, userID string, accountID uint64) ([]domain.AccountValuation, error)
	// UpsertValuation creates the valuation of that day or replaces its value and note
	UpsertValuation(ctx context.Context, valuation *domain.AccountValuation) error
	// DeleteValuation deletes a valuation of an account of the user
	DeleteValuation(ctx context.Context, userID string, accountID, id uint64) error
	// GetInvestmentPerformance returns how each investment account of the user did in [start, end]
	GetInvestmentPerformance(ctx context.Context, userID string, start, end time.Time) ([]domain.InvestmentPerformance, error)
}

// ValuationService is an interface for valuations and investment performance
type ValuationService interface {
	ListValuations(ctx context.Context, userID string, accountID uint64) ([]domain.AccountValuation, error)
	// SaveValuation validates and stores the valuation of a day (replacing the one of that day)
	SaveValuation(ctx context.Context, valuation *domain.AccountValuation) error
	DeleteValuation(ctx context.Context, userID string, accountID, id uint64) error
	// GetInvestmentPerformance: start must not be after end
	GetInvestmentPerformance(ctx context.Context, userID string, start, end time.Time) ([]domain.InvestmentPerformance, error)
}
