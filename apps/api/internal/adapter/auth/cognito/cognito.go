//go:build !test

package cognito

import (
	"cash-flow/internal/adapter/config"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	cognito "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
)

const (
	AuthFlow   = "USER_PASSWORD_AUTH"
	UserName   = "USERNAME"
	Password   = "PASSWORD"
	SecretHash = "SECRET_HASH"
)

type AuthCognito struct {
	cognito        *cognito.CognitoIdentityProvider
	ClientID       string
	ClientSecretID string
	UserPoolId     string
}

func New(config *config.Auth) *AuthCognito {
	awsConfig := aws.Config{Region: aws.String(config.Region)}

	sess, err := session.NewSession(&awsConfig)
	if err != nil {
		panic(err)
	}

	client := cognito.New(sess)

	return &AuthCognito{
		client,
		config.ClientID,
		config.ClientSecret,
		config.UserPoolID,
	}
}

func (a *AuthCognito) SignUp(name, lastName, email, password string) (*string, error) {
	input := &cognito.SignUpInput{
		ClientId:   aws.String(a.ClientID),
		Username:   aws.String(email),
		Password:   aws.String(password),
		SecretHash: aws.String(a.computeSecretHash(email)),
		UserAttributes: []*cognito.AttributeType{
			{
				Name:  aws.String("name"),
				Value: aws.String(name),
			},
			{
				Name:  aws.String("family_name"),
				Value: aws.String(lastName),
			},
			{
				Name:  aws.String("email"),
				Value: aws.String(email),
			},
		},
	}

	response, err := a.cognito.SignUp(input)

	if err != nil {
		return nil, err
	}

	return response.UserSub, nil
}

func (a *AuthCognito) ConfirmSignUp(email, code string) error {
	input := &cognito.ConfirmSignUpInput{
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
		SecretHash:       aws.String(a.computeSecretHash(email)),
		ClientId:         aws.String(a.ClientID),
	}
	_, err := a.cognito.ConfirmSignUp(input)
	return err
}

func (a *AuthCognito) InitiateAuth(email, password string) (*cognito.AuthenticationResultType, error) {
	input := &cognito.InitiateAuthInput{
		ClientId: aws.String(a.ClientID),
		AuthFlow: aws.String(AuthFlow),
		AuthParameters: aws.StringMap(map[string]string{
			UserName:   email,
			Password:   password,
			SecretHash: a.computeSecretHash(email),
		}),
	}

	response, err := a.cognito.InitiateAuth(input)

	if err != nil {
		return nil, err
	}

	return response.AuthenticationResult, err
}

func (a *AuthCognito) GetUser(token string) (*cognito.GetUserOutput, error) {
	input := &cognito.GetUserInput{
		AccessToken: aws.String(token),
	}
	return a.cognito.GetUser(input)
}

func (a *AuthCognito) AdminGetUser(userID string) (*cognito.AdminGetUserOutput, error) {
	input := &cognito.AdminGetUserInput{
		UserPoolId: aws.String(a.UserPoolId),
		Username:   aws.String(userID),
	}
	return a.cognito.AdminGetUser(input)
}

func (a *AuthCognito) UpdateUserAttributes(
	name,
	lastName,
	token string,
) (*cognito.UpdateUserAttributesOutput, error) {
	input := &cognito.UpdateUserAttributesInput{
		AccessToken: aws.String(token),
		UserAttributes: []*cognito.AttributeType{
			{
				Name:  aws.String("name"),
				Value: aws.String(name),
			},
			{
				Name:  aws.String("family_name"),
				Value: aws.String(lastName),
			},
		},
	}
	return a.cognito.UpdateUserAttributes(input)
}

func (a *AuthCognito) ResendConfirmationCode(email string) (*cognito.ResendConfirmationCodeOutput, error) {
	input := &cognito.ResendConfirmationCodeInput{
		Username:   aws.String(email),
		ClientId:   aws.String(a.ClientID),
		SecretHash: aws.String(a.computeSecretHash(email)),
	}

	return a.cognito.ResendConfirmationCode(input)
}

func (a *AuthCognito) ChangePassword(password, newPassword string) (*cognito.ChangePasswordOutput, error) {
	input := &cognito.ChangePasswordInput{
		AccessToken:      aws.String(a.computeSecretHash(password)),
		PreviousPassword: aws.String(password),
		ProposedPassword: aws.String(newPassword),
	}
	return a.cognito.ChangePassword(input)
}

func (a *AuthCognito) ForgotPassword(email string) (*cognito.ForgotPasswordOutput, error) {
	input := &cognito.ForgotPasswordInput{
		ClientId:   aws.String(a.ClientID),
		Username:   aws.String(email),
		SecretHash: aws.String(a.computeSecretHash(email)),
	}
	return a.cognito.ForgotPassword(input)
}

func (a *AuthCognito) ConfirmForgotPassword(
	email,
	code,
	password string,
) (*cognito.ConfirmForgotPasswordOutput, error) {
	input := &cognito.ConfirmForgotPasswordInput{
		ClientId:         aws.String(a.ClientID),
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
		SecretHash:       aws.String(a.computeSecretHash(email)),
		Password:         aws.String(password),
	}
	return a.cognito.ConfirmForgotPassword(input)

}

func (a *AuthCognito) ListUsers(limit int64, paginationToken *string) (*cognito.ListUsersOutput, error) {
	input := &cognito.ListUsersInput{
		UserPoolId: aws.String(a.UserPoolId),
		Limit:      aws.Int64(limit),
	}

	if paginationToken != nil {
		input.PaginationToken = paginationToken
	}

	return a.cognito.ListUsers(input)
}

func (a *AuthCognito) computeSecretHash(email string) string {
	h := hmac.New(sha256.New, []byte(a.ClientSecretID))
	h.Write([]byte(email + a.ClientID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
