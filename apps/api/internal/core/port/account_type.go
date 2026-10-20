package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=account.go -destination=mock/account.go -package=mock

type AccountTypeRepository interface {
	CreateAccountType(ctx context.Context, accountType *domain.AccountType) error
	GetAccountType(ctx context.Context, id uint64) (*domain.AccountType, error)
	GetAccountTypeList(ctx context.Context, skip uint64, limit uint64) ([]domain.AccountType, error)
	UpdateAccountType(ctx context.Context, accountType *domain.AccountType) error
	DeleteAccountType(ctx context.Context, id uint64) error
}

type AccountTypeService interface {
	CreateAccountType(ctx context.Context, accountType *domain.AccountType) error
	GetAccountType(ctx context.Context, id uint64) (*domain.AccountType, error)
	GetAccountTypes(ctx context.Context, skip, limit uint64) ([]domain.AccountType, error)
	UpdateAccountType(ctx context.Context, accountType *domain.AccountType) error
	DeleteAccountType(ctx context.Context, id uint64) error
}
