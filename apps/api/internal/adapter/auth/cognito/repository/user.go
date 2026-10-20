package repository

import (
	"cash-flow/internal/adapter/auth/cognito"
	"cash-flow/internal/core/domain"
	"context"
	"fmt"
)

type UserRepository struct {
	auth cognito.API
}

// NewUserRepository creates a new user repository instance
func NewUserRepository(auth cognito.API) *UserRepository {
	return &UserRepository{
		auth,
	}
}

func (ur *UserRepository) SignUp(ctx context.Context, authUser *domain.User) (*string, error) {
	userID, err := ur.auth.SignUp(authUser.Name, authUser.LastName, authUser.Email, authUser.Password)
	if err != nil {
		return nil, MapAwsError(err)
	}
	return userID, nil
}

func (ur *UserRepository) ConfirmAccount(ctx context.Context, email, code string) error {
	err := ur.auth.ConfirmSignUp(email, code)
	if err != nil {
		return MapAwsError(err)
	}
	return nil
}

func (ur *UserRepository) SignIn(ctx context.Context, email, password string) (*domain.AuthTokens, error) {
	tokens, err := ur.auth.InitiateAuth(email, password)
	if err != nil {
		return nil, MapAwsError(err)
	}
	return &domain.AuthTokens{
		IdToken:      *tokens.IdToken,
		AccessToken:  *tokens.AccessToken,
		RefreshToken: *tokens.RefreshToken,
		ExpiresIn:    *tokens.ExpiresIn,
	}, nil
}

func (ur *UserRepository) GetUserByToken(ctx context.Context, token string) (*domain.User, error) {
	response, err := ur.auth.GetUser(token)
	if err != nil {
		return nil, MapAwsError(err)
	}
	user := MapGetUserResponse(response)
	return user, nil
}

func (ur *UserRepository) AdminGetUserByID(ctx context.Context, userID string) (*domain.User, error) {
	response, err := ur.auth.AdminGetUser(userID)
	if err != nil {
		return nil, MapAwsError(err)
	}
	user := MapAdminGetUserResponse(response)
	return user, nil
}

func (ur *UserRepository) UpdateUser(ctx context.Context, user domain.User, token string) error {
	_, err := ur.auth.UpdateUserAttributes(user.Name, user.LastName, token)
	if err != nil {
		return err
	}
	return nil
}

func (ur *UserRepository) ResendConfirmationCode(ctx context.Context, email string) error {
	_, err := ur.auth.ResendConfirmationCode(email)
	if err != nil {
		return MapAwsError(err)
	}
	return nil
}

func (ur *UserRepository) ForgotPassword(ctx context.Context, email string) error {
	rsp, err := ur.auth.ForgotPassword(email)
	if err != nil {
		return MapAwsError(err)
	}
	fmt.Println(rsp)
	return nil
}

func (ur *UserRepository) ConfirmForgotPassword(ctx context.Context, email, code, newPassword string) error {
	rsp, err := ur.auth.ConfirmForgotPassword(email, code, newPassword)
	if err != nil {
		return MapAwsError(err)
	}
	fmt.Println(rsp)
	return nil
}

func (ur *UserRepository) ListUsers(ctx context.Context, limit int64, paginationToken *string) ([]domain.User, *string, error) {
	response, err := ur.auth.ListUsers(limit, paginationToken)
	if err != nil {
		return nil, nil, MapAwsError(err)
	}

	users := CreateUsersFromCognito(response)

	return users, response.PaginationToken, nil
}
