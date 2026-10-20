package mappers

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/utils"
	"errors"

	"github.com/jackc/pgx/v5"
)

func MapPostgresErrorCode(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrDataNotFound
	}

	code := utils.ParsePgError(err)

	switch code {
	case "23505":
		return domain.ErrConflictingData
	case "23503":
		return domain.ErrUniqueConstraintViolated
	case "42601":
		return domain.ErrSyntaxError
	case "42702":
		return domain.ErrAmbiguousColumn
	case "22001":
		return domain.ErrValueTooLong
	default:
		return err
	}
}

func MapEmailApiErrorCode(code string) error {
	switch code {
	case "invalid_grant":
		return domain.ErrEmailInvalidCode
	case "invalid_request":
		return domain.ErrEmailInvalidRequest
	case "access_denied":
		return domain.ErrEmailAccessDenied
	case "user_rate_limit_exceeded":
		return domain.ErrEmailRateLimitExceeded
	case "invalid_client":
		return domain.ErrEmailInvalidClientId
	default:
		return domain.ErrInternal
	}
}

func MapAuthPayloadToUser(payload *domain.TokenPayload) *domain.User {
	return &domain.User{
		ID:       payload.UserID,
		Name:     payload.Name,
		LastName: payload.LastName,
		Email:    payload.Email,
		Verified: payload.Verified,
	}
}
