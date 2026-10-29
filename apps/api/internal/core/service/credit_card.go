package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
)

// CreditCardService implements port.CreditCardService
type CreditCardService struct {
	repo port.CreditCardRepository
}

// NewCreditCardService creates a new credit card service instance
func NewCreditCardService(repo port.CreditCardRepository) *CreditCardService {
	return &CreditCardService{repo: repo}
}

func (cs *CreditCardService) GetCreditCard(ctx context.Context, userID string, accountID uint64) (*domain.CreditCardDetails, error) {
	return cs.repo.GetCreditCard(ctx, userID, accountID)
}

func (cs *CreditCardService) SaveCreditCard(ctx context.Context, details *domain.CreditCardDetails) error {
	if err := details.Validate(); err != nil {
		return err
	}
	return cs.repo.SaveCreditCard(ctx, details)
}

func (cs *CreditCardService) ListCreditCardStatus(ctx context.Context, userID string) ([]domain.CreditCardStatus, error) {
	return cs.repo.ListCreditCardStatus(ctx, userID)
}
