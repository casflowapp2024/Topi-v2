package jwt

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "0123456789abcdef0123456789abcdef"

func newTestToken(now time.Time) *Token {
	token := New(&config.Auth{JWTSecret: testSecret, JWTIssuer: "topi-api", AccessTokenTTL: time.Hour})
	token.now = func() time.Time { return now }
	return token
}

func TestToken_GenerateAndVerify(t *testing.T) {
	now := time.Now()
	token := newTestToken(now)
	user := &domain.User{ID: "user-1", Email: "user@example.com", Role: domain.RoleAdmin, TokenVersion: 3}

	signed, expiresIn, err := token.GenerateAccessToken(user)
	require.NoError(t, err)
	assert.Equal(t, int64(3600), expiresIn)

	payload, err := token.VerifyToken(signed)
	require.NoError(t, err)
	assert.Equal(t, "user-1", payload.UserID)
	assert.Equal(t, "user@example.com", payload.Email)
	assert.Equal(t, 3, payload.TokenVersion)
	assert.Equal(t, "access", payload.Use)
	assert.True(t, payload.Groups["admin"])
}

func TestToken_VerifyRejects(t *testing.T) {
	now := time.Now()
	user := &domain.User{ID: "user-1", Email: "user@example.com", Role: domain.RoleUser}

	t.Run("expired token", func(t *testing.T) {
		signed, _, err := newTestToken(now.Add(-2 * time.Hour)).GenerateAccessToken(user)
		require.NoError(t, err)

		_, err = newTestToken(now).VerifyToken(signed)
		assert.ErrorIs(t, err, domain.ErrExpiredToken)
	})

	t.Run("wrong secret", func(t *testing.T) {
		other := New(&config.Auth{JWTSecret: "another-secret-another-secret-123", JWTIssuer: "topi-api", AccessTokenTTL: time.Hour})
		signed, _, err := other.GenerateAccessToken(user)
		require.NoError(t, err)

		_, err = newTestToken(now).VerifyToken(signed)
		assert.ErrorIs(t, err, domain.ErrVerifyingTokenSignature)
	})

	t.Run("wrong issuer", func(t *testing.T) {
		other := New(&config.Auth{JWTSecret: testSecret, JWTIssuer: "someone-else", AccessTokenTTL: time.Hour})
		signed, _, err := other.GenerateAccessToken(user)
		require.NoError(t, err)

		_, err = newTestToken(now).VerifyToken(signed)
		assert.ErrorIs(t, err, domain.ErrVerifyingTokenSignature)
	})

	t.Run("alg none is not accepted", func(t *testing.T) {
		claims := jwt.MapClaims{"sub": "user-1", "tv": 0, "token_use": "access", "iss": "topi-api", "exp": now.Add(time.Hour).Unix()}
		unsigned, err := jwt.NewWithClaims(jwt.SigningMethodNone, claims).SignedString(jwt.UnsafeAllowNoneSignatureType)
		require.NoError(t, err)

		_, err = newTestToken(now).VerifyToken(unsigned)
		assert.ErrorIs(t, err, domain.ErrVerifyingTokenSignature)
	})

	t.Run("token_use other than access", func(t *testing.T) {
		claims := jwt.MapClaims{"sub": "user-1", "tv": 0, "token_use": "id", "iss": "topi-api", "exp": now.Add(time.Hour).Unix()}
		signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
		require.NoError(t, err)

		_, err = newTestToken(now).VerifyToken(signed)
		assert.ErrorIs(t, err, domain.ErrInvalidTokenUse)
	})

	t.Run("missing token version", func(t *testing.T) {
		claims := jwt.MapClaims{"sub": "user-1", "token_use": "access", "iss": "topi-api", "exp": now.Add(time.Hour).Unix()}
		signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
		require.NoError(t, err)

		_, err = newTestToken(now).VerifyToken(signed)
		assert.ErrorIs(t, err, domain.ErrInvalidTokenClaims)
	})
}
