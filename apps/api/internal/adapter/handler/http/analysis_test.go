package http

import (
	"bytes"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestAnalysisHandler_GetFinancialReport(t *testing.T) {
	sampleReport := domain.FinancialReport{
		BalanceReport: domain.BalanceReport{
			SavingsBalance: domain.MonthlyMetrics{Value: 5000.0},
			CreditsBalance: domain.MonthlyMetrics{Value: -2000.0},
		},
		MonthlyReport: domain.MonthlyReport{
			Income:   domain.MonthlyMetrics{Value: 8000.0},
			Expenses: domain.MonthlyMetrics{Value: -3000.0},
		},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		dateParam      string
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return financial report successfully when valid date is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam: "2023-10-01",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				expectedDate := time.Date(2023, 10, 1, 0, 0, 0, 0, time.UTC)
				mockSvc.EXPECT().
					GetFinancialReport(gomock.Any(), "user123", expectedDate).
					Return(sampleReport, nil).
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
			dateParam:      "2023-10-01",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when date format is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam:      "invalid-date",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when date parameter is missing",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam:      "",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam: "2023-10-01",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				expectedDate := time.Date(2023, 10, 1, 0, 0, 0, 0, time.UTC)
				mockSvc.EXPECT().
					GetFinancialReport(gomock.Any(), "user123", expectedDate).
					Return(domain.FinancialReport{}, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.GET("/analysis/financial-report", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetFinancialReport(ctx)
			})

			url := "/analysis/financial-report"
			if tt.dateParam != "" {
				url = fmt.Sprintf("%s?date=%s", url, tt.dateParam)
			}

			req, err := http.NewRequest("GET", url, nil)
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

func TestAnalysisHandler_GetBalanceByAccount(t *testing.T) {
	sampleBalance := []domain.BalanceByAccount{
		{
			AccountID:      1,
			Name:           "Savings Account",
			Bank:           "Bank ABC",
			LastFourDigits: "1234",
			Balance:        5000.0,
		},
		{
			AccountID:      2,
			Name:           "Credit Card",
			Bank:           "Bank XYZ",
			LastFourDigits: "5678",
			Balance:        -1500.0,
		},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		filterParam    string
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return balance by account successfully when valid filter is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			filterParam: "savings",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountsBalance(gomock.Any(), "user123", "savings").
					Return(sampleBalance, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return balance by account successfully when no filter is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			filterParam: "",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountsBalance(gomock.Any(), "user123", "").
					Return(sampleBalance, nil).
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
			filterParam:    "savings",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			filterParam: "savings",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountsBalance(gomock.Any(), "user123", "savings").
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should handle empty response from service gracefully",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			filterParam: "nonexistent",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountsBalance(gomock.Any(), "user123", "nonexistent").
					Return([]domain.BalanceByAccount{}, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.GET("/analysis/accounts-balance", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetBalanceByAccount(ctx)
			})

			url := "/analysis/accounts-balance"
			if tt.filterParam != "" {
				url = fmt.Sprintf("%s?filter=%s", url, tt.filterParam)
			}

			req, err := http.NewRequest("GET", url, nil)
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

func TestAnalysisHandler_GetCategoriesExpenseReport(t *testing.T) {
	sampleReport := domain.CategoriesReport{
		Income: domain.FlowReport{
			Budget: 0,
			Left:   0,
			Report: []domain.CategoryMetric{},
		},
		Expenses: domain.FlowReport{
			Budget: 1000.0,
			Left:   500.0,
			Report: []domain.CategoryMetric{
				{
					CategoryID: 1,
					Name:       "Food",
					Emoji:      "🍔",
					MonthlyMetrics: domain.MonthlyMetrics{
						Budget: -1000.0,
						Value:  -500.0,
						Usage:  utils.RoundV3(25.0, 2),
					},
				},
			},
		},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		requestBody    interface{}
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return categories expense report successfully when valid data is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody: CategoryReportRequest{
				Filter: "2023-10-01",
				SortBy: nil,
			},
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				expectedDate := time.Date(2023, 10, 1, 0, 0, 0, 0, time.UTC)
				mockSvc.EXPECT().
					GetCategoriesReport(gomock.Any(), "user123", expectedDate, (*string)(nil)).
					Return(sampleReport, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return categories expense report successfully with sort by expense",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody: CategoryReportRequest{
				Filter: "2023-10-01",
				SortBy: stringPtr("amount"),
			},
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				expectedDate := time.Date(2023, 10, 1, 0, 0, 0, 0, time.UTC)
				sortBy := "amount"
				mockSvc.EXPECT().
					GetCategoriesReport(gomock.Any(), "user123", expectedDate, &sortBy).
					Return(sampleReport, nil).
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
			requestBody: CategoryReportRequest{
				Filter: "2023-10-01",
			},
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when date format is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody: CategoryReportRequest{
				Filter: "invalid-date",
			},
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when request body is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody:    "invalid json",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.POST("/analysis/expense-report", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetCategoriesReport(ctx)
			})

			body, err := json.Marshal(tt.requestBody)
			assert.NoError(t, err)

			req, err := http.NewRequest("POST", "/analysis/expense-report", bytes.NewBuffer(body))
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

func TestAnalysisHandler_GetFinancialAnalysis(t *testing.T) {
	sampleAnalysis := domain.FinancialAnalysis{
		IncomeBudget:  8000.0,
		ExpenseBudget: 3000.0,
		SavingsBudget: 5000.0,
		Monthly: domain.FinancialAnalysisMonthly{
			Income:          []domain.MonthlyMetrics{{Value: 8000.0}},
			Expense:         []domain.MonthlyMetrics{{Value: -3000.0}},
			Savings:         []domain.MonthlyMetrics{{Value: 5000.0}},
			RSavingsBalance: []domain.MonthlyMetrics{{Value: 5000.0}},
			RCreditsBalance: []domain.MonthlyMetrics{{Value: -2000.0}},
			Year:            []uint16{2023},
			Month:           []uint16{10},
		},
		Daily: domain.FinancialAnalysisDaily{
			Income:          []float64{200.0},
			Expense:         []float64{-100.0},
			MTDIncome:       []float64{200.0},
			MTDExpense:      []float64{-100.0},
			MTDSavings:      []float64{100.0},
			RSavingsBalance: []float64{5000.0},
			RCreditsBalance: []float64{-2000.0},
			Date:            []string{"2023-10-01"},
		},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		dateParam      string
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return financial analysis successfully when valid date is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam: "2025-05",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetFinancialAnalysis(gomock.Any(), "user123", "2025-05").
					Return(sampleAnalysis, nil).
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
			dateParam:      "2025-05",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when date parameter is missing",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam:      "",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam: "2025-05",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetFinancialAnalysis(gomock.Any(), "user123", "2025-05").
					Return(domain.FinancialAnalysis{}, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should handle edge case with future date gracefully",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			dateParam: "2030-12",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetFinancialAnalysis(gomock.Any(), "user123", "2030-12").
					Return(domain.FinancialAnalysis{}, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.GET("/analysis/financial-analysis", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetFinancialAnalysis(ctx)
			})

			url := "/analysis/financial-analysis"
			if tt.dateParam != "" {
				url = fmt.Sprintf("%s?date=%s", url, tt.dateParam)
			}

			req, err := http.NewRequest("GET", url, nil)
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

func TestAnalysisHandler_GetCategoryAnalysis(t *testing.T) {
	sampleAnalysis := domain.CategoryAnalysis{
		Budget:  1000.0,
		Monthly: []domain.MonthlyMetrics{{Value: -500.0}},
		Year:    []uint16{2025},
		Month:   []uint16{5},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		categoryID     string
		dateParam      string
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return category analysis successfully when valid parameters are provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			categoryID: "6",
			dateParam:  "2025-05",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetCategoryAnalysis(gomock.Any(), "user123", uint64(6), "2025-05").
					Return(sampleAnalysis, nil).
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
			categoryID:     "6",
			dateParam:      "2025-05",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			categoryID:     "invalid",
			dateParam:      "2025-05",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when parameters are missing",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			categoryID:     "",
			dateParam:      "",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			categoryID: "6",
			dateParam:  "2025-05",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetCategoryAnalysis(gomock.Any(), "user123", uint64(6), "2025-05").
					Return(domain.CategoryAnalysis{}, errors.New("category not found")).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.GET("/analysis/category-analysis", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetCategoryAnalysis(ctx)
			})

			url := "/analysis/category-analysis"
			var params []string
			if tt.categoryID != "" {
				params = append(params, fmt.Sprintf("category_id=%s", tt.categoryID))
			}
			if tt.dateParam != "" {
				params = append(params, fmt.Sprintf("date=%s", tt.dateParam))
			}
			if len(params) > 0 {
				url = fmt.Sprintf("%s?%s", url, params[0])
				for i := 1; i < len(params); i++ {
					url = fmt.Sprintf("%s&%s", url, params[i])
				}
			}

			req, err := http.NewRequest("GET", url, nil)
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

func TestAnalysisHandler_GetAccountsReport(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		requestBody    interface{}
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return accounts report successfully when valid data is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody: AccountsReportRequest{
				Start:        "2023-10-01",
				End:          "2023-10-31",
				AccountsType: "savings",
				Accounts:     []int64{1, 2, 3, 4},
			},
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountsReport(gomock.Any(), gomock.Any()).
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
			requestBody: AccountsReportRequest{
				Start:        "2023-10-01",
				End:          "2023-10-31",
				AccountsType: "savings",
				Accounts:     []int64{1, 2, 3, 4},
			},
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when request body is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody:    "invalid json",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when accounts type is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody: AccountsReportRequest{
				Start:        "2023-10-01",
				End:          "2023-10-31",
				AccountsType: "invalid_type",
				Accounts:     []int64{1, 2, 3, 4},
			},
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			requestBody: AccountsReportRequest{
				Start:        "2023-10-01",
				End:          "2023-10-31",
				AccountsType: "savings",
				Accounts:     []int64{1, 2, 3, 4},
			},
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountsReport(gomock.Any(), gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.POST("/analysis/accounts-report", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetAccountsReport(ctx)
			})

			body, err := json.Marshal(tt.requestBody)
			assert.NoError(t, err)

			req, err := http.NewRequest("POST", "/analysis/accounts-report", bytes.NewBuffer(body))
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

func TestAnalysisHandler_GetAccountAnalysis(t *testing.T) {
	sampleAnalysis := domain.AccountAnalysis{
		AccountID:   1,
		AccountName: "Test Account",
		Balance:     []domain.MonthlyMetrics{{Value: 5000.0}},
		Year:        []uint16{2025},
		Month:       []uint16{5},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		accountID      string
		dateParam      string
		setupMock      func(*mock.MockAnalysisService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return account analysis successfully when valid parameters are provided",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			accountID: "1",
			dateParam: "2025-05",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountAnalysis(gomock.Any(), "user123", uint64(1), "2025-05").
					Return(sampleAnalysis, nil).
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
			dateParam:      "2025-05",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when account ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			accountID:      "invalid",
			dateParam:      "2025-05",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when parameters are missing",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			accountID:      "",
			dateParam:      "",
			setupMock:      func(mockSvc *mock.MockAnalysisService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAnalysisAuthContext(ctx, "user123")
			},
			accountID: "1",
			dateParam: "2025-05",
			setupMock: func(mockSvc *mock.MockAnalysisService) {
				mockSvc.EXPECT().
					GetAccountAnalysis(gomock.Any(), "user123", uint64(1), "2025-05").
					Return(domain.AccountAnalysis{}, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupAnalysisTest(t)
			tt.setupMock(mockService)

			router.GET("/analysis/account-analysis", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetAccountAnalysis(ctx)
			})

			url := "/analysis/account-analysis"
			var params []string
			if tt.accountID != "" {
				params = append(params, fmt.Sprintf("account_id=%s", tt.accountID))
			}
			if tt.dateParam != "" {
				params = append(params, fmt.Sprintf("date=%s", tt.dateParam))
			}
			if len(params) > 0 {
				url = fmt.Sprintf("%s?%s", url, params[0])
				for i := 1; i < len(params); i++ {
					url = fmt.Sprintf("%s&%s", url, params[i])
				}
			}

			req, err := http.NewRequest("GET", url, nil)
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

func stringPtr(s string) *string {
	return &s
}

func setupAnalysisTest(t *testing.T) (*AnalysisHandler, *mock.MockAnalysisService, *gin.Engine) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := mock.NewMockAnalysisService(ctrl)
	handler := NewAnalysisHandler(mockService)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	conf := config.App{
		Env: "test",
	}

	logger.Set(&conf)

	return handler, mockService, router
}

func setupAnalysisAuthContext(ctx *gin.Context, userID string) {
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
