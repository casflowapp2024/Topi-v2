package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestAccountService_CreateAccount(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	tests := []struct {
		name        string
		account     *domain.Account
		setupMock   func()
		expectedErr error
	}{
		{
			name: "should create debit account successfully when valid data is provided",
			account: &domain.Account{
				UserID:         "user123",
				Name:           "Checking Account",
				LastFourDigits: "1234",
				InitialBalance: 1000.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   1,
					Name: "Checking",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateAccount(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should create credit account and adjust initial balance when positive balance on credit type",
			account: &domain.Account{
				UserID:         "user123",
				Name:           "Credit Card",
				LastFourDigits: "5678",
				InitialBalance: 500.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   4, // Credit card type (ID 4 based on CreditTypes)
					Name: "Credit Card",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateAccount(ctx, gomock.Any()).
					DoAndReturn(func(ctx context.Context, acc *domain.Account) error {
						// Verify that the initial balance was adjusted for credit type
						assert.Equal(t, -500.0, acc.InitialBalance)
						return nil
					}).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should return error when repository fails",
			account: &domain.Account{
				UserID:         "user123",
				Name:           "Savings Account",
				LastFourDigits: "9012",
				InitialBalance: 2000.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   2,
					Name: "Savings",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateAccount(ctx, gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
		},
		{
			name:    "should handle account with empty fields when empty account is provided",
			account: &domain.Account{},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateAccount(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			err := service.CreateAccount(ctx, tt.account)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAccountService_GetAccount(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	expectedAccount := &domain.Account{
		ID:             1,
		UserID:         "user123",
		Name:           "Checking Account",
		LastFourDigits: "1234",
		InitialBalance: 1000.0,
		Bank: domain.Bank{
			ID:   1,
			Name: "Test Bank",
		},
		Type: domain.AccountType{
			ID:   1,
			Name: "Checking",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tests := []struct {
		name            string
		userID          string
		accountID       uint64
		setupMock       func()
		expectedAccount *domain.Account
		expectedErr     error
	}{
		{
			name:      "should return account successfully when account exists",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(expectedAccount, nil).
					Times(1)
			},
			expectedAccount: expectedAccount,
			expectedErr:     nil,
		},
		{
			name:      "should return error when account not found",
			userID:    "user123",
			accountID: 999,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedAccount: nil,
			expectedErr:     domain.ErrDataNotFound,
		},
		{
			name:      "should return error when userID is empty",
			userID:    "",
			accountID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "", uint64(1)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedAccount: nil,
			expectedErr:     domain.ErrDataNotFound,
		},
		{
			name:      "should return error when accountID is zero",
			userID:    "user123",
			accountID: 0,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(0)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedAccount: nil,
			expectedErr:     domain.ErrDataNotFound,
		},
		{
			name:      "should return error when repository fails",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedAccount: nil,
			expectedErr:     domain.ErrInternal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			account, err := service.GetAccount(ctx, tt.userID, tt.accountID)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
				assert.Nil(t, account)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedAccount, account)
			}
		})
	}
}

func TestAccountService_GetAccounts(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	expectedAccounts := []domain.Account{
		{
			ID:             1,
			UserID:         "user123",
			Name:           "Checking Account",
			LastFourDigits: "1234",
			InitialBalance: 1000.0,
			Bank: domain.Bank{
				ID:   1,
				Name: "Test Bank",
			},
			Type: domain.AccountType{
				ID:   1,
				Name: "Checking",
			},
		},
		{
			ID:             2,
			UserID:         "user123",
			Name:           "Savings Account",
			LastFourDigits: "5678",
			InitialBalance: 5000.0,
			Bank: domain.Bank{
				ID:   1,
				Name: "Test Bank",
			},
			Type: domain.AccountType{
				ID:   2,
				Name: "Savings",
			},
		},
	}

	tests := []struct {
		name             string
		userID           string
		skip             uint64
		limit            uint64
		filter           string
		setupMock        func()
		expectedAccounts []domain.Account
		expectedErr      error
	}{
		{
			name:   "should return accounts successfully when accounts exist",
			userID: "user123",
			skip:   0,
			limit:  10,
			filter: "",
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccountsList(ctx, "user123", uint64(0), uint64(10), gomock.Nil()).
					Return(expectedAccounts, nil).
					Times(1)
			},
			expectedAccounts: expectedAccounts,
			expectedErr:      nil,
		},
		{
			name:   "should return savings accounts when filter is 'savings'",
			userID: "user123",
			skip:   0,
			limit:  10,
			filter: "savings",
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccountsList(ctx, "user123", uint64(0), uint64(10), gomock.Any()).
					Return([]domain.Account{expectedAccounts[1]}, nil).
					Times(1)
			},
			expectedAccounts: []domain.Account{expectedAccounts[1]},
			expectedErr:      nil,
		},
		{
			name:   "should return empty list when no accounts exist",
			userID: "user123",
			skip:   0,
			limit:  10,
			filter: "",
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccountsList(ctx, "user123", uint64(0), uint64(10), gomock.Nil()).
					Return([]domain.Account{}, nil).
					Times(1)
			},
			expectedAccounts: []domain.Account{},
			expectedErr:      nil,
		},
		{
			name:   "should return error when repository fails",
			userID: "user123",
			skip:   0,
			limit:  10,
			filter: "",
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccountsList(ctx, "user123", uint64(0), uint64(10), gomock.Nil()).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedAccounts: nil,
			expectedErr:      domain.ErrInternal,
		},
		{
			name:   "should handle pagination with skip and limit",
			userID: "user123",
			skip:   10,
			limit:  5,
			filter: "",
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccountsList(ctx, "user123", uint64(10), uint64(5), gomock.Nil()).
					Return(expectedAccounts, nil).
					Times(1)
			},
			expectedAccounts: expectedAccounts,
			expectedErr:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			accounts, err := service.GetAccounts(ctx, tt.userID, tt.skip, tt.limit, tt.filter)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
				assert.Nil(t, accounts)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedAccounts, accounts)
			}
		})
	}
}

