package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=transaction.go -destination=mock/transaction.go -package=mock

// TransactionRepository is an interface for interacting with payment-related data
type TransactionRepository interface {
	// CreateTransaction inserts a new payment into the database
	CreateTransaction(ctx context.Context, transaction *domain.Transaction) (*domain.Transaction, error)
	// AdminCreateTransactions inserts a new transaction into the database
	// Transactions with SourceMessageID are idempotent and deduplicated against legacy ones
	AdminCreateTransactions(ctx context.Context, transactions []domain.Transaction) (*domain.AdminCreateResult, error)
	// GetTransactionByID selects a payment by id
	GetTransactionByID(ctx context.Context, userID string, id uint64) (*domain.Transaction, error)
	// ListTransactions selects a list of payments with pagination
	ListTransactions(ctx context.Context, filters domain.TransactionFilters) ([]domain.Transaction, error)
	// UpdateTransaction updates a payment
	UpdateTransaction(ctx context.Context, transaction *domain.Transaction) error
	// DeleteTransaction deletes a payment
	DeleteTransaction(ctx context.Context, id uint64, userID string) error
	// PredictTransactionCategory returns predicted category ids for given raw descriptions (raw_description -> category_id)
	PredictTransactionCategory(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver)
	// CreateTransfer stores both legs of a transfer with the same transfer_group_id
	CreateTransfer(ctx context.Context, transfer *domain.Transfer) error
	// LinkTransactions links two existing transactions (an expense and an income) as one transfer
	LinkTransactions(ctx context.Context, link *domain.TransferLink) error
	// CreateTransferCounterpart creates the missing leg of a transfer and links both
	CreateTransferCounterpart(ctx context.Context, link *domain.TransferLink) error
	// UnlinkTransfer turns both legs of a transfer back into ordinary transactions
	UnlinkTransfer(ctx context.Context, userID, groupID string) error
	// ListTransferCandidates returns pairs of transactions that look like transfers
	ListTransferCandidates(ctx context.Context, userID string, limit uint64) ([]domain.TransferCandidate, error)
	// DismissTransferCandidate hides a candidate pair
	DismissTransferCandidate(ctx context.Context, userID string, outID, inID uint64) error
}

// TransactionService is an interface for interacting with payment-related business logic
type TransactionService interface {
	// CreateTransaction creates a new transaction
	CreateTransaction(ctx context.Context, transaction *domain.Transaction) error
	// AdminCreateTransactions creates a new transaction by admin
	AdminCreateTransactions(ctx context.Context, userID string, transactions domain.Transactions) (*domain.AdminCreateResult, error)
	// GetTransaction returns a payment by id
	GetTransaction(ctx context.Context, userID string, id uint64) (*domain.Transaction, error)
	// ListTransactions returns a list of payments with pagination
	ListTransactions(ctx context.Context, filters domain.TransactionFilters) ([]domain.Transaction, error)
	// UpdateTransaction updates a payment
	UpdateTransaction(ctx context.Context, transaction *domain.Transaction) error
	// DeleteTransaction deletes a payment
	DeleteTransaction(ctx context.Context, userID string, id uint64) error
	// CreateTransfer moves money between two accounts of the user (possibly in different currencies)
	CreateTransfer(ctx context.Context, transfer *domain.Transfer) error
	// LinkTransfer marks a transaction as a transfer leg, linking it with an existing transaction or
	// creating the other leg
	LinkTransfer(ctx context.Context, link *domain.TransferLink) error
	// UnlinkTransfer turns both legs of a transfer back into ordinary transactions
	UnlinkTransfer(ctx context.Context, userID, groupID string) error
	// ListTransferCandidates returns pairs of transactions that look like transfers
	ListTransferCandidates(ctx context.Context, userID string, limit uint64) ([]domain.TransferCandidate, error)
	// DismissTransferCandidate hides a candidate pair
	DismissTransferCandidate(ctx context.Context, userID string, outID, inID uint64) error
}
