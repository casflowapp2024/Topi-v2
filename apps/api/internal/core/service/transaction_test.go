package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestTransactionService_CreateTransaction(t *testing.T) {
	type args struct {
		ctx         context.Context
		transaction *domain.Transaction
	}

	// Create sample transactions for testing
	validTransaction := &domain.Transaction{
		ID:          1,
		UserID:      "user123",
		Description: "Test transaction",
		Expense:     true,
		Amount:      100.50,
		Date:        time.Now(),
		Category: domain.Category{
			ID:   1,
			Name: "Food",
		},
		Account: domain.Account{
			ID:   1,
			Name: "Checking",
		},
		Automated:    false,
		ShouldVerify: false,
		Checked:      false,
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockTransactionRepository)
		wantErr   bool
	}{
		{
			name: "should create transaction successfully when valid transaction is provided",
			args: args{
				ctx:         context.Background(),
				transaction: validTransaction,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().CreateTransaction(gomock.Any(), validTransaction).Return(validTransaction, nil)
			},
			wantErr: false,
		},
		{
			name: "should return error when repository fails with internal error",
			args: args{
				ctx:         context.Background(),
				transaction: validTransaction,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().CreateTransaction(gomock.Any(), validTransaction).Return(nil, domain.ErrInternal)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create mocks
			mockRepo := mock.NewMockTransactionRepository(ctrl)
			mockUserSvc := mock.NewMockUserService(ctrl)
			mockCategorySvc := mock.NewMockCategoryService(ctrl)

			// Setup mock expectations
			tt.mockSetup(mockRepo)

			// Create service instance
			svc := NewTransactionService(mockRepo, mockUserSvc, mockCategorySvc)

			// Execute the method under test
			err := svc.CreateTransaction(tt.args.ctx, tt.args.transaction)

			// Assert results
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTransactionService_GetTransaction(t *testing.T) {
	type args struct {
		ctx    context.Context
		userID string
		id     uint64
	}

	// Create sample transaction for testing
	validTransaction := &domain.Transaction{
		ID:          1,
		UserID:      "user123",
		Description: "Test transaction",
		Expense:     true,
		Amount:      100.50,
		Date:        time.Now(),
		Category: domain.Category{
			ID:   1,
			Name: "Food",
		},
		Account: domain.Account{
			ID:   1,
			Name: "Checking",
		},
		Automated:    false,
		ShouldVerify: false,
		Checked:      false,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockTransactionRepository)
		want      *domain.Transaction
		wantErr   bool
	}{
		{
			name: "should return transaction successfully when valid userID and id are provided",
			args: args{
				ctx:    context.Background(),
				userID: "user123",
				id:     1,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().GetTransactionByID(gomock.Any(), "user123", uint64(1)).
					Return(validTransaction, nil)
			},
			want:    validTransaction,
			wantErr: false,
		},
		{
			name: "should return ErrDataNotFound when transaction does not exist",
			args: args{
				ctx:    context.Background(),
				userID: "user123",
				id:     999,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().GetTransactionByID(gomock.Any(), "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound)
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return ErrInternal when repository fails with internal error",
			args: args{
				ctx:    context.Background(),
				userID: "user123",
				id:     1,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().GetTransactionByID(gomock.Any(), "user123", uint64(1)).
					Return(nil, errors.New("database connection failed"))
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create mocks
			mockRepo := mock.NewMockTransactionRepository(ctrl)
			mockUserSvc := mock.NewMockUserService(ctrl)
			mockCategorySvc := mock.NewMockCategoryService(ctrl)

			// Setup mock expectations
			tt.mockSetup(mockRepo)

			// Create service instance
			svc := NewTransactionService(mockRepo, mockUserSvc, mockCategorySvc)

			// Execute the method under test
			got, err := svc.GetTransaction(tt.args.ctx, tt.args.userID, tt.args.id)

			// Assert results
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, got)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestTransactionService_ListTransactions(t *testing.T) {
	type args struct {
		ctx     context.Context
		filters domain.TransactionFilters
	}

	// Create sample transactions for testing
	sampleTransactions := []domain.Transaction{
		{
			ID:          1,
			UserID:      "user123",
			Description: "Grocery shopping",
			Expense:     true,
			Amount:      150.75,
			Date:        time.Date(2025, 9, 1, 10, 0, 0, 0, time.UTC),
			Category: domain.Category{
				ID:   1,
				Name: "Food",
			},
			Account: domain.Account{
				ID:   1,
				Name: "Checking",
			},
		},
		{
			ID:          2,
			UserID:      "user123",
			Description: "Salary payment",
			Expense:     false,
			Amount:      3000.00,
			Date:        time.Date(2025, 9, 2, 9, 0, 0, 0, time.UTC),
			Category: domain.Category{
				ID:   2,
				Name: "Income",
			},
			Account: domain.Account{
				ID:   2,
				Name: "Savings",
			},
		},
	}

	// Create various filter scenarios
	basicFilters := domain.TransactionFilters{
		UserID: "user123",
		Skip:   0,
		Limit:  10,
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockTransactionRepository)
		want      []domain.Transaction
		wantErr   bool
	}{
		{
			name: "should return transactions successfully when valid filters are provided",
			args: args{
				ctx:     context.Background(),
				filters: basicFilters,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().ListTransactions(gomock.Any(), basicFilters).Return(sampleTransactions, nil)
			},
			want:    sampleTransactions,
			wantErr: false,
		},
		{
			name: "should return empty slice when no transactions match filters",
			args: args{
				ctx:     context.Background(),
				filters: basicFilters,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().ListTransactions(gomock.Any(), basicFilters).Return([]domain.Transaction{}, nil)
			},
			want:    []domain.Transaction{},
			wantErr: false,
		},
		{
			name: "should return error when repository fails with database error",
			args: args{
				ctx:     context.Background(),
				filters: basicFilters,
			},
			mockSetup: func(m *mock.MockTransactionRepository) {
				m.EXPECT().ListTransactions(gomock.Any(), basicFilters).
					Return(nil, errors.New("database connection failed"))
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create mocks
			mockRepo := mock.NewMockTransactionRepository(ctrl)
			mockUserSvc := mock.NewMockUserService(ctrl)
			mockCategorySvc := mock.NewMockCategoryService(ctrl)

			// Setup mock expectations
			tt.mockSetup(mockRepo)

			// Create service instance
			svc := NewTransactionService(mockRepo, mockUserSvc, mockCategorySvc)

			// Execute the method under test
			got, err := svc.ListTransactions(tt.args.ctx, tt.args.filters)

			// Assert results
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, got)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestTransactionService_UpdateTransaction(t *testing.T) {
	type args struct {
		ctx         context.Context
		transaction *domain.Transaction
	}

	// Create sample transactions for testing
	existingTransaction := &domain.Transaction{
		ID:          1,
		UserID:      "user123",
		Description: "Original transaction",
		Expense:     true,
		Amount:      100.50,
		Date:        time.Date(2025, 9, 1, 10, 0, 0, 0, time.UTC),
		Category: domain.Category{
			ID:   1,
			Name: "Food",
		},
		Account: domain.Account{
			ID:   1,
			Name: "Checking",
		},
		Automated:    false,
		ShouldVerify: false,
		Checked:      false,
		CreatedAt:    time.Date(2025, 9, 1, 9, 0, 0, 0, time.UTC),
		UpdatedAt:    time.Date(2025, 9, 1, 9, 0, 0, 0, time.UTC),
	}

	updatedTransaction := &domain.Transaction{
		ID:          1,
		UserID:      "user123",
		Description: "Updated transaction description",
		Expense:     true,
		Amount:      150.75,
		Date:        time.Date(2025, 9, 2, 10, 0, 0, 0, time.UTC),
		Category: domain.Category{
			ID:   2,
			Name: "Entertainment",
		},
		Account: domain.Account{
			ID:   2,
			Name: "Savings",
		},
		Automated:    false,
		ShouldVerify: false,
		Checked:      false,
	}

	identicalTransaction := &domain.Transaction{
		ID:          1,
		UserID:      "user123",
		Description: "Original transaction",
		Expense:     true,
		Amount:      100.50,
		Date:        time.Date(2025, 9, 1, 10, 0, 0, 0, time.UTC),
		Category: domain.Category{
			ID:   1,
			Name: "Food",
		},
		Account: domain.Account{
			ID:   1,
			Name: "Checking",
		},
		Automated:    false,
		ShouldVerify: false,
		Checked:      false,
	}

	tests := []struct {
		name          string
		args          args
		mockSetup     func(mockRepo *mock.MockTransactionRepository)
		wantErr       bool
		expectedError error
	}{
		{
			name: "should update transaction successfully when valid changes are provided",
			args: args{
				ctx:         context.Background(),
				transaction: updatedTransaction,
			},
			mockSetup: func(mockRepo *mock.MockTransactionRepository) {
				mockRepo.EXPECT().GetTransactionByID(gomock.Any(), "user123", uint64(1)).Return(existingTransaction, nil)
				mockRepo.EXPECT().UpdateTransaction(gomock.Any(), updatedTransaction).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "should return ErrNoUpdatedData when transaction has no changes",
			args: args{
				ctx:         context.Background(),
				transaction: identicalTransaction,
			},
			mockSetup: func(mockRepo *mock.MockTransactionRepository) {
				mockRepo.EXPECT().GetTransactionByID(gomock.Any(), "user123", uint64(1)).Return(existingTransaction, nil)
				// No call to UpdateTransaction expected since no changes detected
			},
			wantErr:       true,
			expectedError: domain.ErrNoUpdatedData,
		},
		{
			name: "should return ErrDataNotFound when transaction does not exist",
			args: args{
				ctx:         context.Background(),
				transaction: updatedTransaction,
			},
			mockSetup: func(mockRepo *mock.MockTransactionRepository) {
				mockRepo.EXPECT().GetTransactionByID(gomock.Any(), "user123", uint64(1)).Return(nil, domain.ErrDataNotFound)
				// No call to UpdateTransaction expected since transaction not found
			},
			wantErr:       true,
			expectedError: domain.ErrDataNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create mocks
			mockRepo := mock.NewMockTransactionRepository(ctrl)
			mockUserSvc := mock.NewMockUserService(ctrl)
			mockCategorySvc := mock.NewMockCategoryService(ctrl)

			// Setup mock expectations
			tt.mockSetup(mockRepo)

			// Create service instance
			svc := NewTransactionService(mockRepo, mockUserSvc, mockCategorySvc)

			// Execute the method under test
			err := svc.UpdateTransaction(tt.args.ctx, tt.args.transaction)

			// Assert results
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.Equal(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTransactionService_DeleteTransaction(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockTransactionRepository(ctrl)
	mockUserSvc := mock.NewMockUserService(ctrl)
	mockCategorySvc := mock.NewMockCategoryService(ctrl)

	svc := NewTransactionService(mockRepo, mockUserSvc, mockCategorySvc)
	ctx := context.Background()

	testCases := []struct {
		name        string
		userID      string
		id          uint64
		setupMocks  func()
		expectedErr error
	}{
		{
			name:   "should delete transaction successfully when valid userID and id are provided",
			userID: "user123",
			id:     uint64(1),
			setupMocks: func() {
				mockRepo.EXPECT().
					GetTransactionByID(ctx, "user123", uint64(1)).
					Return(&domain.Transaction{ID: 1, UserID: "user123"}, nil)
				mockRepo.EXPECT().
					DeleteTransaction(ctx, uint64(1), "user123").
					Return(nil)
			},
			expectedErr: nil,
		},
		{
			name:   "should return ErrDataNotFound when transaction does not exist",
			userID: "user123",
			id:     uint64(999),
			setupMocks: func() {
				mockRepo.EXPECT().
					GetTransactionByID(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name:   "should return error when GetTransactionByID fails with database error",
			userID: "user123",
			id:     uint64(1),
			setupMocks: func() {
				mockRepo.EXPECT().
					GetTransactionByID(ctx, "user123", uint64(1)).
					Return(nil, errors.New("database connection failed"))
			},
			expectedErr: errors.New("database connection failed"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.setupMocks()

			err := svc.DeleteTransaction(ctx, tc.userID, tc.id)

			if tc.expectedErr != nil {
				assert.Error(t, err)
				if errors.Is(tc.expectedErr, domain.ErrDataNotFound) {
					assert.True(t, errors.Is(err, domain.ErrDataNotFound))
				} else if errors.Is(tc.expectedErr, domain.ErrInternal) {
					assert.True(t, errors.Is(err, domain.ErrInternal))
				} else {
					assert.Equal(t, tc.expectedErr.Error(), err.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTransactionService_AdminCreateTransactions(t *testing.T) {
	type args struct {
		ctx          context.Context
		userID       string
		transactions domain.Transactions
	}

	// Sample data for testing
	validUserID := "admin123"
	validTransactions := domain.Transactions{
		{
			UserID:      validUserID,
			Description: "Grocery store purchase",
			Expense:     true,
			Amount:      75.50,
			Date:        time.Now(),
			Category:    domain.Category{ID: 0}, // Will be updated by category prediction
			Account:     domain.Account{ID: 1, Name: "Checking"},
		},
		{
			UserID:      validUserID,
			Description: "Gas station",
			Expense:     true,
			Amount:      45.00,
			Date:        time.Now(),
			Category:    domain.Category{ID: 0}, // Will be updated by category prediction
			Account:     domain.Account{ID: 1, Name: "Checking"},
		},
	}

	createdTransactions := []domain.Transaction{
		{
			ID:          1,
			UserID:      validUserID,
			Description: "Grocery store purchase",
			Expense:     true,
			Amount:      75.50,
			Date:        time.Now(),
			Category:    domain.Category{ID: 2, Name: "Food"},
			Account:     domain.Account{ID: 1, Name: "Checking"},
		},
		{
			ID:          2,
			UserID:      validUserID,
			Description: "Gas station",
			Expense:     true,
			Amount:      45.00,
			Date:        time.Now(),
			Category:    domain.Category{ID: 3, Name: "Transportation"},
			Account:     domain.Account{ID: 1, Name: "Checking"},
		},
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(
			mockRepo *mock.MockTransactionRepository,
			mockUserSvc *mock.MockUserService,
			mockCategorySvc *mock.MockCategoryService,
		)
		expectedResult *domain.AdminCreateResult
		expectedError  error
		wantErr        bool
	}{
		{
			name: "should create transactions successfully when user is verified and all services work correctly",
			args: args{
				ctx:          context.Background(),
				userID:       validUserID,
				transactions: validTransactions,
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				// User validation
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				// Category prediction - setup goroutine expectation
				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						// Simulate successful prediction
						cpr.PredictionsMap["Grocery store purchase"] = 2
						cpr.PredictionsMap["Gas station"] = 3
						cpr.PredictionErr = nil
						cpr.Wg.Done()
					})

				// Default category retrieval - setup goroutine expectation
				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryID = 1
						cpr.DefaultCategoryErr = nil
						cpr.Wg.Done()
					})

				// Admin create transactions
				mockRepo.EXPECT().AdminCreateTransactions(gomock.Any(), gomock.Any()).Return(&domain.AdminCreateResult{Created: createdTransactions}, nil)
				// a failed link does not fail the batch: the payment waits for the user
				mockRepo.EXPECT().LinkPendingCardPayments(gomock.Any(), validUserID).Return(0, errors.New("boom"))
			},
			expectedResult: &domain.AdminCreateResult{Created: createdTransactions},
			expectedError:  nil,
			wantErr:        false,
		},
		{
			name: "should return error when user validation fails with service error",
			args: args{
				ctx:          context.Background(),
				userID:       "invalid-user",
				transactions: validTransactions,
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), "invalid-user").Return(false, domain.ErrInternal)
			},
			expectedResult: nil,
			expectedError:  domain.ErrInternal,
			wantErr:        true,
		},
		{
			name: "should return error when user is not verified",
			args: args{
				ctx:          context.Background(),
				userID:       "unverified-user",
				transactions: validTransactions,
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), "unverified-user").Return(false, nil)
			},
			expectedResult: nil,
			expectedError:  domain.ErrUserNotConfirmedException,
			wantErr:        true,
		},
		{
			name: "should return error when category prediction fails",
			args: args{
				ctx:          context.Background(),
				userID:       validUserID,
				transactions: validTransactions,
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						cpr.PredictionErr = domain.ErrInternal
						cpr.Wg.Done()
					})

				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryID = 1
						cpr.DefaultCategoryErr = nil
						cpr.Wg.Done()
					})
			},
			expectedResult: nil,
			expectedError:  domain.ErrInternal,
			wantErr:        true,
		},
		{
			name: "should return error when default category retrieval fails",
			args: args{
				ctx:          context.Background(),
				userID:       validUserID,
				transactions: validTransactions,
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						cpr.PredictionsMap["Grocery store purchase"] = 2
						cpr.PredictionErr = nil
						cpr.Wg.Done()
					})

				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryErr = domain.ErrDataNotFound
						cpr.Wg.Done()
					})
			},
			expectedResult: nil,
			expectedError:  domain.ErrDataNotFound,
			wantErr:        true,
		},
		{
			name: "should return error when repository create fails",
			args: args{
				ctx:          context.Background(),
				userID:       validUserID,
				transactions: validTransactions,
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						cpr.PredictionsMap["Grocery store purchase"] = 2
						cpr.PredictionsMap["Gas station"] = 3
						cpr.PredictionErr = nil
						cpr.Wg.Done()
					})

				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryID = 1
						cpr.DefaultCategoryErr = nil
						cpr.Wg.Done()
					})

				mockRepo.EXPECT().AdminCreateTransactions(gomock.Any(), gomock.Any()).
					Return(nil, domain.ErrInternal)
			},
			expectedResult: nil,
			expectedError:  domain.ErrInternal,
			wantErr:        true,
		},
		{
			name: "should handle empty transactions gracefully",
			args: args{
				ctx:          context.Background(),
				userID:       validUserID,
				transactions: domain.Transactions{},
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						// Empty descriptions should result in empty predictions
						cpr.PredictionsMap = make(map[string]uint64)
						cpr.PredictionErr = nil
						cpr.Wg.Done()
					})

				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryID = 1
						cpr.DefaultCategoryErr = nil
						cpr.Wg.Done()
					})

				mockRepo.EXPECT().AdminCreateTransactions(gomock.Any(), gomock.Any()).
					Return(&domain.AdminCreateResult{}, nil)
			},
			expectedResult: &domain.AdminCreateResult{},
			expectedError:  nil,
			wantErr:        false,
		},
		{
			name: "should handle transactions with empty descriptions",
			args: args{
				ctx:    context.Background(),
				userID: validUserID,
				transactions: domain.Transactions{
					{
						UserID:      validUserID,
						Description: "", // Empty description
						Expense:     true,
						Amount:      50.00,
						Date:        time.Now(),
						Category:    domain.Category{ID: 0},
						Account:     domain.Account{ID: 1, Name: "Checking"},
					},
					{
						UserID:      validUserID,
						Description: "Valid description",
						Expense:     false,
						Amount:      100.00,
						Date:        time.Now(),
						Category:    domain.Category{ID: 0},
						Account:     domain.Account{ID: 1, Name: "Checking"},
					},
				},
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						// Only valid description should be in the list
						assert.Len(t, descriptions, 1)
						assert.Equal(t, "Valid description", descriptions[0])
						cpr.PredictionsMap["Valid description"] = 2
						cpr.PredictionErr = nil
						cpr.Wg.Done()
					})

				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryID = 1
						cpr.DefaultCategoryErr = nil
						cpr.Wg.Done()
					})

				mockRepo.EXPECT().AdminCreateTransactions(gomock.Any(), gomock.Any()).
					Return(&domain.AdminCreateResult{}, nil)
			},
			expectedResult: &domain.AdminCreateResult{},
			expectedError:  nil,
			wantErr:        false,
		},
		{
			name: "should handle duplicate descriptions in transactions",
			args: args{
				ctx:    context.Background(),
				userID: validUserID,
				transactions: domain.Transactions{
					{
						UserID:      validUserID,
						Description: "Duplicate description",
						Expense:     true,
						Amount:      50.00,
						Date:        time.Now(),
						Category:    domain.Category{ID: 0},
						Account:     domain.Account{ID: 1, Name: "Checking"},
					},
					{
						UserID:      validUserID,
						Description: "Duplicate description", // Same description
						Expense:     true,
						Amount:      75.00,
						Date:        time.Now(),
						Category:    domain.Category{ID: 0},
						Account:     domain.Account{ID: 1, Name: "Checking"},
					},
				},
			},
			mockSetup: func(
				mockRepo *mock.MockTransactionRepository,
				mockUserSvc *mock.MockUserService,
				mockCategorySvc *mock.MockCategoryService,
			) {
				mockUserSvc.EXPECT().AdminIsUserValid(gomock.Any(), validUserID).Return(true, nil)

				mockRepo.EXPECT().PredictTransactionCategory(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, descriptions []string, cpr *domain.CategoryPredictionResolver) {
						// Should only have one unique description
						assert.Len(t, descriptions, 1)
						assert.Equal(t, "Duplicate description", descriptions[0])
						cpr.PredictionsMap["Duplicate description"] = 2
						cpr.PredictionErr = nil
						cpr.Wg.Done()
					})

				mockCategorySvc.EXPECT().GetDefaultCategory(gomock.Any(), gomock.Any()).
					Do(func(ctx context.Context, cpr *domain.CategoryPredictionResolver) {
						cpr.DefaultCategoryID = 1
						cpr.DefaultCategoryErr = nil
						cpr.Wg.Done()
					})

				mockRepo.EXPECT().AdminCreateTransactions(gomock.Any(), gomock.Any()).
					Return(&domain.AdminCreateResult{}, nil)
			},
			expectedResult: &domain.AdminCreateResult{},
			expectedError:  nil,
			wantErr:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// Create mocks
			mockRepo := mock.NewMockTransactionRepository(ctrl)
			mockUserSvc := mock.NewMockUserService(ctrl)
			mockCategorySvc := mock.NewMockCategoryService(ctrl)

			// Setup mock expectations
			tt.mockSetup(mockRepo, mockUserSvc, mockCategorySvc)

			// Create service instance
			svc := NewTransactionService(mockRepo, mockUserSvc, mockCategorySvc)

			// Execute the method under test
			result, err := svc.AdminCreateTransactions(tt.args.ctx, tt.args.userID, tt.args.transactions)

			// Assert results
			if tt.wantErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}
