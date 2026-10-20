package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=user_extra.go -destination=mock/user_extra.go -package=mock

// UserExtraRepository is an interface for interacting with user extra information data
type UserExtraRepository interface {
	Create(ctx context.Context, userExtra *domain.UserExtra) error
	GetByUserID(ctx context.Context, userID string) (*domain.UserExtra, error)
	GetByID(ctx context.Context, ID uint64) (*domain.UserExtra, error)
	Update(ctx context.Context, userExtra *domain.UserExtra) error
	Delete(ctx context.Context, ID uint64) error
	GetAll(ctx context.Context) ([]*domain.UserExtra, error)
	UpdateReadEmailByUserID(ctx context.Context, userID string, readEmail bool) error
}

// UserExtraService is an interface for interacting with user extra information business logic
type UserExtraService interface {
	Create(ctx context.Context, userExtra *domain.UserExtra) error
	Get(ctx context.Context, userID string) (*domain.UserExtra, error)
	Update(ctx context.Context, userExtra *domain.UserExtra) error
	Delete(ctx context.Context, ID uint64) error
	UpdateReadEmail(ctx context.Context, userID string, readEmail bool) error
}
