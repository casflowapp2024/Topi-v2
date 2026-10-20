package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=bank.go -destination=mock/bank.go -package=mock

type BankRepository interface {
	CreateBank(ctx context.Context, bank *domain.Bank) error
	GetBank(ctx context.Context, userID string, id uint64) (*domain.Bank, error)
	GetBanksList(ctx context.Context, userID string, skip uint64, limit uint64) ([]domain.Bank, error)
	UpdateBank(ctx context.Context, bank *domain.Bank) error
	DeleteBank(ctx context.Context, userID string, id uint64) error
}

type BankService interface {
	CreateBank(ctx context.Context, bank *domain.Bank) error
	GetBank(ctx context.Context, userID string, id uint64) (*domain.Bank, error)
	GetBanks(ctx context.Context, userID string, skip, limit uint64) ([]domain.Bank, error)
	UpdateBank(ctx context.Context, bank *domain.Bank) error
	DeleteBank(ctx context.Context, userID string, id uint64) error
	GetOfficialBanks(ctx context.Context) domain.OfficialBanks
}
