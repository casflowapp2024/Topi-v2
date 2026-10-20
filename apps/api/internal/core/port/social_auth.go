package port

import (
	"cash-flow/internal/core/domain"
)

//go:generate mockgen -source=social_auth.go -destination=mock/social_auth.go -package=mock

// SocialAuthRepository is an interface for interacting with social authentication
type SocialAuthRepository interface {
	GetAuthURL(platform string) (*string, error)
	SignIn(code string) (*domain.SocialAuthResponse, error)
}
