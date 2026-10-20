package repository

import (
	"cash-flow/internal/core/domain"
	"errors"
	"strconv"

	"github.com/aws/aws-sdk-go/aws/awserr"
	cognito "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
)

// MapGetUserResponse maps a Cognito GetUser response to a domain user
func MapGetUserResponse(cognitoUser *cognito.GetUserOutput) *domain.User {
	return mapAttributes(cognitoUser.UserAttributes)
}

// MapAdminGetUserResponse maps a Cognito AdminGetUser response to a domain user
func MapAdminGetUserResponse(cognitoUser *cognito.AdminGetUserOutput) *domain.User {
	return mapAttributes(cognitoUser.UserAttributes)
}

// CreateUsersFromCognito maps a Cognito ListUsers response to domain users
func CreateUsersFromCognito(response *cognito.ListUsersOutput) []domain.User {
	users := make([]domain.User, 0, len(response.Users))
	for _, cognitoUser := range response.Users {
		users = append(users, *mapAttributes(cognitoUser.Attributes))
	}

	return users
}

func mapAttributes(attributes []*cognito.AttributeType) *domain.User {
	var user domain.User

	for _, attribute := range attributes {
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

// ParseError returns the AWS error wrapped in err, or nil
func ParseError(err error) awserr.Error {
	if err != nil {
		var awsErr awserr.Error
		if errors.As(err, &awsErr) {
			return awsErr
		}
	}
	return nil
}

// MapAwsError maps Cognito error codes to domain errors
func MapAwsError(err error) error {
	if awsErr := ParseError(err); awsErr != nil {
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
