package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
)

type AccountService struct {
	repo    port.AccountRepository
	trxRepo port.TransactionRepository
}

func NewAccountService(
	repo port.AccountRepository,
	trxRepo port.TransactionRepository,
) *AccountService {
	return &AccountService{
		repo:    repo,
		trxRepo: trxRepo,
	}
}

func (as *AccountService) CreateAccount(ctx context.Context, account *domain.Account) error {
	account.UpdateCreditInitialBalance()

	if account.Currency != "" && !domain.IsCurrencyCode(account.Currency) {
		return domain.ErrInvalidCurrency
	}

	err := as.repo.CreateAccount(ctx, account)
	if err != nil {
		return err
	}

	return nil
}

func (as *AccountService) GetAccount(ctx context.Context, userID string, id uint64) (*domain.Account, error) {
	account, err := as.repo.GetAccount(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	return account, nil
}

func (as *AccountService) GetAccounts(ctx context.Context, userID string, skip, limit uint64, filter string) ([]domain.Account, error) {
	accountTypes := domain.GetTypesToFilter(filter)

	accounts, err := as.repo.GetAccountsList(ctx, userID, skip, limit, accountTypes)
	if err != nil {
		return nil, err
	}

	return accounts, nil
}

func (as *AccountService) UpdateAccount(ctx context.Context, account *domain.Account) error {
	account.UpdateCreditInitialBalance()

	actualAccount, err := as.repo.GetAccount(ctx, account.UserID, account.ID)
	if err != nil {
		return err
	}

	if account.Currency != "" && !domain.IsCurrencyCode(account.Currency) {
		return domain.ErrInvalidCurrency
	}

	// the currency is fixed once the account has movements (changing it needs the migration wizard)
	if account.Currency != "" && account.Currency != actualAccount.Currency && actualAccount.HasTransactions {
		return domain.ErrAccountCurrencyLocked
	}

	if account.IsSame(actualAccount) || account.IsEmpty() {
		return domain.ErrNoUpdatedData
	}

	err = as.repo.UpdateAccount(ctx, account)
	if err != nil {
		return err
	}

	return nil
}

func (as *AccountService) DeleteAccount(ctx context.Context, userID string, id uint64) error {
	_, err := as.repo.GetAccount(ctx, userID, id)
	if err != nil {
		return err
	}

	return as.repo.DeleteAccount(ctx, userID, id)
}

func (as *AccountService) AdminGetAccounts(
	ctx context.Context,
	filters domain.AccountFilters,
) ([]domain.Account, error) {
	accounts, err := as.repo.AdminGetAccountsList(ctx, filters)
	if err != nil {
		return nil, err
	}

	return accounts, nil
}

func (as *AccountService) AdminGetAccountsByBank(
	ctx context.Context,
	filters domain.AccountFilters,
) ([]domain.BankAccountGroup, error) {
	groups, err := as.repo.AdminGetAccountsByBank(ctx, filters)
	if err != nil {
		return nil, err
	}

	return groups, nil
}

func (as *AccountService) CalculateInitialBalance(
	ctx context.Context,
	userID string,
	accountID uint64,
) (*domain.Account, error) {
	account, err := as.repo.GetAccount(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}

	filters := domain.TransactionFilters{
		UserID:  userID,
		Account: []uint64{account.ID},
	}

	transactions, err := as.trxRepo.ListTransactions(ctx, filters)
	if err != nil {
		return nil, err
	}

	account.CalculateInitialBalance(transactions)

	err = as.repo.UpdateAccount(ctx, account)
	if err != nil {
		return nil, err
	}

	return account, nil
}
