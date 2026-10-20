package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
)

// UserExtraService implements port.UserExtraService interface
// and provides access to the user extra repository
type UserExtraService struct {
	repo     port.UserExtraRepository
	userRepo port.UserRepository
}

// NewUserExtraService creates a new user extra service instance
func NewUserExtraService(repo port.UserExtraRepository, userRepo port.UserRepository) port.UserExtraService {
	return &UserExtraService{
		repo:     repo,
		userRepo: userRepo,
	}
}

// Create creates a new user extra information record
func (us *UserExtraService) Create(ctx context.Context, userExtra *domain.UserExtra) error {
	if !userExtra.ExistsBasicUserInfo() {
		user, err := us.getUserInfo(ctx)
		if err != nil {
			return err
		}

		userExtra.UpdateBasicInfo(user)
	}

	return us.repo.Create(ctx, userExtra)
}

// Get retrieves user extra information by user ID
func (us *UserExtraService) Get(ctx context.Context, userID string) (*domain.UserExtra, error) {
	return us.repo.GetByUserID(ctx, userID)
}

// Update updates user extra information
func (us *UserExtraService) Update(ctx context.Context, userExtra *domain.UserExtra) error {
	actualUser, err := us.repo.GetByUserID(ctx, userExtra.UserID)
	if err != nil {
		return err
	}

	if !userExtra.ExistsBasicUserInfo() {
		user, uErr := us.getUserInfo(ctx)
		if uErr != nil {
			return uErr
		}

		userExtra.UpdateBasicInfo(user)
	}

	if actualUser.IsEmpty() || actualUser.IsSame(userExtra) {
		return domain.ErrNoUpdatedData
	}

	userExtra.UpdateWhatsappState(actualUser)

	return us.repo.Update(ctx, userExtra)
}

// Delete deletes user extra information
func (us *UserExtraService) Delete(ctx context.Context, ID uint64) error {
	_, err := us.repo.GetByID(ctx, ID)
	if err != nil {
		return err
	}

	return us.repo.Delete(ctx, ID)
}

// UpdateReadEmail updates only the read_email field for a specific user extra record
// First validates that the user extra record exists, then updates the field
func (us *UserExtraService) UpdateReadEmail(ctx context.Context, userID string, readEmail bool) error {
	// Validate that user extra exists
	_, err := us.repo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}

	// Update only the read_email field
	return us.repo.UpdateReadEmailByUserID(ctx, userID, readEmail)
}

func (us *UserExtraService) getUserInfo(ctx context.Context) (domain.User, error) {
	token, err := domain.GetAuthToken(ctx, enums.AuthorizationHeaderKey)
	if err != nil {
		return domain.User{}, err
	}

	user, err := us.userRepo.GetUserByToken(ctx, token)
	if err != nil {
		return domain.User{}, err
	}

	if user == nil {
		return domain.User{}, domain.ErrEmptyUserInfo
	}

	return *user, nil
}
