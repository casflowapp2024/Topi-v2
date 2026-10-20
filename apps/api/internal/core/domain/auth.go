package domain

import (
	"context"
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
)

// TokenPayload is an entity that represents the payload of the token
type TokenPayload struct {
	UserID   string
	Name     string
	LastName string
	Email    string
	Verified bool
	Groups   map[string]bool
	Use      string
}

func GetAuthUserID(ctx *gin.Context, key string) (*string, error) {
	payload, err := GetAuthPayload(ctx, key)
	if err != nil {
		return nil, err
	}

	return &payload.UserID, nil
}

// GetAuthPayload is a helper function to get the auth payload from the context
func GetAuthPayload(ctx *gin.Context, key string) (*TokenPayload, error) {
	if value, success := ctx.Get(key); success {
		if payload, ok := value.(*TokenPayload); ok {
			return payload, nil
		}
	}

	return nil, errors.New("error getting auth payload")
}

// GetAuthToken is a helper function to get the auth token from the context
func GetAuthToken(ctx context.Context, token string) (string, error) {
	value := ctx.Value(token)
	if value == nil {
		return "", errors.New("error getting auth token")
	}

	v, ok := value.(string)
	if !ok {
		return "", errors.New("error casting token to string")
	}

	fields := strings.Fields(v)
	if len(fields) != 2 {
		return "", errors.New("error getting token fields")
	}

	return fields[1], nil
}

// GetAuthTokenUse is a helper function to get the auth token use from the context
func GetAuthTokenUse(ctx *gin.Context, key string) (*string, error) {
	if value, success := ctx.Get(key); success {
		if payload, ok := value.(*TokenPayload); ok {
			return &payload.Use, nil
		}
	}

	return nil, errors.New("error getting auth payload")
}

type SocialAuthResponse struct {
	AuthTokens
	Error string `json:"error"`
}

type AuthTokens struct {
	IdToken      string `json:"id_token"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}
