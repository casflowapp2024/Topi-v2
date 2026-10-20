package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestAnalysisService_GetFinancialReport(t *testing.T) {
	type args struct {
		userID string
		filter time.Time
	}

	now := time.Date(2025, 8, 16, 0, 0, 0, 0, time.UTC)
	start, bStart, end := utils.FormatFRDates(now)

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockAnalysisRepository)
		wantErr   bool
	}{
		{
			name: "should return combined report when repository calls succeed",
			args: args{userID: "u1", filter: now},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// Financial summary with current and past month to compute VsPastMonth
				thisMonth := domain.MonthlyReport{Income: domain.MonthlyMetrics{Value: 1000}, Expenses: domain.MonthlyMetrics{Value: 400}, Month: 8, CurrentMonth: 8}
				pastMonth := domain.MonthlyReport{Income: domain.MonthlyMetrics{Value: 800}, Expenses: domain.MonthlyMetrics{Value: 500}, Month: 7, CurrentMonth: 8}
				fs := domain.FinancialSummary{domain.Index(0): thisMonth, domain.Index(1): pastMonth}
				m.EXPECT().GetFinancialSummary(gomock.Any(), "u1", start, end).Return(fs, nil)

				// Saving and credits balance summaries
				savings := domain.BalanceSummary{Balance: 200, PastMonthBalance: 800, InitialBalance: 100}
				credits := domain.BalanceSummary{Balance: -50, PastMonthBalance: -400, InitialBalance: 0}
				m.EXPECT().GetBalanceSummary(gomock.Any(), "u1", bStart, end, enums.SavingAndInvestmentTypes, gomock.Nil()).Return(savings, nil)
				m.EXPECT().GetBalanceSummary(gomock.Any(), "u1", bStart, end, enums.CreditTypes, gomock.Nil()).Return(credits, nil)
			},
			wantErr: false,
		},
		{
			name: "should return error when financial summary fails",
			args: args{userID: "u1", filter: now},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetFinancialSummary(gomock.Any(), "u1", start, end).Return(nil, errors.New("fs err"))
				m.EXPECT().GetBalanceSummary(gomock.Any(), "u1", bStart, end, enums.SavingAndInvestmentTypes, gomock.Nil()).Return(domain.BalanceSummary{}, nil)
				m.EXPECT().GetBalanceSummary(gomock.Any(), "u1", bStart, end, enums.CreditTypes, gomock.Nil()).Return(domain.BalanceSummary{}, nil)
			},
			wantErr: true,
		},
		{
			name: "should return error when savings balance fails",
			args: args{userID: "u1", filter: now},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetFinancialSummary(gomock.Any(), "u1", start, end).Return(domain.FinancialSummary{}, nil)
				m.EXPECT().GetBalanceSummary(gomock.Any(), "u1", bStart, end, enums.SavingAndInvestmentTypes, gomock.Nil()).Return(domain.BalanceSummary{}, errors.New("savings err"))
				m.EXPECT().GetBalanceSummary(gomock.Any(), "u1", bStart, end, enums.CreditTypes, gomock.Nil()).Return(domain.BalanceSummary{}, nil)
			},
			wantErr: true,
		},
		{
			name: "should return error when credits balance fails",
			args: args{userID: "u1", filter: now},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetFinancialSummary(gomock.Any(), "u1", start, end).Return(domain.FinancialSummary{}, nil)
				m.EXPECT().GetBalanceSummary(
					gomock.Any(),
					"u1",
					bStart,
					end,
					enums.SavingAndInvestmentTypes,
					gomock.Nil(),
				).Return(domain.BalanceSummary{}, nil)
				m.EXPECT().GetBalanceSummary(
					gomock.Any(),
					"u1",
					bStart,
					end,
					enums.CreditTypes,
					gomock.Nil(),
				).Return(domain.BalanceSummary{}, errors.New("credits err"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			repo := mock.NewMockAnalysisRepository(ctrl)
			tt.mockSetup(repo)

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			got, err := svc.GetFinancialReport(ctx, tt.args.userID, tt.args.filter)

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)

			// Basic sanity checks on calculated values
			// Savings expected value: 200 + (800+100) = 1100
			assert.InDelta(t, 1100.0, got.BalanceReport.SavingsBalance.Value, 0.0001)
			assert.NotNil(t, got.BalanceReport.SavingsBalance.Percentage)

			// Credits expected value: -50 + (-400+0) = -450
			assert.InDelta(t, -450.0, got.BalanceReport.CreditsBalance.Value, 0.0001)
			assert.NotNil(t, got.BalanceReport.CreditsBalance.Percentage)

			// Monthly should reflect thisMonth values with expense clamped to 0 when positive for the Expenses metric
			// Note: Savings is computed from original values (income 1000 - expense 400 = 600)
			assert.InDelta(t, 1000.0, got.MonthlyReport.Income.Value, 0.0001)
			assert.InDelta(t, 0.0, got.MonthlyReport.Expenses.Value, 0.0001)
		})
	}
}

