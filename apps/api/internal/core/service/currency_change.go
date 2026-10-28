package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"strings"
	"time"
)

// CurrencyChangeService implements port.CurrencyChangeService
type CurrencyChangeService struct {
	repo port.CurrencyChangeRepository
}

// NewCurrencyChangeService creates a new currency change service instance
func NewCurrencyChangeService(repo port.CurrencyChangeRepository) *CurrencyChangeService {
	return &CurrencyChangeService{repo: repo}
}

func (cs *CurrencyChangeService) ChangeAccountCurrency(ctx context.Context, change *domain.AccountCurrencyChange) error {
	if err := change.Normalize(); err != nil {
		return err
	}
	return cs.repo.ChangeAccountCurrency(ctx, change)
}

func (cs *CurrencyChangeService) ListAccountCurrencyChanges(
	ctx context.Context,
	userID string,
	accountID uint64,
) ([]domain.AccountCurrencyChange, error) {
	return cs.repo.ListAccountCurrencyChanges(ctx, userID, accountID)
}

func (cs *CurrencyChangeService) UndoAccountCurrencyChange(ctx context.Context, userID string, accountID, changeID uint64) error {
	return cs.repo.UndoAccountCurrencyChange(ctx, userID, accountID, changeID)
}

func (cs *CurrencyChangeService) ChangeBaseCurrency(ctx context.Context, change *domain.BaseCurrencyChange) error {
	change.NewCurrency = strings.ToUpper(strings.TrimSpace(change.NewCurrency))
	if !domain.IsCurrencyCode(change.NewCurrency) {
		return domain.ErrInvalidCurrency
	}
	return cs.repo.ChangeBaseCurrency(ctx, change)
}

func (cs *CurrencyChangeService) SetAccountClosed(
	ctx context.Context,
	userID string,
	accountID uint64,
	closed bool,
) (*time.Time, error) {
	return cs.repo.SetAccountClosed(ctx, userID, accountID, closed)
}
