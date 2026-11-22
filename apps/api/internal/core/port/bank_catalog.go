package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=bank_catalog.go -destination=mock/bank_catalog.go -package=mock

// BankCatalogRepository: bank_catalog, bank_catalog_senders and bank_logos (plan/33)
type BankCatalogRepository interface {
	// List returns every catalog bank with all its senders (active or not) and the etag of its logo
	List(ctx context.Context) ([]domain.CatalogBank, error)
	Create(ctx context.Context, in domain.CatalogBankInput) (*domain.CatalogBank, error)
	Update(ctx context.Context, id uint64, in domain.CatalogBankInput) error
	SetActive(ctx context.Context, id uint64, active bool) error
	// AddSender adds the address, or reactivates it when the bank already had it
	AddSender(ctx context.Context, bankID uint64, email string, note *string) (*domain.CatalogSender, error)
	UpdateSender(ctx context.Context, bankID, senderID uint64, active bool, note *string) error
	// LinkUserBanks links to the catalog bank the user banks with its name that are not linked yet
	LinkUserBanks(ctx context.Context, bankID uint64) (int64, error)
	PutLogo(ctx context.Context, logo domain.BankLogo) error
	GetLogo(ctx context.Context, bankID uint64) (*domain.BankLogo, error)
	DeleteLogo(ctx context.Context, bankID uint64) error
	// AdminBanks: usage and per sender health (last 30 days) of every catalog bank
	AdminBanks(ctx context.Context) ([]domain.AdminCatalogBank, error)
	// UserSenders: the addresses users typed that their catalog bank does not have (privacy applied)
	UserSenders(ctx context.Context) ([]domain.UserSender, error)
}

type BankCatalogService interface {
	// Reload reads the database and refreshes the snapshot of the reading rules
	Reload(ctx context.Context) error
	AdminList(ctx context.Context) ([]domain.AdminCatalogBank, error)
	Create(ctx context.Context, in domain.CatalogBankInput) (*domain.CatalogBank, error)
	Update(ctx context.Context, id uint64, in domain.CatalogBankInput) error
	SetActive(ctx context.Context, id uint64, active bool) error
	AddSender(ctx context.Context, bankID uint64, email string, note *string) (*domain.CatalogSender, error)
	UpdateSender(ctx context.Context, bankID, senderID uint64, active bool, note *string) error
	PutLogo(ctx context.Context, bankID uint64, data []byte) error
	GetLogo(ctx context.Context, bankID uint64) (*domain.BankLogo, error)
	DeleteLogo(ctx context.Context, bankID uint64) error
	UserSenders(ctx context.Context) ([]domain.UserSender, error)
}