func TestAnalysisService_GeAccountsBalance(t *testing.T) {
	type args struct {
		userID string
		filter string
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockAnalysisRepository, captured *[]uint64)
		want      []domain.BalanceByAccount
		wantErr   bool
	}{
		{
			name: "should pass saving types when filter is savings",
			args: args{userID: "u1", filter: enums.Savings},
			mockSetup: func(m *mock.MockAnalysisRepository, captured *[]uint64) {
				m.EXPECT().GetBalanceByAccount(gomock.Any(), "u1", gomock.Any()).DoAndReturn(
					func(_ context.Context, _ string, types []uint64) ([]domain.BalanceByAccount, error) {
						*captured = types
						return []domain.BalanceByAccount{{AccountID: 1, Balance: 10}}, nil
					},
				)
			},
			want:    []domain.BalanceByAccount{{AccountID: 1, Balance: 10}},
			wantErr: false,
		},
		{
			name: "should pass nil types when filter is not savings",
			args: args{userID: "u1", filter: "credits"},
			mockSetup: func(m *mock.MockAnalysisRepository, captured *[]uint64) {
				m.EXPECT().GetBalanceByAccount(gomock.Any(), "u1", gomock.Any()).DoAndReturn(
					func(_ context.Context, _ string, types []uint64) ([]domain.BalanceByAccount, error) {
						*captured = types
						return []domain.BalanceByAccount{{AccountID: 2, Balance: 20}}, nil
					},
				)
			},
			want:    []domain.BalanceByAccount{{AccountID: 2, Balance: 20}},
			wantErr: false,
		},
		{
			name: "should return error when repository fails",
			args: args{userID: "u1", filter: ""},
			mockSetup: func(m *mock.MockAnalysisRepository, _ *[]uint64) {
				m.EXPECT().GetBalanceByAccount(gomock.Any(), "u1", gomock.Any()).Return(nil, errors.New("boom"))
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			repo := mock.NewMockAnalysisRepository(ctrl)
			var captured []uint64
			tt.mockSetup(repo, &captured)

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			got, err := svc.GetAccountsBalance(ctx, tt.args.userID, tt.args.filter)

			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)

			if tt.args.filter == enums.Savings {
				if !reflect.DeepEqual(captured, enums.SavingTypes) {
					t.Fatalf("expected saving types %v, got %v", enums.SavingTypes, captured)
				}
			} else {
				assert.Nil(t, captured)
			}
		})
	}
}

