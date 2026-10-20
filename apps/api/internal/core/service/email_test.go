package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
)

const (
	// Test URL constants for better readability
	gmailAuthURL   = "https://accounts.google.com/oauth2/auth?client_id=test&redirect_uri=test&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly"
	outlookAuthURL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test&response_type=code&redirect_uri=test&scope=https://graph.microsoft.com/mail.read"
)

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}

func TestEmailService_GetUserAuthURL(t *testing.T) {
	tests := []struct {
		name            string
		provider        string
		mockSetup       func(*mock.MockEmailAPI)
		expectedURL     *string
		expectedError   error
		shouldReturnURL bool
		shouldReturnErr bool
	}{
		{
			name:     "should return auth URL when provider is gmail",
			provider: "gmail",
			mockSetup: func(mockEmail *mock.MockEmailAPI) {
				mockEmail.EXPECT().GetAuthURL("gmail").Return(stringPtr(gmailAuthURL), nil)
			},
			expectedURL:     stringPtr(gmailAuthURL),
			expectedError:   nil,
			shouldReturnURL: true,
			shouldReturnErr: false,
		},
		{
			name:     "should return auth URL when provider is outlook",
			provider: "outlook",
			mockSetup: func(mockEmail *mock.MockEmailAPI) {
				mockEmail.EXPECT().GetAuthURL("outlook").Return(stringPtr(outlookAuthURL), nil)
			},
			expectedURL:     stringPtr(outlookAuthURL),
			expectedError:   nil,
			shouldReturnURL: true,
			shouldReturnErr: false,
		},
		{
			name:     "should return error when provider is invalid",
			provider: "invalid_provider",
			mockSetup: func(mockEmail *mock.MockEmailAPI) {
				mockEmail.EXPECT().GetAuthURL("invalid_provider").Return(nil, domain.ErrEmailInvalidClientId)
			},
			expectedURL:     nil,
			expectedError:   domain.ErrEmailInvalidClientId,
			shouldReturnURL: false,
			shouldReturnErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockEmailAPI)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			result, err := emailService.GetUserAuthURL(ctx, tt.provider)

			// Assert
			if tt.shouldReturnErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
			}

			if tt.shouldReturnURL {
				assert.NotNil(t, result)
				assert.Equal(t, *tt.expectedURL, *result)
			} else if !tt.shouldReturnErr {
				// Case where we expect nil URL but no error
				assert.Nil(t, result)
			}
		})
	}
}

