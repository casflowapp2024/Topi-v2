package mappers

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/utils"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"testing"

	cognito "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
	"github.com/stretchr/testify/assert"
)

func TestMapGetUserResponse(t *testing.T) {
	cognitoUser := &cognito.GetUserOutput{
		UserAttributes: []*cognito.AttributeType{
			{
				Name:  aws.String("sub"),
				Value: aws.String("12345"),
			},
			{
				Name:  aws.String("name"),
				Value: aws.String("John"),
			},
			{
				Name:  aws.String("family_name"),
				Value: aws.String("Doe"),
			},
			{
				Name:  aws.String("email"),
				Value: aws.String("john.doe@example.com"),
			},
			{
				Name:  aws.String("email_verified"),
				Value: aws.String("true"),
			},
		},
	}

	expectedUser := &domain.User{
		ID:       "12345",
		Name:     "John",
		LastName: "Doe",
		Email:    "john.doe@example.com",
		Verified: true,
	}

	user := MapGetUserResponse(cognitoUser)
	assert.Equal(t, expectedUser, user)
}

func TestMapAwsError(t *testing.T) {
	tests := []struct {
		name     string
		inputErr error
		expected error
	}{
		{
			name:     "UsernameExistsException",
			inputErr: awserr.New(domain.UsernameExistsException, "", nil),
			expected: domain.ErrUsernameExistsException,
		},
		{
			name:     "InvalidPasswordException",
			inputErr: awserr.New(domain.InvalidPasswordException, "", nil),
			expected: domain.ErrInvalidPasswordException,
		},
		{
			name:     "UserNotConfirmedException",
			inputErr: awserr.New(domain.UserNotConfirmedException, "", nil),
			expected: domain.ErrUserNotConfirmedException,
		},
		{
			name:     "CodeMismatchException",
			inputErr: awserr.New(domain.CodeMismatchException, "", nil),
			expected: domain.ErrCodeMismatchException,
		},
		{
			name:     "NotAuthorizedException",
			inputErr: awserr.New(domain.NotAuthorizedException, "", nil),
			expected: domain.ErrNotAuthorizedException,
		},
		{
			name:     "ExpiredCodeException",
			inputErr: awserr.New(domain.ExpiredCodeException, "", nil),
			expected: domain.ErrExpiredCodeException,
		},
		{
			name:     "UserNotFoundException",
			inputErr: awserr.New(domain.UserNotFoundException, "", nil),
			expected: domain.ErrUserNotFoundException,
		},
		{
			name:     "PasswordResetRequiredException",
			inputErr: awserr.New(domain.PasswordResetRequiredException, "", nil),
			expected: domain.ErrPasswordResetRequiredException,
		},
		{
			name:     "InternalError",
			inputErr: awserr.New("InternalError", "some other error", nil),
			expected: utils.ParseError(awserr.New("InternalError", "some other error", nil)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := MapAwsError(tt.inputErr)
			assert.Equal(t, tt.expected, err)
		})
	}
}