func TestAnalysisService_GetCategoriesExpenseReport(t *testing.T) {
	now := time.Now()
	sortBy := enums.Amount
	tests := []struct {
		name      string
		userID    string
		mockSetup func(m *mock.MockAnalysisRepository)
		want      domain.CategoriesReport
		wantErr   bool
	}{
		{
			name:   "should return report when repository returns data",
			userID: "u1",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				rpt := domain.CategoriesReport{
					Income: domain.FlowReport{
						Budget: 0,
						Left:   0,
						Report: []domain.CategoryMetric{},
					},
					Expenses: domain.FlowReport{
						Budget: 0, // Will be calculated
						Left:   0, // Will be calculated
						Report: []domain.CategoryMetric{
							{CategoryID: 1, Name: "Food", Emoji: "🍔", MonthlyMetrics: domain.MonthlyMetrics{Budget: -300, Value: -150}},
							{CategoryID: 2, Name: "Rent", Emoji: "🏠", MonthlyMetrics: domain.MonthlyMetrics{Budget: -1000, Value: -1000}},
						},
					},
				}
				m.EXPECT().GetCategoriesReport(gomock.Any(), "u1", now).Return(rpt, nil)
			},
			want: domain.CategoriesReport{
				Income: domain.FlowReport{
					Budget: 0,
					Left:   0,
					Report: []domain.CategoryMetric{},
				},
				Expenses: domain.FlowReport{
					Value:  -1150, // -1000 + -150
					Budget: -1300, // -300 + -1000
					Left:   0,     // Calculated but both Left are nil
					Report: []domain.CategoryMetric{
						{CategoryID: 2, Name: "Rent", Emoji: "🏠", MonthlyMetrics: domain.MonthlyMetrics{Budget: -1000, Value: -1000}},
						{CategoryID: 1, Name: "Food", Emoji: "🍔", MonthlyMetrics: domain.MonthlyMetrics{Budget: -300, Value: -150}},
					},
				},
			},
			wantErr: false,
		},
		{
			name:   "should return error when repository fails",
			userID: "u1",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetCategoriesReport(gomock.Any(), "u1", now).Return(domain.CategoriesReport{}, errors.New("db err"))
			},
			want:    domain.CategoriesReport{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			repo := mock.NewMockAnalysisRepository(ctrl)
			tt.mockSetup(repo)

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			got, err := svc.GetCategoriesReport(ctx, tt.userID, now, &sortBy)

			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestAnalysisService_GetFinancialAnalysis(t *testing.T) {
	// Helper function to create pointer to float64
	float64Ptr := func(f float64) *float64 {
		return &f
	}

	type args struct {
		userID string
		date   string
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockAnalysisRepository)
		want      domain.FinancialAnalysis
		wantErr   bool
	}{
		{
			name: "should return financial analysis when both repository calls succeed",
			args: args{userID: "user123", date: "2025-10"},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetDailyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						fr.Mu.Lock()
						defer fr.Mu.Unlock()

						fr.Rsp.Daily = domain.FinancialAnalysisDaily{
							Income:          []float64{100.0, 200.0, 150.0},
							Expense:         []float64{80.0, 120.0, 90.0},
							MTDIncome:       []float64{100.0, 300.0, 450.0},
							MTDExpense:      []float64{80.0, 200.0, 290.0},
							MTDSavings:      []float64{20.0, 100.0, 160.0},
							RSavingsBalance: []float64{1000.0, 1100.0, 1260.0},
							RCreditsBalance: []float64{-500.0, -620.0, -710.0},
							Date:            []string{"2025-10-01", "2025-10-02", "2025-10-03"},
							UpdatedAt:       time.Date(2025, 10, 3, 12, 0, 0, 0, time.UTC),
						}
					},
				)

				m.EXPECT().GetMonthlyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						fr.Mu.Lock()
						defer fr.Mu.Unlock()

						fr.Rsp.Monthly = domain.FinancialAnalysisMonthly{
							Income: []domain.MonthlyMetrics{
								{Value: 3000.0, Diff: 200.0, Percentage: float64Ptr(7.14), Usage: float64Ptr(150.0), Left: float64Ptr(1000.0)},
								{Value: 2800.0, Diff: -100.0, Percentage: float64Ptr(-3.45), Usage: float64Ptr(140.0), Left: float64Ptr(1200.0)},
							},
							Expense: []domain.MonthlyMetrics{
								{Value: 2000.0, Diff: 100.0, Percentage: float64Ptr(5.26), Usage: float64Ptr(66.67), Left: float64Ptr(1000.0)},
								{Value: 1900.0, Diff: -50.0, Percentage: float64Ptr(-2.56), Usage: float64Ptr(63.33), Left: float64Ptr(1100.0)},
							},
							Savings: []domain.MonthlyMetrics{
								{Value: 1000.0, Diff: 100.0, Percentage: float64Ptr(11.11), Usage: float64Ptr(200.0), Left: float64Ptr(-500.0)},
								{Value: 900.0, Diff: -50.0, Percentage: float64Ptr(-5.26), Usage: float64Ptr(180.0), Left: float64Ptr(-400.0)},
							},
							RSavingsBalance: []domain.MonthlyMetrics{
								{Value: 15000.0, Diff: 1000.0, Percentage: float64Ptr(7.14)},
								{Value: 14000.0, Diff: 500.0, Percentage: float64Ptr(3.70)},
							},
							RCreditsBalance: []domain.MonthlyMetrics{
								{Value: -5000.0, Diff: -200.0, Percentage: float64Ptr(4.17)},
								{Value: -4800.0, Diff: 100.0, Percentage: float64Ptr(-2.04)},
							},
							Year:      []uint16{2025, 2024},
							Month:     []uint16{10, 9},
							UpdatedAt: time.Date(2025, 10, 3, 12, 0, 0, 0, time.UTC),
						}

						fr.Rsp.IncomeBudget = 3500.0
						fr.Rsp.ExpenseBudget = 3000.0
						fr.Rsp.SavingsBudget = 500.0
					},
				)
			},
			want: domain.FinancialAnalysis{
				IncomeBudget:  3500.0,
				ExpenseBudget: 3000.0,
				SavingsBudget: 500.0,
				Daily: domain.FinancialAnalysisDaily{
					Income:          []float64{100.0, 200.0, 150.0},
					Expense:         []float64{80.0, 120.0, 90.0},
					MTDIncome:       []float64{100.0, 300.0, 450.0},
					MTDExpense:      []float64{80.0, 200.0, 290.0},
					MTDSavings:      []float64{20.0, 100.0, 160.0},
					RSavingsBalance: []float64{1000.0, 1100.0, 1260.0},
					RCreditsBalance: []float64{-500.0, -620.0, -710.0},
					Date:            []string{"2025-10-01", "2025-10-02", "2025-10-03"},
					UpdatedAt:       time.Date(2025, 10, 3, 12, 0, 0, 0, time.UTC),
				},
				Monthly: domain.FinancialAnalysisMonthly{
					Income: []domain.MonthlyMetrics{
						{Value: 3000.0, Diff: 200.0, Percentage: float64Ptr(7.14), Usage: float64Ptr(150.0), Left: float64Ptr(1000.0)},
						{Value: 2800.0, Diff: -100.0, Percentage: float64Ptr(-3.45), Usage: float64Ptr(140.0), Left: float64Ptr(1200.0)},
					},
					Expense: []domain.MonthlyMetrics{
						{Value: 2000.0, Diff: 100.0, Percentage: float64Ptr(5.26), Usage: float64Ptr(66.67), Left: float64Ptr(1000.0)},
						{Value: 1900.0, Diff: -50.0, Percentage: float64Ptr(-2.56), Usage: float64Ptr(63.33), Left: float64Ptr(1100.0)},
					},
					Savings: []domain.MonthlyMetrics{
						{Value: 1000.0, Diff: 100.0, Percentage: float64Ptr(11.11), Usage: float64Ptr(200.0), Left: float64Ptr(-500.0)},
						{Value: 900.0, Diff: -50.0, Percentage: float64Ptr(-5.26), Usage: float64Ptr(180.0), Left: float64Ptr(-400.0)},
					},
					RSavingsBalance: []domain.MonthlyMetrics{
						{Value: 15000.0, Diff: 1000.0, Percentage: float64Ptr(7.14)},
						{Value: 14000.0, Diff: 500.0, Percentage: float64Ptr(3.70)},
					},
					RCreditsBalance: []domain.MonthlyMetrics{
						{Value: -5000.0, Diff: -200.0, Percentage: float64Ptr(4.17)},
						{Value: -4800.0, Diff: 100.0, Percentage: float64Ptr(-2.04)},
					},
					Year:      []uint16{2025, 2024},
					Month:     []uint16{10, 9},
					UpdatedAt: time.Date(2025, 10, 3, 12, 0, 0, 0, time.UTC),
				},
			},
			wantErr: false,
		},
		{
			name: "should return error when FormatDateTime fails with invalid date format",
			args: args{userID: "user123", date: "invalid-date"},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository calls expected since FormatDateTime should fail first
			},
			want:    domain.FinancialAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when daily analysis fails",
			args: args{userID: "user123", date: "2025-10"},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetDailyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						fr.DailyErr = errors.New("daily analysis database error")
					},
				)

				m.EXPECT().GetMonthlyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						// Monthly succeeds but daily failed
					},
				)
			},
			want:    domain.FinancialAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when monthly analysis fails",
			args: args{userID: "user123", date: "2025-10"},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetDailyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						// Daily succeeds
					},
				)

				m.EXPECT().GetMonthlyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						fr.MonthlyErr = errors.New("monthly analysis database error")
					},
				)
			},
			want:    domain.FinancialAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when both daily and monthly analysis fail",
			args: args{userID: "user123", date: "2025-10"},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetDailyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						fr.DailyErr = errors.New("daily analysis error")
					},
				)

				m.EXPECT().GetMonthlyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						fr.MonthlyErr = errors.New("monthly analysis error")
					},
				)
			},
			want:    domain.FinancialAnalysis{},
			wantErr: true,
		},
		{
			name: "should handle concurrent execution without race conditions",
			args: args{userID: "user123", date: "2025-10"},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetDailyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						// Simulate some processing time to test concurrency
						time.Sleep(10 * time.Millisecond)
						fr.Mu.Lock()
						defer fr.Mu.Unlock()
						fr.Rsp.Daily = domain.FinancialAnalysisDaily{
							Income: []float64{100.0},
						}
					},
				)

				m.EXPECT().GetMonthlyAnalysis(gomock.Any(), gomock.Any()).DoAndReturn(
					func(ctx context.Context, fr *domain.FinancialResolver) {
						defer fr.Wg.Done()
						// Simulate some processing time to test concurrency
						time.Sleep(15 * time.Millisecond)
						fr.Mu.Lock()
						defer fr.Mu.Unlock()
						fr.Rsp.Monthly = domain.FinancialAnalysisMonthly{
							Income: []domain.MonthlyMetrics{{Value: 3000.0}},
						}
					},
				)
			},
			want: domain.FinancialAnalysis{
				Daily: domain.FinancialAnalysisDaily{
					Income: []float64{100.0},
				},
				Monthly: domain.FinancialAnalysisMonthly{
					Income: []domain.MonthlyMetrics{{Value: 3000.0}},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			repo := mock.NewMockAnalysisRepository(ctrl)
			tt.mockSetup(repo)

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			got, err := svc.GetFinancialAnalysis(ctx, tt.args.userID, tt.args.date)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Equal(t, tt.want, got)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)

			assert.Equal(t, got.Daily, tt.want.Daily, "Daily analysis should match expected")
			assert.Equal(t, got.Monthly, tt.want.Monthly, "Monthly analysis should match expected")

			// Verify budget fields
			assert.Equal(t, tt.want.IncomeBudget, got.IncomeBudget, "Income budget should match")
			assert.Equal(t, tt.want.ExpenseBudget, got.ExpenseBudget, "Expense budget should match")
			assert.Equal(t, tt.want.SavingsBudget, got.SavingsBudget, "Savings budget should match")
		})
	}
}