func TestAccountService_UpdateAccount(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	existingAccount := &domain.Account{
		ID:             1,
		UserID:         "user123",
		Name:           "Checking Account",
		LastFourDigits: "1234",
		InitialBalance: 1000.0,
		Bank: domain.Bank{
			ID:   1,
			Name: "Test Bank",
		},
		Type: domain.AccountType{
			ID:   1,
			Name: "Checking",
		},
	}

	tests := []struct {
		name        string
		account     *domain.Account
		setupMock   func()
		expectedErr error
	}{
		{
			name: "should update account successfully when valid changes are provided",
			account: &domain.Account{
				ID:             1,
				UserID:         "user123",
				Name:           "Updated Checking Account",
				LastFourDigits: "1234",
				InitialBalance: 1500.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   1,
					Name: "Checking",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateAccount(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should update credit account and adjust initial balance when positive balance on credit type",
			account: &domain.Account{
				ID:             1,
				UserID:         "user123",
				Name:           "Credit Card",
				LastFourDigits: "5678",
				InitialBalance: 500.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   4, // Credit card type (ID 4 based on CreditTypes)
					Name: "Credit Card",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateAccount(ctx, gomock.Any()).
					DoAndReturn(func(ctx context.Context, acc *domain.Account) error {
						// Verify that the initial balance was adjusted for credit type
						assert.Equal(t, -500.0, acc.InitialBalance)
						return nil
					}).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name:    "should return error when no changes are detected",
			account: existingAccount,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
			},
			expectedErr: domain.ErrNoUpdatedData,
		},
		{
			name: "should return error when account has empty fields",
			account: &domain.Account{
				ID:             1,
				UserID:         "user123",
				Name:           "",
				LastFourDigits: "",
				InitialBalance: 1000.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   1,
					Name: "Checking",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
			},
			expectedErr: domain.ErrNoUpdatedData,
		},
		{
			name: "should return error when account not found",
			account: &domain.Account{
				ID:             999,
				UserID:         "user123",
				Name:           "Updated Account",
				LastFourDigits: "1234",
				InitialBalance: 1500.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   1,
					Name: "Checking",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name: "should return error when repository update fails",
			account: &domain.Account{
				ID:             1,
				UserID:         "user123",
				Name:           "Updated Checking Account",
				LastFourDigits: "1234",
				InitialBalance: 1500.0,
				Bank: domain.Bank{
					ID:   1,
					Name: "Test Bank",
				},
				Type: domain.AccountType{
					ID:   1,
					Name: "Checking",
				},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateAccount(ctx, gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			err := service.UpdateAccount(ctx, tt.account)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAccountService_DeleteAccount(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	existingAccount := &domain.Account{
		ID:             1,
		UserID:         "user123",
		Name:           "Checking Account",
		LastFourDigits: "1234",
		InitialBalance: 1000.0,
		Bank: domain.Bank{
			ID:   1,
			Name: "Test Bank",
		},
		Type: domain.AccountType{
			ID:   1,
			Name: "Checking",
		},
	}

	tests := []struct {
		name        string
		userID      string
		accountID   uint64
		setupMock   func()
		expectedErr error
	}{
		{
			name:      "should delete account successfully when account exists",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
				mockRepo.EXPECT().
					DeleteAccount(ctx, "user123", uint64(1)).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name:      "should return error when account not found",
			userID:    "user123",
			accountID: 999,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name:      "should return error when repository delete fails",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(existingAccount, nil).
					Times(1)
				mockRepo.EXPECT().
					DeleteAccount(ctx, "user123", uint64(1)).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
		},
		{
			name:      "should return error when userID is empty",
			userID:    "",
			accountID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "", uint64(1)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name:      "should return error when accountID is zero",
			userID:    "user123",
			accountID: 0,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(0)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			err := service.DeleteAccount(ctx, tt.userID, tt.accountID)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAccountService_AdminGetAccounts(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	expectedAccounts := []domain.Account{
		{
			ID:             1,
			UserID:         "user123",
			Name:           "Checking Account",
			LastFourDigits: "1234",
			InitialBalance: 1000.0,
			Bank: domain.Bank{
				ID:   1,
				Name: "Test Bank",
			},
			Type: domain.AccountType{
				ID:   1,
				Name: "Checking",
			},
		},
		{
			ID:             2,
			UserID:         "user456",
			Name:           "Savings Account",
			LastFourDigits: "5678",
			InitialBalance: 5000.0,
			Bank: domain.Bank{
				ID:   2,
				Name: "Another Bank",
			},
			Type: domain.AccountType{
				ID:   2,
				Name: "Savings",
			},
		},
	}

	tests := []struct {
		name             string
		filters          domain.AccountFilters
		setupMock        func()
		expectedAccounts []domain.Account
		expectedErr      error
	}{
		{
			name: "should return all accounts successfully when valid filters are provided",
			filters: domain.AccountFilters{
				Skip:  0,
				Limit: 10,
				IDs:   []uint64{1, 2},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					AdminGetAccountsList(ctx, gomock.Any()).
					Return(expectedAccounts, nil).
					Times(1)
			},
			expectedAccounts: expectedAccounts,
			expectedErr:      nil,
		},
		{
			name: "should return empty list when no accounts match filters",
			filters: domain.AccountFilters{
				Skip:  0,
				Limit: 10,
				IDs:   []uint64{999},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					AdminGetAccountsList(ctx, gomock.Any()).
					Return([]domain.Account{}, nil).
					Times(1)
			},
			expectedAccounts: []domain.Account{},
			expectedErr:      nil,
		},
		{
			name: "should return error when repository fails",
			filters: domain.AccountFilters{
				Skip:  0,
				Limit: 10,
				IDs:   []uint64{1, 2},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					AdminGetAccountsList(ctx, gomock.Any()).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedAccounts: nil,
			expectedErr:      domain.ErrInternal,
		},
		{
			name: "should handle pagination with skip and limit",
			filters: domain.AccountFilters{
				Skip:  10,
				Limit: 5,
				IDs:   nil,
			},
			setupMock: func() {
				mockRepo.EXPECT().
					AdminGetAccountsList(ctx, gomock.Any()).
					Return(expectedAccounts, nil).
					Times(1)
			},
			expectedAccounts: expectedAccounts,
			expectedErr:      nil,
		},
		{
			name: "should handle empty filters",
			filters: domain.AccountFilters{
				Skip:  0,
				Limit: 0,
				IDs:   nil,
			},
			setupMock: func() {
				mockRepo.EXPECT().
					AdminGetAccountsList(ctx, gomock.Any()).
					Return(expectedAccounts, nil).
					Times(1)
			},
			expectedAccounts: expectedAccounts,
			expectedErr:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			accounts, err := service.AdminGetAccounts(ctx, tt.filters)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
				assert.Nil(t, accounts)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedAccounts, accounts)
			}
		})
	}
}

func TestAccountService_CalculateInitialBalance(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockAccountRepository(ctrl)
	mockTrxRepo := mock.NewMockTransactionRepository(ctrl)
	service := NewAccountService(mockRepo, mockTrxRepo)
	ctx := context.Background()

	transactions := []domain.Transaction{
		{
			ID:          1,
			UserID:      "user123",
			Description: "Salary",
			Expense:     false,
			Amount:      5000.0,
			Date:        time.Now().AddDate(0, 0, -5),
			Account: domain.Account{
				ID: 1,
			},
		},
		{
			ID:          2,
			UserID:      "user123",
			Description: "Groceries",
			Expense:     true,
			Amount:      200.0,
			Date:        time.Now().AddDate(0, 0, -3),
			Account: domain.Account{
				ID: 1,
			},
		},
		{
			ID:          3,
			UserID:      "user123",
			Description: "Rent",
			Expense:     true,
			Amount:      1500.0,
			Date:        time.Now().AddDate(0, 0, -1),
			Account: domain.Account{
				ID: 1,
			},
		},
	}

	tests := []struct {
		name        string
		userID      string
		accountID   uint64
		setupMock   func()
		expectedErr error
		validate    func(t *testing.T, result *domain.Account)
	}{
		{
			name:      "should calculate initial balance successfully with transactions",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				account := &domain.Account{
					ID:             1,
					UserID:         "user123",
					Name:           "Checking Account",
					LastFourDigits: "1234",
					InitialBalance: 1000.0,
					Bank: domain.Bank{
						ID:   1,
						Name: "Test Bank",
					},
					Type: domain.AccountType{
						ID:   1,
						Name: "Checking",
					},
				}
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(account, nil).
					Times(1)
				mockTrxRepo.EXPECT().
					ListTransactions(ctx, gomock.Any()).
					DoAndReturn(func(ctx context.Context, filters domain.TransactionFilters) ([]domain.Transaction, error) {
						assert.Equal(t, "user123", filters.UserID)
						assert.Equal(t, []uint64{1}, filters.Account)
						return transactions, nil
					}).
					Times(1)
				mockRepo.EXPECT().
					UpdateAccount(ctx, gomock.Any()).
					DoAndReturn(func(ctx context.Context, acc *domain.Account) error {
						// Net flow: +5000 -200 -1500 = +3300
						// Initial: 1000 + 3300 = 4300
						assert.Equal(t, 4300.0, acc.InitialBalance)
						return nil
					}).
					Times(1)
			},
			expectedErr: nil,
			validate: func(t *testing.T, result *domain.Account) {
				assert.NotNil(t, result)
				assert.Equal(t, 4300.0, result.InitialBalance)
			},
		},
		{
			name:      "should handle account with no transactions",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				account := &domain.Account{
					ID:             1,
					UserID:         "user123",
					Name:           "Checking Account",
					LastFourDigits: "1234",
					InitialBalance: 1000.0,
					Bank: domain.Bank{
						ID:   1,
						Name: "Test Bank",
					},
					Type: domain.AccountType{
						ID:   1,
						Name: "Checking",
					},
				}
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(account, nil).
					Times(1)
				mockTrxRepo.EXPECT().
					ListTransactions(ctx, gomock.Any()).
					Return([]domain.Transaction{}, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateAccount(ctx, gomock.Any()).
					DoAndReturn(func(ctx context.Context, acc *domain.Account) error {
						// No transactions, balance should remain the same
						assert.Equal(t, 1000.0, acc.InitialBalance)
						return nil
					}).
					Times(1)
			},
			expectedErr: nil,
			validate: func(t *testing.T, result *domain.Account) {
				assert.NotNil(t, result)
				assert.Equal(t, 1000.0, result.InitialBalance)
			},
		},
		{
			name:      "should return error when account not found",
			userID:    "user123",
			accountID: 999,
			setupMock: func() {
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
			validate: func(t *testing.T, result *domain.Account) {
				assert.Nil(t, result)
			},
		},
		{
			name:      "should return error when transaction repository fails",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				account := &domain.Account{
					ID:             1,
					UserID:         "user123",
					Name:           "Checking Account",
					LastFourDigits: "1234",
					InitialBalance: 1000.0,
					Bank: domain.Bank{
						ID:   1,
						Name: "Test Bank",
					},
					Type: domain.AccountType{
						ID:   1,
						Name: "Checking",
					},
				}
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(account, nil).
					Times(1)
				mockTrxRepo.EXPECT().
					ListTransactions(ctx, gomock.Any()).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
			validate: func(t *testing.T, result *domain.Account) {
				assert.Nil(t, result)
			},
		},
		{
			name:      "should return error when update fails",
			userID:    "user123",
			accountID: 1,
			setupMock: func() {
				account := &domain.Account{
					ID:             1,
					UserID:         "user123",
					Name:           "Checking Account",
					LastFourDigits: "1234",
					InitialBalance: 1000.0,
					Bank: domain.Bank{
						ID:   1,
						Name: "Test Bank",
					},
					Type: domain.AccountType{
						ID:   1,
						Name: "Checking",
					},
				}
				mockRepo.EXPECT().
					GetAccount(ctx, "user123", uint64(1)).
					Return(account, nil).
					Times(1)
				mockTrxRepo.EXPECT().
					ListTransactions(ctx, gomock.Any()).
					Return(transactions, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateAccount(ctx, gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
			validate: func(t *testing.T, result *domain.Account) {
				assert.Nil(t, result)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			result, err := service.CalculateInitialBalance(ctx, tt.userID, tt.accountID)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}

			if tt.validate != nil {
				tt.validate(t, result)
			}
		})
	}
}
