package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"errors"
)

type BankService struct {
	repo port.BankRepository
}

func NewBankService(repo port.BankRepository) *BankService {
	return &BankService{
		repo: repo,
	}
}

func (bs BankService) CreateBank(ctx context.Context, bank *domain.Bank) error {
	bank.SetOfficialBank()

	err := bs.repo.CreateBank(ctx, bank)
	if err != nil {
		return err
	}

	return nil
}

func (bs BankService) GetBank(ctx context.Context, userID string, id uint64) (*domain.Bank, error) {
	var bank *domain.Bank

	bank, err := bs.repo.GetBank(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	return bank, nil
}

func (bs BankService) GetBanks(ctx context.Context, userID string, skip, limit uint64) ([]domain.Bank, error) {
	var banks []domain.Bank

	banks, err := bs.repo.GetBanksList(ctx, userID, skip, limit)
	if err != nil {
		return nil, domain.ErrInternal
	}

	return banks, nil
}

func (bs BankService) UpdateBank(ctx context.Context, bank *domain.Bank) error {
	actualBank, err := bs.repo.GetBank(ctx, bank.UserID, bank.ID)
	if err != nil {
		if errors.Is(err, domain.ErrDataNotFound) {
			return err
		}
		return domain.ErrInternal
	}

	if domain.IsSameBank(actualBank, bank) {
		return domain.ErrNoUpdatedData
	}

	err = bs.repo.UpdateBank(ctx, bank)
	if err != nil {
		return err
	}

	return nil
}

func (bs BankService) DeleteBank(ctx context.Context, userID string, id uint64) error {
	_, err := bs.repo.GetBank(ctx, userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrDataNotFound) {
			return err
		}
		return domain.ErrInternal
	}

	return bs.repo.DeleteBank(ctx, userID, id)
}

func (bs BankService) GetOfficialBanks(ctx context.Context) domain.OfficialBanks {
	return domain.NewOfficialBanks(enums.OfficialBanks)
}
