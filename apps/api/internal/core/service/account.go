package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"log/slog"
)

// AccountReadRequester asks for the priority read ("leer ahora") of accounts linked to a connection. It is
// EmailService.ReadEmail, set with SetReadRequester because EmailService already depends on AccountService.
type AccountReadRequester interface {
	ReadEmail(ctx context.Context, userID string, accountIDs []uint64) (*domain.ReadEmailResponse, error)
}

type AccountService struct {
	repo    port.AccountRepository
	trxRepo port.TransactionRepository
	reader  AccountReadRequester
}

// SetReadRequester wires the priority read that follows linking an account to a connection (plan/30 bloque 1)
func (as *AccountService) SetReadRequester(reader AccountReadRequester) {
	as.reader = reader
}

// requestRead asks for the first read of a just linked account. Only healthy connections get a job (the query
// behind ReadEmail skips inactive or broken ones) and it never fails the account change.
func (as *AccountService) requestRead(ctx context.Context, account *domain.Account) {
	if as.reader == nil || account.Email.ID == nil || *account.Email.ID == 0 || account.ID == 0 {
		return
	}
	if _, err := as.reader.ReadEmail(context.WithoutCancel(ctx), account.UserID, []uint64{account.ID}); err != nil {
		slog.Error("account: could not request the read", "account_id", account.ID, "error", err)
	}
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

	as.requestRead(ctx, account)
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

	if account.ChangesReading(actualAccount) {
		as.requestRead(ctx, account)
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

// ListIdentifiers: the digits that recognise the account in bank emails (plan/32)
func (as *AccountService) ListIdentifiers(ctx context.Context, userID string, accountID uint64) ([]domain.AccountIdentifier, error) {
	if _, err := as.repo.GetAccount(ctx, userID, accountID); err != nil {
		return nil, err
	}
	return as.repo.ListIdentifiers(ctx, userID, accountID)
}

// AddIdentifier: the user adds digits to an account (an additional or renewed card). Investments are not
// recognised by digits. New digits can match emails already read, so a read is asked for.
func (as *AccountService) AddIdentifier(
	ctx context.Context, userID string, accountID uint64, digits string,
) (*domain.AccountIdentifier, error) {
	if !domain.IsAccountDigits(digits) {
		return nil, domain.ErrInvalidAccountDigits
	}
	account, err := as.repo.GetAccount(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}
	if account.Type.ClassOrDefault() == domain.AccountClassInvestment {
		return nil, domain.ErrInvestmentIdentifier
	}

	identifier := &domain.AccountIdentifier{
		UserID: userID, AccountID: accountID, Digits: digits, Source: domain.IdentifierSourceUser,
	}
	if err = as.repo.CreateIdentifier(ctx, identifier); err != nil {
		return nil, err
	}
	if identifier.AccountID != accountID {
		return nil, domain.ErrIdentifierTaken
	}

	as.requestRead(ctx, account)
	return identifier, nil
}

func (as *AccountService) DeleteIdentifier(ctx context.Context, userID string, accountID, id uint64) error {
	return as.repo.DeleteIdentifier(ctx, userID, accountID, id)
}
