package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"log/slog"
	"sync"
)

// TransactionService implements port.TransactionService interface
// and provides access to the transaction repository
// and cache service
type TransactionService struct {
	repo        port.TransactionRepository
	userSvc     port.UserService
	categorySvc port.CategoryService
}

// NewTransactionService creates a new transaction service instance
func NewTransactionService(
	repo port.TransactionRepository,
	svc port.UserService,
	cSvc port.CategoryService,
) *TransactionService {
	return &TransactionService{
		repo,
		svc,
		cSvc,
	}
}

// CreateTransaction creates a new transaction
func (ts *TransactionService) CreateTransaction(ctx context.Context, transaction *domain.Transaction) error {
	_, err := ts.repo.CreateTransaction(ctx, transaction)
	if err != nil {
		return err
	}

	return nil
}

// GetTransaction retrieves a transaction by id
func (ts *TransactionService) GetTransaction(ctx context.Context, userID string, id uint64) (*domain.Transaction, error) {
	var transaction *domain.Transaction

	transaction, err := ts.repo.GetTransactionByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	return transaction, nil
}

// ListTransactions retrieves a list of transactions with pagination
func (ts *TransactionService) ListTransactions(
	ctx context.Context,
	filters domain.TransactionFilters,
) ([]domain.Transaction, error) {
	var transactions []domain.Transaction

	transactions, err := ts.repo.ListTransactions(ctx, filters)
	if err != nil {
		return nil, err
	}

	return transactions, nil
}

// UpdateTransaction updates a transaction record
func (ts *TransactionService) UpdateTransaction(ctx context.Context, transaction *domain.Transaction) error {
	actualTransaction, err := ts.repo.GetTransactionByID(ctx, transaction.UserID, transaction.ID)
	if err != nil {
		return err
	}

	if transaction.FxRate != nil && !transaction.FxRate.IsPositive() {
		return domain.ErrInvalidFxRate
	}

	if domain.IsSameTransaction(actualTransaction, transaction) {
		return domain.ErrNoUpdatedData
	}

	err = ts.repo.UpdateTransaction(ctx, transaction)
	if err != nil {
		return err
	}

	return nil
}

// CreateTransfer validates the transfer and stores both legs
func (ts *TransactionService) CreateTransfer(ctx context.Context, transfer *domain.Transfer) error {
	if err := transfer.Validate(); err != nil {
		return err
	}
	if transfer.Description == "" {
		transfer.Description = "Transferencia"
	}
	return ts.repo.CreateTransfer(ctx, transfer)
}

// MaxTransferCandidates caps the candidate pairs returned at once
const MaxTransferCandidates = 200

// LinkTransfer validates the link and either links two existing transactions or creates the
// missing leg
func (ts *TransactionService) LinkTransfer(ctx context.Context, link *domain.TransferLink) error {
	if err := link.Validate(); err != nil {
		return err
	}
	if link.CounterpartTransactionID != 0 {
		return ts.repo.LinkTransactions(ctx, link)
	}
	return ts.repo.CreateTransferCounterpart(ctx, link)
}

// DismissCounterpart stops asking for the other leg of a card payment
func (ts *TransactionService) DismissCounterpart(ctx context.Context, userID string, id uint64) error {
	return ts.repo.DismissCounterpart(ctx, userID, id)
}

// SuggestCounterpartAccount returns the account that most often paid into this one (nil if none)
func (ts *TransactionService) SuggestCounterpartAccount(ctx context.Context, userID string, id uint64) (*uint64, error) {
	return ts.repo.SuggestCounterpartAccount(ctx, userID, id)
}

// UnlinkTransfer turns both legs of a transfer back into ordinary transactions
func (ts *TransactionService) UnlinkTransfer(ctx context.Context, userID, groupID string) error {
	return ts.repo.UnlinkTransfer(ctx, userID, groupID)
}

// ListTransferCandidates returns at most limit candidate pairs (MaxTransferCandidates when 0 or more)
func (ts *TransactionService) ListTransferCandidates(
	ctx context.Context,
	userID string,
	limit uint64,
) ([]domain.TransferCandidate, error) {
	if limit == 0 || limit > MaxTransferCandidates {
		limit = MaxTransferCandidates
	}
	return ts.repo.ListTransferCandidates(ctx, userID, limit)
}

// DismissTransferCandidate hides a candidate pair so it is not proposed again
func (ts *TransactionService) DismissTransferCandidate(ctx context.Context, userID string, outID, inID uint64) error {
	if outID == 0 || inID == 0 || outID == inID {
		return domain.ErrInvalidTransfer
	}
	return ts.repo.DismissTransferCandidate(ctx, userID, outID, inID)
}

// DeleteTransaction deletes a transaction record
func (ts *TransactionService) DeleteTransaction(ctx context.Context, userID string, id uint64) error {
	_, err := ts.repo.GetTransactionByID(ctx, userID, id)
	if err != nil {
		return err
	}

	return ts.repo.DeleteTransaction(ctx, id, userID)
}

// AdminCreateTransactions creates a new transaction for an admin user
func (ts *TransactionService) AdminCreateTransactions(
	ctx context.Context,
	userID string,
	transactions domain.Transactions,
) (*domain.AdminCreateResult, error) {
	isVerified, err := ts.userSvc.AdminIsUserValid(ctx, userID)
	if err != nil {
		return nil, err
	}

	if !isVerified {
		return nil, domain.ErrUserNotConfirmedException
	}

	var (
		mu sync.Mutex
		wg sync.WaitGroup
	)

	wg.Add(2)

	descriptions := transactions.ExtractDescriptions()

	cpr := domain.NewCategoryPredictionResolver(userID, &mu, &wg)

	go ts.repo.PredictTransactionCategory(ctx, descriptions, cpr)

	go ts.categorySvc.GetDefaultCategory(ctx, cpr)

	wg.Wait()

	if cpr.PredictionErr != nil {
		return nil, cpr.PredictionErr
	}

	if cpr.DefaultCategoryErr != nil {
		return nil, cpr.DefaultCategoryErr
	}

	transactions.UpdateCategories(cpr.PredictionsMap, cpr.DefaultCategoryID)

	result, err := ts.repo.AdminCreateTransactions(ctx, transactions)
	if err != nil {
		return nil, err
	}

	// The transactions are stored: a failed link leaves the card payment waiting for the user
	if len(result.Created) > 0 {
		if _, lErr := ts.repo.LinkPendingCardPayments(ctx, userID); lErr != nil {
			slog.Error("linking pending card payments", "error", lErr)
		}
	}

	return result, nil
}
