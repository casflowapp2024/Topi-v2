package port

import (
	"cash-flow/internal/core/domain"
	"context"

	"github.com/gin-gonic/gin"
)

//go:generate mockgen -source=user.go -destination=mock/user.go -package=mock

// UserRepository is an interface for interacting with user-related data
type UserRepository interface {
	SignUp(ctx context.Context, authUser *domain.User) (*string, error)
	ConfirmAccount(ctx context.Context, email, code string) error
	SignIn(ctx context.Context, email, password string) (*domain.AuthTokens, error)
	GetUserByToken(ctx context.Context, token string) (*domain.User, error)
	AdminGetUserByID(ctx context.Context, userID string) (*domain.User, error)
	UpdateUser(ctx context.Context, user domain.User, token string) error
	ResendConfirmationCode(ctx context.Context, email string) error
	ForgotPassword(ctx context.Context, email string) error
	ConfirmForgotPassword(ctx context.Context, email, code, newPassword string) error
	ListUsers(ctx context.Context, limit int64, paginationToken *string) ([]domain.User, *string, error)
}

// UserService is an interface for interacting with user-related business logic
type UserService interface {
	Register(ctx context.Context, authUser *domain.User) error
	ConfirmUser(ctx context.Context, email, code string) error
	GetSocialAuthURL(ctx context.Context, platform string) (*string, error)
	Login(ctx context.Context, email, password, code string) (*domain.AuthTokens, error)
	Authorize(ctx context.Context, token string) (*domain.TokenPayload, error)
	GetUser(ctx *gin.Context) (*domain.User, error)
	AdminIsUserValid(ctx context.Context, userID string) (bool, error)
	UpdateUser(ctx *gin.Context, user domain.User) (*domain.User, error)
	ResendConfirmationCode(ctx context.Context, email string) error
	ForgotPassword(ctx context.Context, email string) error
	ConfirmForgotPassword(ctx context.Context, email, code, newPassword string) error
}
