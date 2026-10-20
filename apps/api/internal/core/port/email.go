package port

import (
	"cash-flow/internal/core/domain"
	"context"

	"github.com/jackc/pgx/v5"
)

//go:generate mockgen -source=email.go -destination=mock/email.go -package=mock

type EmailAPI interface {
	GetAuthURL(provider string) (*string, error)
	GetToken(ctx context.Context, provider string, code string) (*domain.EmailToken, error)
	ReadEmail(accounts []domain.Account) *domain.ReadEmailResponse
}

type EmailRepository interface {
	RegisterEmail(ctx context.Context, email *domain.Email) error
	GetEmail(ctx context.Context, userID string, id uint64, isActive *bool) (*domain.Email, error)
	ListEmails(ctx context.Context, userID string, skip uint64, limit uint64) ([]domain.Email, error)
	UpdateEmail(ctx context.Context, email *domain.Email) error
	DeleteEmailTrx(ctx context.Context, tx pgx.Tx, userID string, id uint64) error
	SaveEmailError(ctx context.Context, emailID uint64, errorMsg string) error
}

type EmailService interface {
	GetUserAuthURL(ctx context.Context, provider string) (*string, error)
	RegisterUserEmail(ctx context.Context, email *domain.Email) error
	GetUserEmailToken(ctx context.Context, userID string, id uint64) (*domain.Email, error)
	ListUserEmails(ctx context.Context, userID string, skip uint64, limit uint64) ([]domain.Email, error)
	UpdateUserEmail(ctx context.Context, email *domain.Email) error
	DeleteEmail(ctx context.Context, userID string, id uint64) error
	SaveEmailError(ctx context.Context, emailID uint64, errorMsg string) error
	ReadEmail(ctx context.Context, userID string, accountIDs []uint64) (*domain.ReadEmailResponse, error)
}
