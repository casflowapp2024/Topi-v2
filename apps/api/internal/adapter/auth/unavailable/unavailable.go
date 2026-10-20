// Package unavailable provides the auth adapters used when Cognito is not configured.
// Every operation fails with domain.ErrAuthUnavailable (HTTP 503) so the API can
// start without an identity provider. Replaced by the own auth in phase 2.
package unavailable

import (
	"cash-flow/internal/core/domain"
	"context"
)

// UserRepository implements port.UserRepository
type UserRepository struct{}

// SocialAuthRepository implements port.SocialAuthRepository
type SocialAuthRepository struct{}

// TokenRepository implements port.TokenRepository
type TokenRepository struct{}

func (UserRepository) SignUp(context.Context, *domain.User) (*string, error) {
	return nil, domain.ErrAuthUnavailable
}

func (UserRepository) ConfirmAccount(context.Context, string, string) error {
	return domain.ErrAuthUnavailable
}

func (UserRepository) SignIn(context.Context, string, string) (*domain.AuthTokens, error) {
	return nil, domain.ErrAuthUnavailable
}

func (UserRepository) GetUserByToken(context.Context, string) (*domain.User, error) {
	return nil, domain.ErrAuthUnavailable
}

func (UserRepository) AdminGetUserByID(context.Context, string) (*domain.User, error) {
	return nil, domain.ErrAuthUnavailable
}

func (UserRepository) UpdateUser(context.Context, domain.User, string) error {
	return domain.ErrAuthUnavailable
}

func (UserRepository) ResendConfirmationCode(context.Context, string) error {
	return domain.ErrAuthUnavailable
}

func (UserRepository) ForgotPassword(context.Context, string) error {
	return domain.ErrAuthUnavailable
}

func (UserRepository) ConfirmForgotPassword(context.Context, string, string, string) error {
	return domain.ErrAuthUnavailable
}

func (UserRepository) ListUsers(context.Context, int64, *string) ([]domain.User, *string, error) {
	return nil, nil, domain.ErrAuthUnavailable
}

func (SocialAuthRepository) GetAuthURL(string) (*string, error) {
	return nil, domain.ErrAuthUnavailable
}

func (SocialAuthRepository) SignIn(string) (*domain.SocialAuthResponse, error) {
	return nil, domain.ErrAuthUnavailable
}

func (TokenRepository) VerifyToken(string) (*domain.TokenPayload, error) {
	return nil, domain.ErrAuthUnavailable
}
