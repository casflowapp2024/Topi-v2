package cognito

import cognito "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"

//go:generate mockgen -source=client.go -destination=mock/client.go -package=mock

// API is the subset of the Cognito Identity Provider used by the user repository.
// It lives inside the adapter so the core does not depend on the AWS SDK.
// Cognito is replaced by the own auth in phase 2.
type API interface {
	SignUp(name, lastName, email, password string) (*string, error)
	ConfirmSignUp(email, code string) error
	InitiateAuth(email, password string) (*cognito.AuthenticationResultType, error)
	GetUser(token string) (*cognito.GetUserOutput, error)
	AdminGetUser(userID string) (*cognito.AdminGetUserOutput, error)
	UpdateUserAttributes(name, lastName, token string) (*cognito.UpdateUserAttributesOutput, error)
	ResendConfirmationCode(email string) (*cognito.ResendConfirmationCodeOutput, error)
	ChangePassword(password, newPassword string) (*cognito.ChangePasswordOutput, error)
	ForgotPassword(email string) (*cognito.ForgotPasswordOutput, error)
	ConfirmForgotPassword(email, code, password string) (*cognito.ConfirmForgotPasswordOutput, error)
	ListUsers(limit int64, paginationToken *string) (*cognito.ListUsersOutput, error)
}
