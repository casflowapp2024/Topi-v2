package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"strings"
	"time"
)

// FxService implements port.FxService
type FxService struct {
	repo port.FxRepository
	now  func() time.Time
}

// NewFxService creates a new fx service instance
func NewFxService(repo port.FxRepository) *FxService {
	return &FxService{repo: repo, now: time.Now}
}

func (fs *FxService) ListCurrencies(ctx context.Context) ([]domain.Currency, error) {
	return fs.repo.ListCurrencies(ctx)
}

func (fs *FxService) GetQuote(ctx context.Context, from, to string, date time.Time) (domain.FxQuote, error) {
	from, to = strings.ToUpper(from), strings.ToUpper(to)
	if !domain.IsCurrencyCode(from) || !domain.IsCurrencyCode(to) {
		return domain.FxQuote{}, domain.ErrInvalidCurrency
	}
	if date.IsZero() {
		date = fs.now()
	}
	return fs.repo.GetQuote(ctx, from, to, date)
}

func (fs *FxService) GetNetWorth(ctx context.Context, userID string) (domain.NetWorth, error) {
	return fs.repo.GetNetWorth(ctx, userID)
}
