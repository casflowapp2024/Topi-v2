package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=fx.go -destination=mock/fx.go -package=mock

// FxRepository is an interface for currencies, exchange rates and net worth in the database
type FxRepository interface {
	// ListCurrencies returns the active currencies
	ListCurrencies(ctx context.Context) ([]domain.Currency, error)
	// GetQuote returns 1 from = ? to on date (last rate on or before date)
	GetQuote(ctx context.Context, from, to string, date time.Time) (domain.FxQuote, error)
	// GetNetWorth values every account of the user today in their base currency
	GetNetWorth(ctx context.Context, userID string) (domain.NetWorth, error)
}

// FxService is an interface for currencies, exchange rates and net worth
type FxService interface {
	ListCurrencies(ctx context.Context) ([]domain.Currency, error)
	// GetQuote validates the codes; a zero date means today
	GetQuote(ctx context.Context, from, to string, date time.Time) (domain.FxQuote, error)
	GetNetWorth(ctx context.Context, userID string) (domain.NetWorth, error)
}
