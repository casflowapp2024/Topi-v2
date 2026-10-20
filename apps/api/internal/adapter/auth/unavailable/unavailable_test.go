package unavailable_test

import (
	"cash-flow/internal/adapter/auth/unavailable"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

var (
	_ port.UserRepository       = unavailable.UserRepository{}
	_ port.SocialAuthRepository = unavailable.SocialAuthRepository{}
	_ port.TokenRepository      = unavailable.TokenRepository{}
)

func TestUnavailableAdapters(t *testing.T) {
	ctx := context.Background()

	_, err := unavailable.UserRepository{}.SignIn(ctx, "user@example.com", "x")
	assert.ErrorIs(t, err, domain.ErrAuthUnavailable)

	_, err = unavailable.SocialAuthRepository{}.GetAuthURL("google")
	assert.ErrorIs(t, err, domain.ErrAuthUnavailable)

	_, err = unavailable.TokenRepository{}.VerifyToken("token")
	assert.ErrorIs(t, err, domain.ErrAuthUnavailable)
}
