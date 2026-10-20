package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"errors"
)

type AccountTypeService struct {
	repo port.AccountTypeRepository
}

func NewAccountTypeService(repo port.AccountTypeRepository) *AccountTypeService {
	return &AccountTypeService{
		repo: repo,
	}
}

func (at *AccountTypeService) CreateAccountType(ctx context.Context, accountType *domain.AccountType) error {
	err := at.repo.CreateAccountType(ctx, accountType)
	if err != nil {
		return err
	}

	return nil
}

func (at *AccountTypeService) GetAccountType(ctx context.Context, id uint64) (*domain.AccountType, error) {
	account, err := at.repo.GetAccountType(ctx, id)
	if err != nil {
		return nil, err
	}

	return account, nil
}

func (at *AccountTypeService) GetAccountTypes(ctx context.Context, skip, limit uint64) ([]domain.AccountType, error) {
	var accounts []domain.AccountType

	accounts, err := at.repo.GetAccountTypeList(ctx, skip, limit)
	if err != nil {
		return nil, domain.ErrInternal
	}

	return accounts, nil
}

func (at *AccountTypeService) UpdateAccountType(ctx context.Context, accountType *domain.AccountType) error {
	actualType, err := at.repo.GetAccountType(ctx, accountType.ID)
	if err != nil {
		if errors.Is(err, domain.ErrDataNotFound) {
			return err
		}
		return domain.ErrInternal
	}

	if domain.IsSameAccountType(actualType, accountType) || domain.IsEmptyAccountType(accountType) {
		return domain.ErrNoUpdatedData
	}

	err = at.repo.UpdateAccountType(ctx, accountType)
	if err != nil {
		return err
	}

	return nil
}

func (at *AccountTypeService) DeleteAccountType(ctx context.Context, id uint64) error {
	_, err := at.repo.GetAccountType(ctx, id)
	if err != nil {
		if errors.Is(err, domain.ErrDataNotFound) {
			return err
		}
		return domain.ErrInternal
	}

	return at.repo.DeleteAccountType(ctx, id)
}
