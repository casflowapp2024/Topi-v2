package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=currency_change.go -destination=mock/currency_change.go -package=mock

// CurrencyChangeRepository changes the currency of accounts and of the user, and closes accounts
type CurrencyChangeRepository interface {
	// ChangeAccountCurrency previews or applies the change (change.Apply) and fills its result
	ChangeAccountCurrency(ctx context.Context, change *domain.AccountCurrencyChange) error
	// ListAccountCurrencyChanges returns the currency changes of an account of the user, newest first
	ListAccountCurrencyChanges(ctx context.Context, userID string, accountID uint64) ([]domain.AccountCurrencyChange, error)
	// UndoAccountCurrencyChange restores the account as it was before the change
	UndoAccountCurrencyChange(ctx context.Context, userID string, accountID, changeID uint64) error
	// ChangeBaseCurrency previews or applies the change of the user's base currency
	ChangeBaseCurrency(ctx context.Context, change *domain.BaseCurrencyChange) error
	// SetAccountClosed closes (or reopens) an account of the user; returns its closed_at
	SetAccountClosed(ctx context.Context, userID string, accountID uint64, closed bool) (*time.Time, error)
}

// CurrencyChangeService validates and runs currency changes and account closing
type CurrencyChangeService interface {
	ChangeAccountCurrency(ctx context.Context, change *domain.AccountCurrencyChange) error
	ListAccountCurrencyChanges(ctx context.Context, userID string, accountID uint64) ([]domain.AccountCurrencyChange, error)
	UndoAccountCurrencyChange(ctx context.Context, userID string, accountID, changeID uint64) error
	ChangeBaseCurrency(ctx context.Context, change *domain.BaseCurrencyChange) error
	SetAccountClosed(ctx context.Context, userID string, accountID uint64, closed bool) (*time.Time, error)
}