func TestEmailService_RegisterUserEmail(t *testing.T) {
	tests := []struct {
		name          string
		email         *domain.Email
		mockSetup     func(*mock.MockEmailAPI, *mock.MockEmailRepository)
		expectedError error
		shouldErr     bool
	}{
		{
			name: "should register email when token is valid",
			email: &domain.Email{
				Provider: "gmail",
				Code:     "valid_code",
			},
			mockSetup: func(mockEmailAPI *mock.MockEmailAPI, mockEmailRepo *mock.MockEmailRepository) {
				token := &domain.EmailToken{Access: "access", Refresh: "refresh", Type: "Bearer"}
				email := &domain.Email{
					Provider: "gmail",
					Code:     "valid_code",
					Token: domain.EmailToken{
						Access:  "access",
						Refresh: "refresh",
						Type:    "Bearer",
					},
				}
				mockEmailAPI.EXPECT().GetToken(gomock.Any(), "gmail", "valid_code").Return(token, nil)
				mockEmailRepo.EXPECT().RegisterEmail(gomock.Any(), email).Return(nil)
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name: "should return error when GetToken fails",
			email: &domain.Email{
				Provider: "gmail",
				Code:     "invalid_code",
			},
			mockSetup: func(mockEmailAPI *mock.MockEmailAPI, mockEmailRepo *mock.MockEmailRepository) {
				mockEmailAPI.EXPECT().GetToken(gomock.Any(), "gmail", "invalid_code").
					Return(nil, domain.ErrEmailInvalidCode)
			},
			expectedError: domain.ErrEmailInvalidCode,
			shouldErr:     true,
		},
		{
			name: "should return error when get token fails",
			email: &domain.Email{
				Provider: "gmail",
				Code:     "valid_code",
			},
			mockSetup: func(mockEmailAPI *mock.MockEmailAPI, mockEmailRepo *mock.MockEmailRepository) {
				token := &domain.EmailToken{Access: "", Refresh: "", Type: ""}
				mockEmailAPI.EXPECT().GetToken(gomock.Any(), "gmail", "valid_code").
					Return(token, nil)
			},
			expectedError: domain.ErrEmailAlreadyConfigured,
			shouldErr:     true,
		},
		{
			name: "should return error when repository registration fails",
			email: &domain.Email{
				Provider: "gmail",
				Code:     "valid_code",
			},
			mockSetup: func(mockEmailAPI *mock.MockEmailAPI, mockEmailRepo *mock.MockEmailRepository) {
				token := &domain.EmailToken{Access: "access", Refresh: "refresh", Type: "Bearer"}
				mockEmailAPI.EXPECT().GetToken(gomock.Any(), "gmail", "valid_code").Return(token, nil)
				mockEmailRepo.EXPECT().RegisterEmail(gomock.Any(), gomock.Any()).Return(errors.New("database error"))
			},
			expectedError: errors.New("database error"),
			shouldErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockEmailAPI, mockEmailRepo)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			err := emailService.RegisterUserEmail(ctx, tt.email)

			// Assert
			if tt.shouldErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestEmailService_GetUserEmailToken(t *testing.T) {
	tests := []struct {
		name          string
		userID        string
		id            uint64
		mockSetup     func(*mock.MockEmailRepository)
		expectedEmail *domain.Email
		expectedError error
		shouldErr     bool
	}{
		{
			name:   "should return email when found",
			userID: "user123",
			id:     1,
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				email := &domain.Email{
					ID:       func() *uint64 { id := uint64(1); return &id }(),
					UserID:   "user123",
					Provider: "gmail",
				}
				active := true
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), &active).Return(email, nil)
			},
			expectedEmail: &domain.Email{
				ID:       func() *uint64 { id := uint64(1); return &id }(),
				UserID:   "user123",
				Provider: "gmail",
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name:   "should return error when get email fails",
			userID: "user123",
			id:     1,
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				active := true
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), &active).Return(nil, errors.New("database error"))
			},
			expectedEmail: nil,
			expectedError: errors.New("database error"),
			shouldErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockEmailRepo)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			result, err := emailService.GetUserEmailToken(ctx, tt.userID, tt.id)

			// Assert
			if tt.shouldErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expectedEmail.UserID, result.UserID)
				assert.Equal(t, tt.expectedEmail.Provider, result.Provider)
			}
		})
	}
}

func TestEmailService_ListUserEmails(t *testing.T) {
	tests := []struct {
		name           string
		userID         string
		skip           uint64
		limit          uint64
		mockSetup      func(*mock.MockEmailRepository)
		expectedEmails []domain.Email
		expectedError  error
		shouldErr      bool
	}{
		{
			name:   "should return emails when found",
			userID: "user123",
			skip:   0,
			limit:  10,
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				emails := []domain.Email{
					{UserID: "user123", Provider: "gmail"},
					{UserID: "user123", Provider: "outlook"},
				}
				mockEmailRepo.EXPECT().ListEmails(gomock.Any(), "user123", uint64(0), uint64(10)).Return(emails, nil)
			},
			expectedEmails: []domain.Email{
				{UserID: "user123", Provider: "gmail"},
				{UserID: "user123", Provider: "outlook"},
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name:   "should return error when ListEmails fails",
			userID: "user123",
			skip:   0,
			limit:  10,
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				mockEmailRepo.EXPECT().ListEmails(gomock.Any(), "user123", uint64(0), uint64(10)).Return(nil, errors.New("database error"))
			},
			expectedEmails: nil,
			expectedError:  errors.New("database error"),
			shouldErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockEmailRepo)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			result, err := emailService.ListUserEmails(ctx, tt.userID, tt.skip, tt.limit)

			// Assert
			if tt.shouldErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, len(tt.expectedEmails), len(result))
				for i, email := range tt.expectedEmails {
					assert.Equal(t, email.UserID, result[i].UserID)
					assert.Equal(t, email.Provider, result[i].Provider)
				}
			}
		})
	}
}

