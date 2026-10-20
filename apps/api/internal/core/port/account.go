package port

import (
	"cash-flow/internal/core/domain"
	"context"

	"github.com/jackc/pgx/v5"
)

//go:generate mockgen -source=account.go -destination=mock/account.go -package=mock

type AccountRepository interface {
	CreateAccount(ctx context.Context, account *domain.Account) error
	GetAccount(ctx context.Context, userID string, id uint64) (*domain.Account, error)
	GetAccountsList(ctx context.Context, userID string, skip, limit uint64, accountTypes []uint64) ([]domain.Account, error)
	AdminGetAccountsList(ctx context.Context, filters domain.AccountFilters) ([]domain.Account, error)
	AdminGetAccountsByBank(ctx context.Context, filters domain.AccountFilters) ([]domain.BankAccountGroup, error)
	UpdateAccount(ctx context.Context, account *domain.Account) error
	DeleteAccount(ctx context.Context, userID string, id uint64) error
	DisconnectEmail(ctx context.Context, tx pgx.Tx, userID string, emailID uint64) error
}

type AccountService interface {
	CreateAccount(ctx context.Context, account *domain.Account) error
	GetAccount(ctx context.Context, userID string, id uint64) (*domain.Account, error)
	GetAccounts(ctx context.Context, userID string, skip, limit uint64, filter string) ([]domain.Account, error)
	AdminGetAccounts(ctx context.Context, filters domain.AccountFilters) ([]domain.Account, error)
	AdminGetAccountsByBank(ctx context.Context, filters domain.AccountFilters) ([]domain.BankAccountGroup, error)
	UpdateAccount(ctx context.Context, account *domain.Account) error
	DeleteAccount(ctx context.Context, userID string, id uint64) error
	CalculateInitialBalance(ctx context.Context, userID string, accountID uint64) (*domain.Account, error)
}
