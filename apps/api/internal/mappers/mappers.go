package mappers

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/utils"
	"errors"
	"strconv"

	cognito "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
	"github.com/jackc/pgx/v5"
)

func MapGetUserResponse(cognitoUser *cognito.GetUserOutput) *domain.User {
	var user domain.User

	for _, attribute := range cognitoUser.UserAttributes {
		switch *attribute.Name {
		case "sub":
			user.ID = *attribute.Value
		case "name":
			user.Name = *attribute.Value
		case "family_name":
			user.LastName = *attribute.Value
		case "email":
			user.Email = *attribute.Value
		case "email_verified":
			emailVerified, err := strconv.ParseBool(*attribute.Value)
			if err == nil {
				user.Verified = emailVerified
			}
		}
	}

	return &user
}

func MapAdminGetUserResponse(cognitoUser *cognito.AdminGetUserOutput) *domain.User {
	var user domain.User

	for _, attribute := range cognitoUser.UserAttributes {
		switch *attribute.Name {
		case "sub":
			user.ID = *attribute.Value
		case "name":
			user.Name = *attribute.Value
		case "family_name":
			user.LastName = *attribute.Value
		case "email":
			user.Email = *attribute.Value
		case "email_verified":
			emailVerified, err := strconv.ParseBool(*attribute.Value)
			if err == nil {
				user.Verified = emailVerified
			}
		}
	}

	return &user
}

func MapAwsError(err error) error {
	if awsErr := utils.ParseError(err); awsErr != nil {
		switch awsErr.Code() {
		case domain.UsernameExistsException:
			return domain.ErrUsernameExistsException
		case domain.InvalidPasswordException:
			return domain.ErrInvalidPasswordException
		case domain.UserNotConfirmedException:
			return domain.ErrUserNotConfirmedException
		case domain.CodeMismatchException:
			return domain.ErrCodeMismatchException
		case domain.NotAuthorizedException:
			return domain.ErrNotAuthorizedException
		case domain.ExpiredCodeException:
			return domain.ErrExpiredCodeException
		case domain.UserNotFoundException:
			return domain.ErrUserNotFoundException
		case domain.PasswordResetRequiredException:
			return domain.ErrPasswordResetRequiredException
		case domain.ExpiredTokenException:
			return domain.ErrExpiredTokenException
		case domain.LimitExceededException:
			return domain.ErrLimitExceededException
		default:
			return awsErr
		}
	}
	return domain.ErrInternal
}

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