func TestEmailService_UpdateUserEmail(t *testing.T) {
	tests := []struct {
		name          string
		email         *domain.Email
		mockSetup     func(*mock.MockEmailRepository)
		expectedError error
		shouldErr     bool
	}{
		{
			name: "should update email when data has changed",
			email: &domain.Email{
				ID:       func() *uint64 { id := uint64(1); return &id }(),
				UserID:   "user123",
				Provider: "gmail",
				Active:   true,
			},
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				email := &domain.Email{
					ID:       func() *uint64 { id := uint64(1); return &id }(),
					UserID:   "user123",
					Provider: "gmail",
					Active:   true,
				}

				actualEmail := &domain.Email{
					ID:       func() *uint64 { id := uint64(1); return &id }(),
					UserID:   "user123",
					Provider: "gmail",
					Active:   false,
				}
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), nil).
					Return(actualEmail, nil)
				mockEmailRepo.EXPECT().UpdateEmail(gomock.Any(), email).Return(nil)
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name: "should return error when no data has changed",
			email: &domain.Email{
				ID:       func() *uint64 { id := uint64(1); return &id }(),
				UserID:   "user123",
				Provider: "gmail",
				Active:   true,
				Verify:   true,
			},
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				actualEmail := &domain.Email{
					ID:       func() *uint64 { id := uint64(1); return &id }(),
					UserID:   "user123",
					Provider: "gmail",
					Active:   true,
					Verify:   true,
					Error:    nil,
				}
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), nil).Return(actualEmail, nil)
			},
			expectedError: domain.ErrNoUpdatedData,
			shouldErr:     true,
		},
		{
			name: "should return error when update fails",
			email: &domain.Email{
				ID:       func() *uint64 { id := uint64(1); return &id }(),
				UserID:   "user123",
				Provider: "gmail",
				Active:   true,
			},
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				actualEmail := &domain.Email{
					ID:       func() *uint64 { id := uint64(1); return &id }(),
					UserID:   "user123",
					Provider: "gmail",
					Active:   false,
				}
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), nil).Return(actualEmail, nil)
				mockEmailRepo.EXPECT().UpdateEmail(gomock.Any(), gomock.Any()).Return(errors.New("database error"))
			},
			expectedError: errors.New("database error"),
			shouldErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			if tt.email.ID != nil {
				tt.mockSetup(mockEmailRepo)
			}

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act & Assert
			if tt.email.ID == nil {
				// Test panic scenario
				assert.Panics(t, func() {
					_ = emailService.UpdateUserEmail(ctx, tt.email)
				})
			} else {
				err := emailService.UpdateUserEmail(ctx, tt.email)

				if tt.shouldErr {
					assert.Error(t, err)
					if tt.expectedError != nil {
						assert.Contains(t, err.Error(), tt.expectedError.Error())
					}
				} else {
					assert.NoError(t, err)
				}
			}
		})
	}
}