func TestAnalysisService_GetCategoryAnalysis(t *testing.T) {
	tests := []struct {
		name       string
		userID     string
		categoryID uint64
		date       string
		mockSetup  func(m *mock.MockAnalysisRepository)
		want       domain.CategoryAnalysis
		wantErr    bool
	}{
		{
			name:       "should return analysis when repository succeeds",
			userID:     "u1",
			categoryID: 1,
			date:       "2025-08",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetCategoryAnalysis(gomock.Any(), "u1", uint64(1), gomock.Any(), gomock.Any()).
					Return(domain.CategoryAnalysis{Budget: 1000}, nil)
			},
			want:    domain.CategoryAnalysis{Budget: 1000},
			wantErr: false,
		},
		{
			name:       "should return error when date format is invalid",
			userID:     "u1",
			categoryID: 1,
			date:       "invalid-date",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository call expected
			},
			want:    domain.CategoryAnalysis{},
			wantErr: true,
		},
		{
			name:       "should return error when repository fails",
			userID:     "u1",
			categoryID: 1,
			date:       "2025-08",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetCategoryAnalysis(gomock.Any(), "u1", uint64(1), gomock.Any(), gomock.Any()).
					Return(domain.CategoryAnalysis{}, errors.New("repo error"))
			},
			want:    domain.CategoryAnalysis{},
			wantErr: true,
		},
		{
			name:       "should handle zero categoryID",
			userID:     "u1",
			categoryID: 0,
			date:       "2025-08",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetCategoryAnalysis(gomock.Any(), "u1", uint64(0), gomock.Any(), gomock.Any()).
					Return(domain.CategoryAnalysis{Budget: 0}, nil)
			},
			want:    domain.CategoryAnalysis{Budget: 0},
			wantErr: false,
		},
		{
			name:       "should handle empty userID",
			userID:     "",
			categoryID: 1,
			date:       "2025-08",
			mockSetup: func(m *mock.MockAnalysisRepository) {
				m.EXPECT().GetCategoryAnalysis(gomock.Any(), "", uint64(1), gomock.Any(), gomock.Any()).
					Return(domain.CategoryAnalysis{Budget: 500}, nil)
			},
			want:    domain.CategoryAnalysis{Budget: 500},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()
			repo := mock.NewMockAnalysisRepository(ctrl)
			tt.mockSetup(repo)

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			got, err := svc.GetCategoryAnalysis(ctx, tt.userID, tt.categoryID, tt.date)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Equal(t, tt.want, got)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestAnalysisService_GetAccountsReport(t *testing.T) {
	tests := []struct {
		name                string
		report              *domain.AccountsReport
		wantErr             bool
		financialSummaryErr error
		balanceSummaryErr   error
		financialSummary    domain.FinancialSummary
		balanceSummary      domain.BalanceSummary
	}{
		{
			name: "should return error when date validation fails",
			report: &domain.AccountsReport{
				UserID: "user1",
				Start:  time.Date(2025, 12, 1, 0, 0, 0, 0, time.UTC),
				End:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC), // End before start
			},
			wantErr: true,
		},
		{
			name: "should return error when financial summary fails",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: nil,
			},
			financialSummaryErr: errors.New("financial summary error"),
			wantErr:             true,
		},
		{
			name: "should return error when balance summary fails",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: []int64{1, 2},
			},
			balanceSummaryErr: errors.New("balance summary error"),
			wantErr:           true,
		},
		{
			name: "should return error when both repository calls fail",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: nil,
			},
			financialSummaryErr: errors.New("financial error"),
			balanceSummaryErr:   errors.New("balance error"),
			wantErr:             true,
		},
		{
			name: "should succeed when both repository calls succeed with nil accounts",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: nil,
			},
			financialSummary: domain.FinancialSummary{
				domain.Index(0): domain.MonthlyReport{
					Income:   domain.MonthlyMetrics{Value: 1000},
					Expenses: domain.MonthlyMetrics{Value: 500},
				},
			},
			balanceSummary: domain.BalanceSummary{
				Balance:          2000,
				PastMonthBalance: 1800,
				InitialBalance:   1500,
			},
			wantErr: false,
		},
		{
			name: "should succeed when both repository calls succeed with specific accounts",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: []int64{1, 2, 3},
			},
			financialSummary: domain.FinancialSummary{
				domain.Index(0): domain.MonthlyReport{
					Income:   domain.MonthlyMetrics{Value: 2000},
					Expenses: domain.MonthlyMetrics{Value: 800},
				},
			},
			balanceSummary: domain.BalanceSummary{
				Balance:          5000,
				PastMonthBalance: 4500,
				InitialBalance:   4000,
			},
			wantErr: false,
		},
		{
			name: "should succeed when empty user ID is provided",
			report: &domain.AccountsReport{
				UserID:   "",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: nil,
			},
			financialSummary: domain.FinancialSummary{},
			balanceSummary:   domain.BalanceSummary{},
			wantErr:          false,
		},
		{
			name: "should succeed when empty accounts slice is provided",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: []int64{},
			},
			financialSummary: domain.FinancialSummary{},
			balanceSummary:   domain.BalanceSummary{},
			wantErr:          false,
		},
		{
			name: "should handle concurrent execution without race conditions",
			report: &domain.AccountsReport{
				UserID:   "user1",
				Start:    time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
				End:      time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
				Accounts: nil,
			},
			financialSummary: domain.FinancialSummary{},
			balanceSummary:   domain.BalanceSummary{},
			wantErr:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			repo := mock.NewMockAnalysisRepository(ctrl)

			// Setup mock expectations only if date validation will pass
			if tt.report.Start.Before(tt.report.End) || tt.report.Start.Equal(tt.report.End) {
				repo.EXPECT().GetFinancialAccountSummary(
					gomock.Any(),
					tt.report.UserID,
					gomock.Any(),
					gomock.Any(),
					gomock.Any(),
					gomock.Any(),
				).Return(tt.financialSummary, tt.financialSummaryErr)

				repo.EXPECT().GetBalanceSummary(
					gomock.Any(),
					tt.report.UserID,
					gomock.Any(),
					gomock.Any(),
					gomock.Any(),
					gomock.Any(),
				).Return(tt.balanceSummary, tt.balanceSummaryErr)
			}

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			err := svc.GetAccountsReport(ctx, tt.report)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tt.report)
			}
		})
	}
}

