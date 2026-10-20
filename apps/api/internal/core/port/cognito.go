package port

import cognito "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"

//go:generate mockgen -source=cognito.go -destination=mock/cognito.go -package=mock

type AuthCognito interface {
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
