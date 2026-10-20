package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=auth.go -destination=mock/auth.go -package=mock

// RefreshTokenRepository stores hashed, rotating refresh tokens
type RefreshTokenRepository interface {
	Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error
	GetByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	// Revoke returns false when the token was already revoked
	Revoke(ctx context.Context, id int64) (bool, error)
	RevokeAllForUser(ctx context.Context, userID string) error
}

// AuthEventRepository records authentication audit events
type AuthEventRepository interface {
	Record(ctx context.Context, event domain.AuthEvent) error
}

// PasswordHasher hashes and verifies passwords
type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash, password string) (bool, error)
}

// RateLimiter limits attempts per key (e.g. "login:ip:1.2.3.4")
type RateLimiter interface {
	Allow(key string) bool
}