func TestAnalysisService_GetAccountAnalysis(t *testing.T) {
	type args struct {
		userID    string
		accountID uint64
		date      string
	}

	tests := []struct {
		name      string
		args      args
		mockSetup func(m *mock.MockAnalysisRepository)
		want      domain.AccountAnalysis
		wantErr   bool
	}{
		{
			name: "should return account analysis when valid date and repository succeeds",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12") // 11 months back
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")   // 1 month forward

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   456,
					AccountName: "Test Account",
					Balance: []domain.MonthlyMetrics{
						{Value: 1000.0, Percentage: &[]float64{5.0}[0]},
						{Value: 1200.0, Percentage: &[]float64{7.5}[0]},
					},
					Year:  []uint16{2024, 2025},
					Month: []uint16{12, 1},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   456,
				AccountName: "Test Account",
				Balance: []domain.MonthlyMetrics{
					{Value: 1000.0, Percentage: &[]float64{5.0}[0]},
					{Value: 1200.0, Percentage: &[]float64{7.5}[0]},
				},
				Year:  []uint16{2024, 2025},
				Month: []uint16{12, 1},
			},
			wantErr: false,
		},
		{
			name: "should return empty analysis when repository returns empty result",
			args: args{
				userID:    "user123",
				accountID: 789,
				date:      "2025-06",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-07")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-07")

				emptyAnalysis := domain.AccountAnalysis{
					AccountID:   789,
					AccountName: "",
					Balance:     []domain.MonthlyMetrics{},
					Year:        []uint16{},
					Month:       []uint16{},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(789),
					expectedStart,
					expectedEnd,
				).Return(emptyAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   789,
				AccountName: "",
				Balance:     []domain.MonthlyMetrics{},
				Year:        []uint16{},
				Month:       []uint16{},
			},
			wantErr: false,
		},
		{
			name: "should return error when date format is invalid",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "invalid-date",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository call expected due to date parsing failure
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when date is empty string",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository call expected due to date parsing failure
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when date has wrong format with day",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-11-15",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository call expected due to date parsing failure
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when date has invalid month",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-13",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository call expected due to date parsing failure
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when date has invalid year format",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "25-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				// No repository call expected due to date parsing failure
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should return error when repository fails",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(domain.AccountAnalysis{}, errors.New("database connection failed"))
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should handle zero account ID correctly",
			args: args{
				userID:    "user123",
				accountID: 0,
				date:      "2025-01",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-02")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-02")

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   0,
					AccountName: "Default Account",
					Balance:     []domain.MonthlyMetrics{{Value: 0.0}},
					Year:        []uint16{2025},
					Month:       []uint16{1},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(0),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   0,
				AccountName: "Default Account",
				Balance:     []domain.MonthlyMetrics{{Value: 0.0}},
				Year:        []uint16{2025},
				Month:       []uint16{1},
			},
			wantErr: false,
		},
		{
			name: "should handle maximum uint64 account ID correctly",
			args: args{
				userID:    "user123",
				accountID: 18446744073709551615, // max uint64
				date:      "2025-01",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-02")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-02")

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   18446744073709551615,
					AccountName: "Max ID Account",
					Balance:     []domain.MonthlyMetrics{{Value: 999999.99}},
					Year:        []uint16{2025},
					Month:       []uint16{1},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(18446744073709551615),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   18446744073709551615,
				AccountName: "Max ID Account",
				Balance:     []domain.MonthlyMetrics{{Value: 999999.99}},
				Year:        []uint16{2025},
				Month:       []uint16{1},
			},
			wantErr: false,
		},
		{
			name: "should handle empty user ID correctly",
			args: args{
				userID:    "",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")

				// Repository should still be called with empty userID
				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(domain.AccountAnalysis{}, errors.New("unauthorized"))
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should handle very long user ID correctly",
			args: args{
				userID: "very-long-user-id-that-might-cause-issues-in-some-systems-" +
					"with-extremely-long-strings-that-exceed-normal-limits-" +
					"and-could-potentially-break-things-if-not-handled-properly",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")

				longUserID := "very-long-user-id-that-might-cause-issues-in-some-systems-" +
					"with-extremely-long-strings-that-exceed-normal-limits-" +
					"and-could-potentially-break-things-if-not-handled-properly"

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   456,
					AccountName: "Long User Account",
					Balance:     []domain.MonthlyMetrics{{Value: 500.0}},
					Year:        []uint16{2025},
					Month:       []uint16{11},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					longUserID,
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   456,
				AccountName: "Long User Account",
				Balance:     []domain.MonthlyMetrics{{Value: 500.0}},
				Year:        []uint16{2025},
				Month:       []uint16{11},
			},
			wantErr: false,
		},
		{
			name: "should handle leap year edge case correctly",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2024-02", // leap year February
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2023-03")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2024-03")

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   456,
					AccountName: "Leap Year Account",
					Balance:     []domain.MonthlyMetrics{{Value: 2024.02}},
					Year:        []uint16{2024},
					Month:       []uint16{2},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   456,
				AccountName: "Leap Year Account",
				Balance:     []domain.MonthlyMetrics{{Value: 2024.02}},
				Year:        []uint16{2024},
				Month:       []uint16{2},
			},
			wantErr: false,
		},
		{
			name: "should return error when context is cancelled",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(domain.AccountAnalysis{}, context.Canceled)
			},
			want:    domain.AccountAnalysis{},
			wantErr: true,
		},
		{
			name: "should handle negative balance values correctly",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   456,
					AccountName: "Negative Balance Account",
					Balance: []domain.MonthlyMetrics{
						{Value: -500.0, Percentage: &[]float64{-10.0}[0]},
						{Value: -1000.0, Percentage: &[]float64{-20.0}[0]},
					},
					Year:  []uint16{2024, 2025},
					Month: []uint16{12, 1},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   456,
				AccountName: "Negative Balance Account",
				Balance: []domain.MonthlyMetrics{
					{Value: -500.0, Percentage: &[]float64{-10.0}[0]},
					{Value: -1000.0, Percentage: &[]float64{-20.0}[0]},
				},
				Year:  []uint16{2024, 2025},
				Month: []uint16{12, 1},
			},
			wantErr: false,
		},
		{
			name: "should handle nil percentage values correctly",
			args: args{
				userID:    "user123",
				accountID: 456,
				date:      "2025-11",
			},
			mockSetup: func(m *mock.MockAnalysisRepository) {
				expectedStart, _ := time.Parse(enums.YearMonthLayout, "2024-12")
				expectedEnd, _ := time.Parse(enums.YearMonthLayout, "2025-12")

				expectedAnalysis := domain.AccountAnalysis{
					AccountID:   456,
					AccountName: "Nil Percentage Account",
					Balance: []domain.MonthlyMetrics{
						{Value: 1000.0, Percentage: nil},
						{Value: 1200.0, Percentage: nil},
					},
					Year:  []uint16{2024, 2025},
					Month: []uint16{12, 1},
				}

				m.EXPECT().GetAccountAnalysis(
					gomock.Any(),
					"user123",
					uint64(456),
					expectedStart,
					expectedEnd,
				).Return(expectedAnalysis, nil)
			},
			want: domain.AccountAnalysis{
				AccountID:   456,
				AccountName: "Nil Percentage Account",
				Balance: []domain.MonthlyMetrics{
					{Value: 1000.0, Percentage: nil},
					{Value: 1200.0, Percentage: nil},
				},
				Year:  []uint16{2024, 2025},
				Month: []uint16{12, 1},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			repo := mock.NewMockAnalysisRepository(ctrl)
			tt.mockSetup(repo)

			svc := NewAnalysisService(repo)
			ctx := context.Background()

			got, err := svc.GetAccountAnalysis(ctx, tt.args.userID, tt.args.accountID, tt.args.date)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Equal(t, domain.AccountAnalysis{}, got)
				return
			}

			assert.Equal(t, tt.want, got)
		})
	}
}
