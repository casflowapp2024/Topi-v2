package jwt

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Token implements port.TokenRepository interface
// and provides access to the jwt library
type Token struct {
	region     string
	userPoolID string
	ClientID   string
}

// New creates a new jwt instance
//
// Parameters:
//   - config: A pointer to the config.Token struct containing token configuration.
//
// Returns:
//   - A new instance of Token implementing the port.TokenRepository interface.
func New(config *config.Token) *Token {
	return &Token{
		config.Region,
		config.UserPoolID,
		config.ClientID,
	}
}

// VerifyToken verifies the provided JWT token and returns the token payload.
//
// Parameters:
//   - token: The JWT token string to be verified.
//
// Returns:
//   - A pointer to domain.TokenPayload containing the token payload.
//   - An error if the token is invalid or verification fails.
func (t *Token) VerifyToken(token string) (*domain.TokenPayload, error) {
	jwtToken, err := t.VerifySignature(token)
	if err != nil {
		slog.Error("failed to verify token signature", slog.Any("error", err))
		return nil, domain.ErrVerifyingTokenSignature
	}

	claims, ok := jwtToken.Claims.(jwt.MapClaims)
	if !ok {
		return nil, domain.ErrInvalidTokenClaims
	}

	err = t.VerifyExpiration(claims)
	if err != nil {
		return nil, domain.ErrExpiredToken
	}

	use, err := t.VerifyUse(claims)
	if err != nil {
		return nil, err
	}

	err = t.VerifyClientId(claims, *use)
	if err != nil {
		return nil, err
	}

	payload, err := t.GetTokenPayload(claims, *use)
	if err != nil {
		return nil, err
	}

	if *use == enums.IdUse && !payload.Verified {
		return nil, domain.ErrUnauthorized
	}

	return payload, nil
}

// VerifySignature verifies the JWT token signature.
//
// Parameters:
//   - token: The JWT token string to be verified.
//
// Returns:
//   - A pointer to jwt.Token if the signature is valid.
//   - An error if the signature is invalid or verification fails.
func (t *Token) VerifySignature(token string) (*jwt.Token, error) {
	var host = t.GetUrl(enums.CognitoHost)

	jwks, err := t.GetJWKS()
	if err != nil {
		return nil, err
	}

	jwtToken, err := jwt.Parse(
		token,
		jwks.Keyfunc,
		jwt.WithValidMethods([]string{enums.Algorithm}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuer(host),
	)

	if err != nil || !jwtToken.Valid {
		return nil, err
	}
	return jwtToken, nil
}

// VerifyExpiration verifies the JWT token expiration.
//
// Parameters:
//   - claims: The JWT claims map that contains the expiration time to be verified.
//
// Returns:
//   - An error if the expiration claim is invalid or the token is expired.
func (t *Token) VerifyExpiration(claims jwt.MapClaims) error {
	expClaim, err := claims.GetExpirationTime()
	if err != nil {
		return err
	}

	if expClaim.Unix() < time.Now().Unix() {
		return err
	}

	return nil
}

// VerifyUse verifies the token_use claim in the JWT token.
//
// Parameters:
//   - claims: The JWT claims map that contains the token use to be verified.
//
// Returns:
//   - An error if the token_use claim is invalid or does not match the expected use.
func (t *Token) VerifyUse(claims jwt.MapClaims) (*string, error) {
	tokenUseClaim, ok := claims[enums.TokenUse].(string)
	if !ok {
		return nil, errors.New("token_use claim not found")
	}
	if tokenUseClaim != enums.AccessUse && tokenUseClaim != enums.IdUse {
		return nil, errors.New("invalid token use")
	}

	return &tokenUseClaim, nil
}

// VerifyClientId verifies the 'client_id' or 'aud' claim in the JWT token.
//
// Parameters:
//   - claims: The JWT claims map to be verified.
//
// Returns:
//   - An error if the client_id or aud claim is invalid or does not match the expected client ID.
func (t *Token) VerifyClientId(claims jwt.MapClaims, use string) error {
	var appClientIdClaim string

	switch use {
	case enums.AccessUse:
		if clientId, ok := claims[enums.ClientId].(string); ok {
			appClientIdClaim = clientId
		}
	case enums.IdUse:
		if audience, err := claims.GetAudience(); err == nil && len(audience) > 0 {
			appClientIdClaim = audience[0]
		}
	}

	if appClientIdClaim != t.ClientID {
		return errors.New("invalid client id")
	}

	return nil
}

func (t *Token) GetTokenPayload(claims jwt.MapClaims, use string) (*domain.TokenPayload, error) {
	payload := &domain.TokenPayload{}

	if use == enums.IdUse {
		verified, ok := claims["email_verified"].(bool)
		if !ok {
			return nil, errors.New("email_verified claim not found")
		}

		name, ok := claims["name"].(string)
		if !ok {
			return nil, errors.New("name claim not found")
		}

		familyName, ok := claims["family_name"].(string)
		if !ok {
			return nil, errors.New("family name claim not found")
		}

		email, ok := claims["email"].(string)
		if !ok {
			return nil, errors.New("email name claim not found")
		}

		payload.Verified = verified
		payload.Name = name
		payload.LastName = familyName
		payload.Email = email
	}

	sub, err := claims.GetSubject()
	if err != nil {
		return nil, errors.New("sub claim not found")
	}

	payload.UserID = sub
	payload.Groups = t.GetGroups(claims)
	payload.Use = use

	return payload, nil
}

// GetGroups retrieves the user groups from the JWT token claims.
//
// Parameters:
//   - claims: The JWT claims map from which to retrieve the user groups.
//
// Returns:
//   - A slice of strings containing the user groups.
func (t *Token) GetGroups(claims jwt.MapClaims) map[string]bool {
	var userGroups = make(map[string]bool)

	if userGroupsAttribute, found := claims[enums.UserGroups]; found {
		if groups, valid := userGroupsAttribute.([]interface{}); valid {
			for _, e := range groups {
				if group, isString := e.(string); isString {
					userGroups[group] = true
				}
			}
		}
	}
	return userGroups
}

// GetJWKS retrieves the JSON Web Key Set (JWKS) from the configured URL.
//
// Returns:
//   - A pointer to keyfunc.JWKS containing the JSON Web Key Set.
//   - An error if the JWKS retrieval fails.
func (t *Token) GetJWKS() (*keyfunc.JWKS, error) {
	jwksURL := t.GetUrl(enums.JwksUrl)

	jwks, err := keyfunc.Get(jwksURL, keyfunc.Options{})
	if err != nil {
		return nil, err
	}

	return jwks, nil
}

// GetUrl constructs a URL using the provided path template and token configuration.
//
// Parameters:
//   - path: The URL path template.
//
// Returns:
//   - The constructed URL as a string.
func (t *Token) GetUrl(path string) string {
	return fmt.Sprintf(path, t.region, t.userPoolID)
}
