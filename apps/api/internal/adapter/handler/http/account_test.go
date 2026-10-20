package http

import (
	"bytes"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestAccountHandler_CreateAccount(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		requestBody    interface{}
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should create account successfully",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			requestBody: createAccountRequest{
				Name:           "My Bank",
				LastFourDigits: "1234",
				BankID:         1,
				TypeID:         1,
				InitialBalance: 100.0,
				EmailID:        uint64Ptr(1),
			},
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					CreateAccount(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx *gin.Context, account *domain.Account) error {
						assert.Equal(t, "user123", account.UserID)
						assert.Equal(t, "My Bank", account.Name)
						account.ID = 1
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			requestBody: createAccountRequest{
				Name:           "My Bank",
				LastFourDigits: "1234",
				BankID:         1,
				TypeID:         1,
			},
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when request body is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			requestBody:    "invalid json",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			requestBody: createAccountRequest{
				Name:           "My Bank",
				LastFourDigits: "1234",
				BankID:         1,
				TypeID:         1,
			},
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					CreateAccount(gomock.Any(), gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.POST("/accounts/create", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.CreateAccount(ctx)
			})

			body, err := json.Marshal(tt.requestBody)
			assert.NoError(t, err)

			req, err := http.NewRequest("POST", "/accounts/create", bytes.NewBuffer(body))
			assert.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func TestAccountHandler_GetAccount(t *testing.T) {
	sampleAccount := domain.Account{
		ID:             1,
		UserID:         "user123",
		Name:           "My Bank",
		LastFourDigits: "1234",
		InitialBalance: 100.0,
		Bank:           domain.Bank{ID: 1},
		Type:           domain.AccountType{ID: 1},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		accountID      string
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return account successfully",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					GetAccount(gomock.Any(), "user123", uint64(1)).
					Return(&sampleAccount, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			accountID:      "1",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when account ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID:      "invalid",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					GetAccount(gomock.Any(), "user123", uint64(1)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.GET("/accounts/:id", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetAccount(ctx)
			})

			req, err := http.NewRequest("GET", "/accounts/"+tt.accountID, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func TestAccountHandler_GetAccounts(t *testing.T) {
	sampleAccounts := []domain.Account{
		{
			ID:             1,
			UserID:         "user123",
			Name:           "My Bank",
			LastFourDigits: "1234",
			InitialBalance: 100.0,
			Bank:           domain.Bank{ID: 1},
			Type:           domain.AccountType{ID: 1},
		},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		queryParams    string
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return accounts successfully",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			queryParams: "?skip=0&limit=10",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					GetAccounts(gomock.Any(), "user123", uint64(0), uint64(10), "").
					Return(sampleAccounts, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			queryParams:    "?skip=0&limit=10",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when query params are invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			queryParams:    "?limit=1", // min limit is 5
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			queryParams: "?skip=0&limit=10",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					GetAccounts(gomock.Any(), "user123", uint64(0), uint64(10), "").
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.GET("/accounts/list", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetAccounts(ctx)
			})

			req, err := http.NewRequest("GET", "/accounts/list"+tt.queryParams, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func TestAccountHandler_UpdateAccount(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		accountID      string
		requestBody    interface{}
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should update account successfully",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			requestBody: updateAccountRequest{
				Name:           "Updated Bank",
				LastFourDigits: "4321",
				BankID:         2,
				TypeID:         1,
				InitialBalance: 200.0,
				EmailID:        uint64Ptr(2),
			},
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					UpdateAccount(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx *gin.Context, account *domain.Account) error {
						assert.Equal(t, uint64(1), account.ID)
						assert.Equal(t, "user123", account.UserID)
						assert.Equal(t, "Updated Bank", account.Name)
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			accountID: "1",
			requestBody: updateAccountRequest{
				Name:           "Updated Bank",
				LastFourDigits: "4321",
				BankID:         2,
				TypeID:         1,
			},
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when account ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "invalid",
			requestBody: updateAccountRequest{
				Name:           "Updated Bank",
				LastFourDigits: "4321",
				BankID:         2,
				TypeID:         1,
			},
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when request body is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID:      "1",
			requestBody:    "invalid json",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			requestBody: updateAccountRequest{
				Name:           "Updated Bank",
				LastFourDigits: "4321",
				BankID:         2,
				TypeID:         1,
			},
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					UpdateAccount(gomock.Any(), gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.PUT("/accounts/:id", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.UpdateAccount(ctx)
			})

			body, err := json.Marshal(tt.requestBody)
			assert.NoError(t, err)

			req, err := http.NewRequest("PUT", "/accounts/"+tt.accountID, bytes.NewBuffer(body))
			assert.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func TestAccountHandler_DeleteAccount(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		accountID      string
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should delete account successfully",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					DeleteAccount(gomock.Any(), "user123", uint64(1)).
					Return(nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			accountID:      "1",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when account ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID:      "invalid",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					DeleteAccount(gomock.Any(), "user123", uint64(1)).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.DELETE("/accounts/:id", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.DeleteAccount(ctx)
			})

			req, err := http.NewRequest("DELETE", "/accounts/"+tt.accountID, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
			}
		})
	}
}

func TestAccountHandler_AdminGetAccounts(t *testing.T) {
	sampleAccounts := []domain.Account{
		{
			ID:             1,
			UserID:         "user123",
			Name:           "My Bank",
			LastFourDigits: "1234",
			InitialBalance: 100.0,
			Bank:           domain.Bank{ID: 1},
			Type:           domain.AccountType{ID: 1},
			Total:          1,
		},
	}

	tests := []struct {
		name           string
		queryParams    string
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name:        "should return accounts successfully",
			queryParams: "?skip=0&limit=10",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					AdminGetAccounts(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx *gin.Context, filters domain.AccountFilters) ([]domain.Account, error) {
						assert.Equal(t, uint64(0), filters.Skip)
						assert.Equal(t, uint64(10), filters.Limit)
						return sampleAccounts, nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name:           "should return error when query params are invalid",
			queryParams:    "?limit=1", // min limit is 5
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:        "should return error when service fails",
			queryParams: "?skip=0&limit=10",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					AdminGetAccounts(gomock.Any(), gomock.Any()).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.GET("/accounts/admin/list", func(ctx *gin.Context) {
				handler.AdminGetAccounts(ctx)
			})

			req, err := http.NewRequest("GET", "/accounts/admin/list"+tt.queryParams, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func TestAccountHandler_CalculateInitialBalance(t *testing.T) {
	sampleAccount := domain.Account{
		ID:             1,
		UserID:         "user123",
		Name:           "My Bank",
		LastFourDigits: "1234",
		InitialBalance: 100.0,
		Bank:           domain.Bank{ID: 1},
		Type:           domain.AccountType{ID: 1},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		accountID      string
		setupMock      func(*mock.MockAccountService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should calculate initial balance successfully",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					CalculateInitialBalance(gomock.Any(), "user123", uint64(1)).
					Return(&sampleAccount, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			accountID:      "1",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when account ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID:      "invalid",
			setupMock:      func(mockSvc *mock.MockAccountService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAccountAuthContext(ctx, "user123")
			},
			accountID: "1",
			setupMock: func(mockSvc *mock.MockAccountService) {
				mockSvc.EXPECT().
					CalculateInitialBalance(gomock.Any(), "user123", uint64(1)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAccountTest(t)
			tt.setupMock(mockService)

			router.PUT("/accounts/:id/calculate/initial-balance", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.CalculateInitialBalance(ctx)
			})

			req, err := http.NewRequest("PUT", "/accounts/"+tt.accountID+"/calculate/initial-balance", nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func setupAccountTest(t *testing.T) (*AccountHandler, *mock.MockAccountService, *gin.Engine) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := mock.NewMockAccountService(ctrl)
	handler := NewAccountHandler(mockService)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	conf := config.App{
		Env: "test",
	}

	logger.Set(&conf)

	registerValidators()

	return handler, mockService, router
}

func setupAccountAuthContext(ctx *gin.Context, userID string) {
	payload := &domain.TokenPayload{
		UserID:   userID,
		Name:     "Test",
		LastName: "User",
		Email:    "test@example.com",
		Verified: true,
		Groups:   map[string]bool{},
		Use:      "id",
	}
	ctx.Set(enums.AuthorizationPayloadKey, payload)
}

func uint64Ptr(v uint64) *uint64 {
	return &v
}
