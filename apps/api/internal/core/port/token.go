package port

import (
	"cash-flow/internal/core/domain"
)

//go:generate mockgen -source=token.go -destination=mock/token.go -package=mock

// TokenRepository is an interface for interacting with token-related business logic
type TokenRepository interface {
	// VerifyToken verifies the token and returns the payload
	VerifyToken(token string) (*domain.TokenPayload, error)
}