func TestEmailService_DeleteEmail(t *testing.T) {
	tests := []struct {
		name          string
		userID        string
		id            uint64
		mockSetup     func(*mock.MockEmailRepository, *mock.MockAccountRepository, *mock.MockTransactionManager)
		expectedError error
		shouldErr     bool
	}{
		{
			name:   "should delete email when found",
			userID: "user123",
			id:     1,
			mockSetup: func(
				mockEmailRepo *mock.MockEmailRepository,
				mockAccountRepo *mock.MockAccountRepository,
				mockTxManager *mock.MockTransactionManager,
			) {
				email := &domain.Email{ID: func() *uint64 { id := uint64(1); return &id }(), UserID: "user123"}
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), nil).
					Return(email, nil)

				mockTxManager.EXPECT().WithTransaction(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fn func(context.Context, pgx.Tx) error) error {
						return fn(ctx, nil) // Simulate successful transaction
					},
				)

				mockAccountRepo.EXPECT().DisconnectEmail(gomock.Any(), nil, "user123", uint64(1)).
					Return(nil)
				mockEmailRepo.EXPECT().DeleteEmailTrx(gomock.Any(), nil, "user123", uint64(1)).
					Return(nil)
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name:   "should return error when get email fails",
			userID: "user123",
			id:     999,
			mockSetup: func(
				mockEmailRepo *mock.MockEmailRepository,
				mockAccountRepo *mock.MockAccountRepository,
				mockTxManager *mock.MockTransactionManager,
			) {
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(999), nil).
					Return(nil, domain.ErrDataNotFound)
			},
			expectedError: domain.ErrDataNotFound,
			shouldErr:     true,
		},
		{
			name:   "should return error when disconnect fails",
			userID: "user123",
			id:     1,
			mockSetup: func(
				mockEmailRepo *mock.MockEmailRepository,
				mockAccountRepo *mock.MockAccountRepository,
				mockTxManager *mock.MockTransactionManager,
			) {
				email := &domain.Email{ID: func() *uint64 { id := uint64(1); return &id }(), UserID: "user123"}
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), nil).
					Return(email, nil)

				mockTxManager.EXPECT().WithTransaction(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fn func(context.Context, pgx.Tx) error) error {
						return fn(ctx, nil)
					},
				)
				mockAccountRepo.EXPECT().DisconnectEmail(gomock.Any(), nil, "user123", uint64(1)).
					Return(errors.New("disconnect error"))
			},
			expectedError: errors.New("disconnect error"),
			shouldErr:     true,
		},
		{
			name:   "should return error when delete fails",
			userID: "user123",
			id:     1,
			mockSetup: func(
				mockEmailRepo *mock.MockEmailRepository,
				mockAccountRepo *mock.MockAccountRepository,
				mockTxManager *mock.MockTransactionManager,
			) {
				email := &domain.Email{ID: func() *uint64 { id := uint64(1); return &id }(), UserID: "user123"}
				mockEmailRepo.EXPECT().GetEmail(gomock.Any(), "user123", uint64(1), nil).Return(email, nil)
				mockTxManager.EXPECT().WithTransaction(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fn func(context.Context, pgx.Tx) error) error {
						return fn(ctx, nil)
					},
				)
				mockAccountRepo.EXPECT().DisconnectEmail(gomock.Any(), nil, "user123", uint64(1)).
					Return(nil)
				mockEmailRepo.EXPECT().DeleteEmailTrx(gomock.Any(), nil, "user123", uint64(1)).
					Return(errors.New("delete error"))
			},
			expectedError: errors.New("delete error"),
			shouldErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockEmailRepo, mockAccountRepo, mockTxManager)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			err := emailService.DeleteEmail(ctx, tt.userID, tt.id)

			// Assert
			if tt.shouldErr {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.Contains(t, err.Error(), tt.expectedError.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestEmailService_SaveEmailError(t *testing.T) {
	tests := []struct {
		name          string
		emailID       uint64
		errorMsg      string
		mockSetup     func(*mock.MockEmailRepository)
		expectedError error
		shouldErr     bool
	}{
		{
			name:     "should save error when valid parameters",
			emailID:  1,
			errorMsg: "email processing failed",
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				mockEmailRepo.EXPECT().SaveEmailError(gomock.Any(), uint64(1), "email processing failed").
					Return(nil)
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name:     "should return error when repository fails",
			emailID:  1,
			errorMsg: "email processing failed",
			mockSetup: func(mockEmailRepo *mock.MockEmailRepository) {
				mockEmailRepo.EXPECT().SaveEmailError(gomock.Any(), uint64(1), "email processing failed").
					Return(errors.New("database error"))
			},
			expectedError: errors.New("database error"),
			shouldErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockEmailRepo)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			err := emailService.SaveEmailError(ctx, tt.emailID, tt.errorMsg)

			// Assert
			if tt.shouldErr {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestEmailService_ReadEmail(t *testing.T) {
	tests := []struct {
		name          string
		userID        string
		accountIDs    []uint64
		mockSetup     func(*mock.MockAccountService, *mock.MockAccountRepository, *mock.MockEmailAPI)
		expectedError error
		shouldErr     bool
	}{
		{
			name:       "should read email successfully",
			userID:     "user123",
			accountIDs: []uint64{1, 2},
			mockSetup: func(
				mockAccountService *mock.MockAccountService,
				mockAccountRepo *mock.MockAccountRepository,
				mockEmailAPI *mock.MockEmailAPI,
			) {
				// 1. GetAccounts
				accounts := []domain.Account{
					{ID: 1, UserID: "user123"},
					{ID: 2, UserID: "user123"},
				}
				mockAccountService.EXPECT().GetAccounts(gomock.Any(), "user123", uint64(0), uint64(100), enums.All).
					Return(accounts, nil)

				// 2. AdminGetAccountsList
				filters := domain.AccountFilters{IDs: []uint64{1, 2}, Skip: 0, Limit: 100}
				accountsDetails := []domain.Account{
					{ID: 1, Email: domain.Email{Email: "test1@example.com", Token: domain.EmailToken{Access: "token1"}}},
					{ID: 2, Email: domain.Email{Email: "test2@example.com", Token: domain.EmailToken{Access: "token2"}}},
				}
				mockAccountRepo.EXPECT().AdminGetAccountsList(gomock.Any(), filters).Return(accountsDetails, nil)

				// 3. ReadEmail
				mockEmailAPI.EXPECT().ReadEmail(accountsDetails)
			},
			expectedError: nil,
			shouldErr:     false,
		},
		{
			name:       "should return error when account validation fails",
			userID:     "user123",
			accountIDs: []uint64{1, 3},
			mockSetup: func(
				mockAccountService *mock.MockAccountService,
				mockAccountRepo *mock.MockAccountRepository,
				mockEmailAPI *mock.MockEmailAPI,
			) {
				// 1. GetAccounts
				accounts := []domain.Account{
					{ID: 1, UserID: "user123"},
					{ID: 2, UserID: "user123"},
				}
				mockAccountService.EXPECT().GetAccounts(gomock.Any(), "user123", uint64(0), uint64(100), enums.All).
					Return(accounts, nil)
			},
			expectedError: domain.ErrAccountsNotFound,
			shouldErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockEmailAPI := mock.NewMockEmailAPI(ctrl)
			mockEmailRepo := mock.NewMockEmailRepository(ctrl)
			mockAccountRepo := mock.NewMockAccountRepository(ctrl)
			mockAccountService := mock.NewMockAccountService(ctrl)
			mockTxManager := mock.NewMockTransactionManager(ctrl)

			tt.mockSetup(mockAccountService, mockAccountRepo, mockEmailAPI)

			emailService := NewEmailService(mockEmailRepo, mockEmailAPI, mockAccountRepo, mockAccountService, mockTxManager)
			ctx := context.Background()

			// Act
			_, err := emailService.ReadEmail(ctx, tt.userID, tt.accountIDs)

			// Assert
			if tt.shouldErr {
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
