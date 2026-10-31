package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=credit_card.go -destination=mock/credit_card.go -package=mock

// CreditCardRepository stores the terms of credit cards and computes their status
type CreditCardRepository interface {
	// GetCreditCard returns the terms of a card of the user (empty terms when not set)
	GetCreditCard(ctx context.Context, userID string, accountID uint64) (*domain.CreditCardDetails, error)
	// SaveCreditCard creates or replaces the terms and makes sure the user has the system
	// categories for card charges (interest and fees)
	SaveCreditCard(ctx context.Context, details *domain.CreditCardDetails) error
	// ListCreditCardStatus returns every open card of the user today
	ListCreditCardStatus(ctx context.Context, userID string) ([]domain.CreditCardStatus, error)
	// ListCreditCardCycles returns the last statements of a card, oldest first
	ListCreditCardCycles(ctx context.Context, userID string, accountID uint64) ([]domain.CreditCardCycle, error)
}

// CreditCardService validates card terms and returns card status
type CreditCardService interface {
	GetCreditCard(ctx context.Context, userID string, accountID uint64) (*domain.CreditCardDetails, error)
	SaveCreditCard(ctx context.Context, details *domain.CreditCardDetails) error
	ListCreditCardStatus(ctx context.Context, userID string) ([]domain.CreditCardStatus, error)
	ListCreditCardCycles(ctx context.Context, userID string, accountID uint64) ([]domain.CreditCardCycle, error)
}
