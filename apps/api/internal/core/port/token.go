package port

import (
	"cash-flow/internal/core/domain"
)

//go:generate mockgen -source=token.go -destination=mock/token.go -package=mock

// TokenRepository issues and verifies access tokens
type TokenRepository interface {
	// GenerateAccessToken returns a signed access token and its lifetime in seconds
	GenerateAccessToken(user *domain.User) (string, int64, error)
	// VerifyToken verifies the token and returns the payload
	VerifyToken(token string) (*domain.TokenPayload, error)
}
