package jwt

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	claimEmail        = "email"
	claimRole         = "role"
	claimTokenVersion = "tv"
)

// Token implements port.TokenRepository with HS256 JWTs signed with JWT_SECRET
type Token struct {
	secret []byte
	issuer string
	ttl    time.Duration
	now    func() time.Time
}

// New creates a new jwt instance
func New(config *config.Auth) *Token {
	return &Token{
		secret: []byte(config.JWTSecret),
		issuer: config.JWTIssuer,
		ttl:    config.AccessTokenTTL,
		now:    time.Now,
	}
}

// GenerateAccessToken signs an access token for the user.
// Claims: sub, email, role, tv (token_version), token_use=access, iss, iat, exp.
func (t *Token) GenerateAccessToken(user *domain.User) (string, int64, error) {
	now := t.now()

	claims := jwt.MapClaims{
		"sub":             user.ID,
		claimEmail:        user.Email,
		claimRole:         user.Role,
		claimTokenVersion: user.TokenVersion,
		enums.TokenUse:    enums.AccessUse,
		"iss":             t.issuer,
		"iat":             now.Unix(),
		"exp":             now.Add(t.ttl).Unix(),
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
	if err != nil {
		return "", 0, err
	}

	return signed, int64(t.ttl.Seconds()), nil
}

// VerifyToken verifies signature (HS256 only), issuer, expiration and token_use
func (t *Token) VerifyToken(token string) (*domain.TokenPayload, error) {
	parsed, err := jwt.Parse(
		token,
		func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(t.issuer),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithTimeFunc(t.now),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, domain.ErrExpiredToken
		}
		return nil, domain.ErrVerifyingTokenSignature
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, domain.ErrInvalidTokenClaims
	}

	if use, _ := claims[enums.TokenUse].(string); use != enums.AccessUse {
		return nil, domain.ErrInvalidTokenUse
	}

	sub, err := claims.GetSubject()
	if err != nil || sub == "" {
		return nil, domain.ErrInvalidTokenClaims
	}

	version, ok := claims[claimTokenVersion].(float64)
	if !ok {
		return nil, domain.ErrInvalidTokenClaims
	}

	email, _ := claims[claimEmail].(string)
	role, _ := claims[claimRole].(string)

	return &domain.TokenPayload{
		UserID:       sub,
		Email:        email,
		Verified:     true,
		Groups:       map[string]bool{enums.AdminRole: role == domain.RoleAdmin},
		Use:          enums.AccessUse,
		TokenVersion: int(version),
	}, nil
}
