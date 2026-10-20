package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"

	"github.com/gin-gonic/gin"
)

// UserService implements port.UserService interface
// and provides access to the user repository
// and cache service
type UserService struct {
	repo   port.UserRepository
	token  port.TokenRepository
	social port.SocialAuthRepository
}

// NewUserService creates a new user service instance
func NewUserService(
	repo port.UserRepository,
	token port.TokenRepository,
	social port.SocialAuthRepository,
) *UserService {
	return &UserService{
		repo,
		token,
		social,
	}
}

// Register creates a new user
func (us *UserService) Register(ctx context.Context, authUser *domain.User) error {
	_, err := us.repo.SignUp(ctx, authUser)
	if err != nil {
		return err
	}

	return nil
}

// ConfirmUser confirms a user's account
func (us *UserService) ConfirmUser(ctx context.Context, email, code string) error {
	err := us.repo.ConfirmAccount(ctx, email, code)
	if err != nil {
		return err
	}
	return nil
}

func (us *UserService) GetSocialAuthURL(_ context.Context, platform string) (*string, error) {
	authURL, err := us.social.GetAuthURL(platform)
	if err != nil {
		return nil, err
	}

	return authURL, nil
}

// Login gives a registered user an access token if the credentials are valid
func (us *UserService) Login(ctx context.Context, email, password, code string) (*domain.AuthTokens, error) {
	if code != "" {
		social, err := us.social.SignIn(code)
		if err != nil {
			return nil, err
		}

		return &social.AuthTokens, nil
	}

	token, err := us.repo.SignIn(ctx, email, password)
	if err != nil {
		return nil, err
	}

	return token, nil
}

// Authorize verifies the token and returns the token payload
func (us *UserService) Authorize(ctx context.Context, token string) (*domain.TokenPayload, error) {
	payload, err := us.token.VerifyToken(token)
	if err != nil {
		return nil, err
	}

	return payload, nil
}

// GetUser gets a user by email or token
func (us *UserService) GetUser(ctx *gin.Context) (*domain.User, error) {
	use, err := domain.GetAuthTokenUse(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		return nil, err
	}

	if use == nil {
		return nil, domain.ErrInvalidTokenUse
	}

	if *use == enums.IdUse {
		payload, iErr := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
		if iErr != nil {
			return nil, iErr
		}

		return mappers.MapAuthPayloadToUser(payload), nil
	}

	if *use == enums.AccessUse {
		token, aErr := domain.GetAuthToken(ctx, enums.AuthorizationHeaderKey)
		if aErr != nil {
			return nil, aErr
		}

		user, aErr := us.repo.GetUserByToken(ctx, token)
		if aErr != nil {
			return nil, aErr
		}

		return user, nil
	}

	return nil, domain.ErrInvalidTokenUse
}

// AdminIsUserValid gets a user by email or token
func (us *UserService) AdminIsUserValid(ctx context.Context, userID string) (bool, error) {
	user, err := us.repo.AdminGetUserByID(ctx, userID)
	if err != nil {
		return false, err
	}

	return user.Verified, nil
}

// UpdateUser updates a user's name, email, and password
func (us *UserService) UpdateUser(ctx *gin.Context, user domain.User) (*domain.User, error) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		return nil, err
	}

	token, err := domain.GetAuthToken(ctx, enums.AuthorizationHeaderKey)
	if err != nil {
		return nil, err
	}

	existingUser, err := us.repo.GetUserByToken(ctx, token)
	if err != nil {
		return nil, err
	}

	user.ID = *userID

	if domain.UserIsEmpty(&user) || domain.IsSameUser(existingUser, &user) {
		return nil, domain.ErrNoUpdatedData
	}

	err = us.repo.UpdateUser(ctx, user, token)
	if err != nil {
		return nil, domain.ErrInternal
	}

	user.Verified = existingUser.Verified
	user.Group = existingUser.Group
	user.Email = existingUser.Email

	return &user, nil
}

// ResendConfirmationCode sends a confirmation code to the user's email
func (us *UserService) ResendConfirmationCode(ctx context.Context, email string) error {
	err := us.repo.ResendConfirmationCode(ctx, email)
	if err != nil {
		return err
	}
	return nil
}

// ForgotPassword sends a password reset code to the user's email
func (us *UserService) ForgotPassword(ctx context.Context, email string) error {
	err := us.repo.ForgotPassword(ctx, email)
	if err != nil {
		return err
	}
	return nil
}

// ConfirmForgotPassword confirms the password reset code and sets a new password
func (us *UserService) ConfirmForgotPassword(ctx context.Context, email, code, newPassword string) error {
	err := us.repo.ConfirmForgotPassword(ctx, email, code, newPassword)
	if err != nil {
		return err
	}
	return nil
}
