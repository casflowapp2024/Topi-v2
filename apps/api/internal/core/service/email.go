package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"

	"github.com/jackc/pgx/v5"
)

type EmailService struct {
	repo           port.EmailRepository
	email          port.EmailAPI
	repoAccount    port.AccountRepository
	accountService port.AccountService
	txManager      port.TransactionManager
}

func NewEmailService(
	repo port.EmailRepository,
	mail port.EmailAPI,
	account port.AccountRepository,
	accountService port.AccountService,
	txManager port.TransactionManager,
) *EmailService {
	return &EmailService{
		repo:           repo,
		email:          mail,
		repoAccount:    account,
		accountService: accountService,
		txManager:      txManager,
	}
}

func (e *EmailService) GetUserAuthURL(ctx context.Context, provider string) (*string, error) {
	return e.email.GetAuthURL(provider)
}

func (e *EmailService) RegisterUserEmail(ctx context.Context, email *domain.Email) error {
	token, err := e.email.GetToken(ctx, email.Provider, email.Code)
	if err != nil {
		return err
	}

	if !email.IsValidRefreshToken(*token) {
		return domain.ErrEmailAlreadyConfigured
	}

	email.SetToken(*token)

	err = e.repo.RegisterEmail(ctx, email)
	if err != nil {
		return err
	}

	return nil
}

func (e *EmailService) GetUserEmailToken(ctx context.Context, userID string, id uint64) (*domain.Email, error) {
	active := true
	email, err := e.repo.GetEmail(ctx, userID, id, &active)
	if err != nil {
		return nil, err
	}

	return email, nil
}

func (e *EmailService) ListUserEmails(
	ctx context.Context,
	userID string,
	skip uint64,
	limit uint64,
) ([]domain.Email, error) {
	emails, err := e.repo.ListEmails(ctx, userID, skip, limit)
	if err != nil {
		return nil, err
	}

	return emails, nil
}

func (e *EmailService) UpdateUserEmail(ctx context.Context, email *domain.Email) error {
	actualEmail, err := e.repo.GetEmail(ctx, email.UserID, *email.ID, nil)
	if err != nil {
		return err
	}

	if email.IsSameEmail(actualEmail) {
		return domain.ErrNoUpdatedData
	}

	err = e.repo.UpdateEmail(ctx, email)
	if err != nil {
		return err
	}

	return nil
}

func (e *EmailService) DeleteEmail(ctx context.Context, userID string, id uint64) error {
	_, err := e.repo.GetEmail(ctx, userID, id, nil)
	if err != nil {
		return err
	}

	err = e.txManager.WithTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		if tErr := e.repoAccount.DisconnectEmail(ctx, tx, userID, id); tErr != nil {
			return tErr
		}

		if tErr := e.repo.DeleteEmailTrx(ctx, tx, userID, id); tErr != nil {
			return tErr
		}

		return nil
	})

	return err
}

func (e *EmailService) SaveEmailError(ctx context.Context, emailID uint64, errorMsg string) error {
	return e.repo.SaveEmailError(ctx, emailID, errorMsg)
}

func (e *EmailService) ReadEmail(ctx context.Context, userID string, accountIDs []uint64) (*domain.ReadEmailResponse, error) {
	// Get all user accounts to validate ownership
	userAccounts, err := e.accountService.GetAccounts(ctx, userID, 0, 100, enums.All)
	if err != nil {
		return nil, err
	}

	// Validate that the user owns the requested accounts
	if err = domain.Accounts(userAccounts).ValidateUserAccounts(accountIDs); err != nil {
		return nil, err
	}

	// Call AdminGetAccountsList to extract the required information
	filters := domain.AccountFilters{
		IDs:   accountIDs,
		Skip:  0,
		Limit: 100,
	}

	accountsDetails, err := e.repoAccount.AdminGetAccountsList(ctx, filters)
	if err != nil {
		return nil, err
	}

	// Send email reading requests to SQS
	response := e.email.ReadEmail(accountsDetails)

	return response, nil
}
