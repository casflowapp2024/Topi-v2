package port

import (
	"cash-flow/internal/core/domain"
	"context"

	"github.com/gin-gonic/gin"
)

//go:generate mockgen -source=user.go -destination=mock/user.go -package=mock

// UserRepository is an interface for interacting with the users table
type UserRepository interface {
	CreateUser(ctx context.Context, user *domain.User) error
	GetUserByID(ctx context.Context, id string) (*domain.User, error)
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	// SetInitialPassword must only succeed when the user has no password (atomic check)
	SetInitialPassword(ctx context.Context, id string, passwordHash string) error
	// UpdatePassword replaces the password, increments token_version and returns the new version
	UpdatePassword(ctx context.Context, id string, passwordHash string) (int, error)
	// UpdateProfile updates name and last name (also in user_extra)
	UpdateProfile(ctx context.Context, id, name, lastName string) error
}

// UserService is an interface for interacting with user-related business logic
type UserService interface {
	Register(ctx context.Context, user *domain.User, meta domain.RequestMeta) (*domain.AuthTokens, error)
	Login(ctx context.Context, email, password string, meta domain.RequestMeta) (*domain.AuthTokens, error)
	SetInitialPassword(ctx context.Context, email, password string, meta domain.RequestMeta) (*domain.AuthTokens, error)
	Refresh(ctx context.Context, refreshToken string, meta domain.RequestMeta) (*domain.AuthTokens, error)
	Logout(ctx context.Context, refreshToken string) error
	ChangePassword(ctx context.Context, userID, currentPassword, newPassword string, meta domain.RequestMeta) (*domain.AuthTokens, error)
	Authorize(ctx context.Context, token string) (*domain.TokenPayload, error)
	AuthorizeAPIKey(apiKey string) (*domain.TokenPayload, error)
	GetUser(ctx *gin.Context) (*domain.User, error)
	AdminIsUserValid(ctx context.Context, userID string) (bool, error)
	UpdateUser(ctx *gin.Context, user domain.User) (*domain.User, error)
}
