package domain

import (
	"cash-flow/internal/utils"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCalculateBalance(t *testing.T) {
	tests := []struct {
		name     string
		summary  BalanceSummary
		credits  bool
		expected MonthlyMetrics
	}{
		{
			name:     "should return zero metrics when all balances are zero and not credits",
			summary:  BalanceSummary{},
			credits:  false,
			expected: IncomeMetrics(0, 0, 0),
		},
		{
			name:     "should return zero metrics when all balances are zero and credits",
			summary:  BalanceSummary{},
			credits:  true,
			expected: ExpenseMetrics(0, 0, 0),
		},
		{
			name:     "should calculate correct metrics for positive balances (savings)",
			summary:  BalanceSummary{Balance: 100, PastMonthBalance: 50, InitialBalance: 25},
			credits:  false,
			expected: IncomeMetrics(175, 75, 0),
		},
		{
			name:     "should calculate correct metrics for positive balances (credits)",
			summary:  BalanceSummary{Balance: 100, PastMonthBalance: 50, InitialBalance: 25},
			credits:  true,
			expected: ExpenseMetrics(175, 75, 0),
		},
		{
			name:     "should handle negative balances (savings)",
			summary:  BalanceSummary{Balance: -100, PastMonthBalance: -50, InitialBalance: -25},
			credits:  false,
			expected: IncomeMetrics(-175, -75, 0),
		},
		{
			name:     "should handle negative balances (credits)",
			summary:  BalanceSummary{Balance: -100, PastMonthBalance: -50, InitialBalance: -25},
			credits:  true,
			expected: ExpenseMetrics(-175, -75, 0),
		},
		{
			name:     "should handle only initial balance (savings)",
			summary:  BalanceSummary{InitialBalance: 200},
			credits:  false,
			expected: IncomeMetrics(200, 0, 0),
		},
		{
			name:     "should handle only past month balance (credits)",
			summary:  BalanceSummary{PastMonthBalance: 150},
			credits:  true,
			expected: ExpenseMetrics(150, 150, 0),
		},
		{
			name:     "should handle large values (savings)",
			summary:  BalanceSummary{Balance: 1e6, PastMonthBalance: 2e6, InitialBalance: 3e6},
			credits:  false,
			expected: IncomeMetrics(6e6, 5e6, 0),
		},
		{
			name:     "should handle mix of positive and negative balances (credits)",
			summary:  BalanceSummary{Balance: 100, PastMonthBalance: -50, InitialBalance: 25},
			credits:  true,
			expected: ExpenseMetrics(75, -25, 0),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.summary.CalculateBalance(tc.credits)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestCreateMonthlyReport(t *testing.T) {
	tests := []struct {
		name    string
		summary FinancialSummary
		want    MonthlyReport
	}{
		{
			name:    "should return zero MonthlyReport when summary is empty",
			summary: FinancialSummary{},
			want:    MonthlyReport{},
		},
		{
			name: "should return correct metrics when only this month present and current month match",
			summary: FinancialSummary{
				0: {
					Month:        5,
					CurrentMonth: 5,
					Income:       MonthlyMetrics{Value: 100},
					Expenses:     MonthlyMetrics{Value: -50},
				},
			},
			want: MonthlyReport{
				Income:   IncomeMetrics(100, 0, 0),
				Expenses: ExpenseMetrics(-50, 0, 0),
			},
		},
		{
			name: "should return correct metrics when month and current month differ",
			summary: FinancialSummary{
				0: {
					Month:        4,
					CurrentMonth: 5,
					Income:       MonthlyMetrics{Value: 200},
					Expenses:     MonthlyMetrics{Value: -80},
				},
			},
			want: MonthlyReport{
				Income:   IncomeMetrics(0, 200, 0),
				Expenses: ExpenseMetrics(0, -80, 0),
			},
		},
		{
			name: "should return correct metrics when both month and current month are present",
			summary: FinancialSummary{
				0: {Month: 5, CurrentMonth: 5, Income: MonthlyMetrics{Value: 300}, Expenses: MonthlyMetrics{Value: -120}},
				1: {Month: 4, CurrentMonth: 5, Income: MonthlyMetrics{Value: 150}, Expenses: MonthlyMetrics{Value: -100}},
			},
			want: MonthlyReport{
				Income:   IncomeMetrics(300, 150, 0),
				Expenses: ExpenseMetrics(-120, -100, 0),
			},
		},
		{
			name: "should handle missing index 1 gracefully",
			summary: FinancialSummary{
				0: {Month: 7, CurrentMonth: 7, Income: MonthlyMetrics{Value: 500}, Expenses: MonthlyMetrics{Value: -200}},
				2: {Month: 6, CurrentMonth: 7, Income: MonthlyMetrics{Value: 250}, Expenses: MonthlyMetrics{Value: -150}},
			},
			want: MonthlyReport{
				Income:   IncomeMetrics(500, 0, 0),
				Expenses: ExpenseMetrics(-200, 0, 0),
			},
		},
		{
			name: "should handle negative income and positive expenses (edge case)",
			summary: FinancialSummary{
				0: {Month: 8, CurrentMonth: 8, Income: MonthlyMetrics{Value: -100}, Expenses: MonthlyMetrics{Value: 100}},
			},
			want: MonthlyReport{
				Income:   IncomeMetrics(-100, 0, 0),
				Expenses: ExpenseMetrics(100, 0, 0),
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.summary.CreateMonthlyReport()
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestNormalizeMonthSummary(t *testing.T) {
	tests := []struct {
		name          string
		summary       FinancialSummary
		wantThisMonth MonthlyReport
		wantPastMonth MonthlyReport
	}{
		{
			name:          "should return zero values when summary is empty",
			summary:       FinancialSummary{},
			wantThisMonth: MonthlyReport{},
			wantPastMonth: MonthlyReport{},
		},
		{
			name: "should return same report for both when month and current month are the same",
			summary: FinancialSummary{
				0: {Month: 5, CurrentMonth: 5, Income: MonthlyMetrics{Value: 100}},
			},
			wantThisMonth: MonthlyReport{Month: 5, CurrentMonth: 5, Income: MonthlyMetrics{Value: 100}},
			wantPastMonth: MonthlyReport{},
		},
		{
			name: "should return first report as pastMonth and thisMonth as empty when month and current month differ",
			summary: FinancialSummary{
				0: {Month: 4, CurrentMonth: 5, Income: MonthlyMetrics{Value: 200}},
			},
			wantThisMonth: MonthlyReport{},
			wantPastMonth: MonthlyReport{Month: 4, CurrentMonth: 5, Income: MonthlyMetrics{Value: 200}},
		},
		{
			name: "should return correct thisMonth and pastMonth when two months present",
			summary: FinancialSummary{
				0: {Month: 5, CurrentMonth: 5, Income: MonthlyMetrics{Value: 300}},
				1: {Month: 4, CurrentMonth: 5, Income: MonthlyMetrics{Value: 150}},
			},
			wantThisMonth: MonthlyReport{Month: 5, CurrentMonth: 5, Income: MonthlyMetrics{Value: 300}},
			wantPastMonth: MonthlyReport{Month: 4, CurrentMonth: 5, Income: MonthlyMetrics{Value: 150}},
		},
		{
			name: "should handle missing index 1 gracefully",
			summary: FinancialSummary{
				0: {Month: 7, CurrentMonth: 7, Income: MonthlyMetrics{Value: 500}},
				2: {Month: 6, CurrentMonth: 7, Income: MonthlyMetrics{Value: 250}},
			},
			wantThisMonth: MonthlyReport{Month: 7, CurrentMonth: 7, Income: MonthlyMetrics{Value: 500}},
			wantPastMonth: MonthlyReport{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			thisMonth, pastMonth := tc.summary.NormalizeMonthSummary()
			assert.Equal(t, tc.wantThisMonth, thisMonth)
			assert.Equal(t, tc.wantPastMonth, pastMonth)
		})
	}
}

func TestIncomeMetrics(t *testing.T) {
	tests := []struct {
		name           string
		income         float64
		pastIncome     float64
		budget         float64
		expectedResult MonthlyMetrics
	}{
		{
			name:       "should calculate usage and left when income is positive",
			income:     500,
			pastIncome: 400,
			budget:     1000,
			expectedResult: MonthlyMetrics{
				Value:      500,
				Budget:     1000,
				Diff:       100,
				Usage:      utils.RoundV3(50, 2),  // ((500 - 1000) / 1000 + 1) * 100 = 50%
				Left:       utils.RoundV3(500, 2), // 1000 - 500 = 500
				Percentage: utils.RoundV3(25, 2),  // (500-400)/400*100 = 25%
			},
		},
		{
			name:       "should calculate percentage when pastMonth is positive",
			income:     800,
			pastIncome: 600,
			budget:     1000,
			expectedResult: MonthlyMetrics{
				Value:      800,
				Budget:     1000,
				Diff:       200,
				Usage:      utils.RoundV3(80, 2),    // ((800 - 1000) / 1000 + 1) * 100 = 80%
				Left:       utils.RoundV3(200, 2),   // 1000 - 800 = 200
				Percentage: utils.RoundV3(33.33, 2), // (800-600)/600*100 = 33.33%
			},
		},
		{
			name:       "should handle income exceeding budget",
			income:     1200,
			pastIncome: 1000,
			budget:     1000,
			expectedResult: MonthlyMetrics{
				Value:      1200,
				Budget:     1000,
				Diff:       200,
				Usage:      utils.RoundV3(120, 2),  // (1200 - 1000) / 1000 + 1) * 100  = 120%
				Left:       utils.RoundV3(-200, 2), // 1000 - 1200 = -200
				Percentage: utils.RoundV3(20, 2),   // (1200-1000)/1000*100 = 20%
			},
		},
		{
			name:       "should handle zero budget",
			income:     500,
			pastIncome: 400,
			budget:     0,
			expectedResult: MonthlyMetrics{
				Value:      500,
				Budget:     0,
				Diff:       100,
				Usage:      nil,
				Left:       nil,
				Percentage: utils.RoundV3(25, 2), // (500-400)/400*100 = 25%
			},
		},
		{
			name:       "should handle negative diff (current less than past)",
			income:     300,
			pastIncome: 400,
			budget:     500,
			expectedResult: MonthlyMetrics{
				Value:      300,
				Budget:     500,
				Diff:       -100,
				Usage:      utils.RoundV3(60, 2),  // ((300 - 500) / 500 + 1) * 100 = -30%
				Left:       utils.RoundV3(200, 2), // 500 - 300 = 200
				Percentage: utils.RoundV3(-25, 2), // (300-400)/400*100 = -25%
			},
		},
		{
			name:       "should not set percentage when pastMonth is zero or negative",
			income:     300,
			pastIncome: 0,
			budget:     500,
			expectedResult: MonthlyMetrics{
				Value:      300,
				Budget:     500,
				Diff:       300,
				Usage:      utils.RoundV3(60, 2),  // ((300 - 500) / 500 + 1) * 100 = 60%
				Left:       utils.RoundV3(200, 2), // 500 - 300 = 200
				Percentage: utils.RoundV3(100, 2), // 300/300 * 100 = 100%
			},
		},
		{
			name:       "should handle negative income",
			income:     -200,
			pastIncome: -300,
			budget:     500,
			expectedResult: MonthlyMetrics{
				Value:      0,
				Budget:     500,
				Diff:       0,
				Percentage: nil,
				Usage:      utils.RoundV3(0, 2),
				Left:       utils.RoundV3(500, 2),
			},
		},
		{
			name:       "should set percentage to nil when pastMonth is negative",
			income:     0,
			pastIncome: -200,
			budget:     1000,
			expectedResult: MonthlyMetrics{
				Value:      0,
				Budget:     1000,
				Diff:       0,
				Usage:      utils.RoundV3(0, 2),    // ((0 - 1000) / 1000 + 1) * 100 = 0%
				Left:       utils.RoundV3(1000, 2), // 1000 - 0 = 1000
				Percentage: nil,
			},
		},
		{
			name:       "should handle equal current and past month",
			income:     500,
			pastIncome: 500,
			budget:     1000,
			expectedResult: MonthlyMetrics{
				Value:      500,
				Budget:     1000,
				Diff:       0,
				Usage:      utils.RoundV3(50, 2),  // ((500 - 1000) / 1000 + 1) * 100 = 50%
				Left:       utils.RoundV3(500, 2), // 1000 - 500 = 500
				Percentage: utils.RoundV3(0, 2),   // (500-500)/500*100 = 0%
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := IncomeMetrics(tc.income, tc.pastIncome, tc.budget)
			assert.Equal(t, tc.expectedResult, result)
		})
	}
}

func TestExpenseMetrics(t *testing.T) {
	tests := []struct {
		name        string
		expense     float64
		pastExpense float64
		budget      float64
		expMetrics  MonthlyMetrics
	}{
		{
			name:        "should compute percentage vs past when past expense is non-zero",
			expense:     -200,
			pastExpense: -100,
			budget:      300,
			expMetrics: MonthlyMetrics{
				Value:      -200,
				Budget:     -300,
				Diff:       100,                     // (expense - pastExpense) * -1 => (-200 - (-100)) * -1 = 100
				Percentage: utils.RoundV3(100, 2),   // (diff / abs(pastExpense)) => (100 / 100) * 100 = 100
				Usage:      utils.RoundV3(66.67, 2), // abs(expense) / budget => (200 / 300) * 100 = 66.67
				Left:       utils.RoundV3(100, 2),   // budget - abs(expense) => 300 - 200 = 100
			},
		},
		{
			name:        "should compute negative percentage when this month expense is less than past",
			expense:     -75,
			pastExpense: -100,
			budget:      200,
			expMetrics: MonthlyMetrics{
				Value:      -75,
				Budget:     -200,
				Diff:       -25,                    // (expense - pastExpense) * -1 => (-75 - (-100)) * -1 = -25
				Percentage: utils.RoundV3(-25, 2),  // (diff / abs(pastExpense)) => (-25 / 100) * 100 = -25
				Usage:      utils.RoundV3(37.5, 2), // abs(expense) / budget => (75 / 200) * 100 = 37.5
				Left:       utils.RoundV3(125, 2),  // budget - abs(expense) => 200 - 75 = 125
			},
		},
		{
			name:        "should set 100% percentage when past expense is zero and this month expense is negative",
			expense:     -200,
			pastExpense: 0,
			budget:      300,
			expMetrics: MonthlyMetrics{
				Value:      -200,
				Budget:     -300,
				Diff:       200,                     // (expense - pastExpense) * -1 => (-200 - 0) * -1 = 200
				Percentage: utils.RoundV3(100, 2),   // sign percentage since pastExpense is 0
				Usage:      utils.RoundV3(66.67, 2), // abs(expense) / budget => (200 / 300) * 100 = 66.67
				Left:       utils.RoundV3(100, 2),   // budget - abs(expense) => 300 - 200 = 100
			},
		},
		{
			name:        "should set nil percentage when both past and this month expense are zero",
			expense:     0,
			pastExpense: 0,
			budget:      100,
			expMetrics: MonthlyMetrics{
				Value:      0,
				Budget:     -100,
				Diff:       0,                     // (expense - pastExpense) * -1 => (0 - 0) * -1 = 0
				Percentage: nil,                   // nil because expense and pastExpense are 0
				Usage:      utils.RoundV3(0, 2),   // (abs(expense) - budget) / budget + 1) * 100 = 0
				Left:       utils.RoundV3(100, 2), // budget - abs(expense) => 100 - 0 = 100
			},
		},
		{
			name:        "should handle positive past expense values",
			expense:     -50,
			pastExpense: 50,
			budget:      100,
			expMetrics: MonthlyMetrics{
				Value:      -50,
				Budget:     -100,
				Diff:       50,                    // (expense - 0) * -1 => (-50 - 0) * -1 = 50
				Percentage: utils.RoundV3(100, 2), // (diff / abs(diff)) => (50 / 50) * 100 = 100
				Usage:      utils.RoundV3(50, 2),  // abs(expense) / budget => (50 / 100) * 100 = 50
				Left:       utils.RoundV3(50, 2),  // budget - abs(expense) => 100 - 50 = 50
			},
		},
		{
			name:        "should handle positive current expense values",
			expense:     100,
			pastExpense: -50,
			budget:      200,
			expMetrics: MonthlyMetrics{
				Value:      0,
				Budget:     -200,
				Diff:       -50,                    // (expense - pastExpense) * -1 => (0 - (-50) ) * -1 = -50
				Percentage: utils.RoundV3(-100, 2), // (diff / abs(pastExpense)) => (-50 / 50) * 100 = -100
				Usage:      utils.RoundV3(0, 2),    // (value - budget) / budget + 1) * 100 = (0 - 200) / 200 + 1) * 100 = 0%
				Left:       utils.RoundV3(200, 2),  // (budget - value) => 200 - 0 = 200
			},
		},
		{
			name:        "should handle both positive expenses",
			expense:     100,
			pastExpense: 50,
			budget:      200,
			expMetrics: MonthlyMetrics{
				Value:      0,
				Budget:     -200,
				Diff:       0,                     // (expense - pastExpense) * -1 => (100 - 50) * -1 = -50
				Percentage: nil,                   // nil because expenses are positive
				Usage:      utils.RoundV3(0, 2),   // nil because expense is positive
				Left:       utils.RoundV3(200, 0), // nil because expense is positive
			},
		},
		{
			name:        "should handle very small past expense",
			expense:     -100,
			pastExpense: -0.01,
			budget:      150,
			expMetrics: MonthlyMetrics{
				Value:      -100,
				Budget:     -150,
				Diff:       99.99,                    // (expense - pastExpense) * -1 => (-100 - (-0.01)) * -1 = 99.99
				Percentage: utils.RoundV3(999900, 2), // (diff / abs(pastExpense)) => (99.99 / 0.01) * 100 = 999900
				Usage:      utils.RoundV3(66.67, 2),  // abs(expense) / budget => (100 / 150) * 100 = 66.67
				Left:       utils.RoundV3(50, 2),     // budget - abs(expense) => 150 - 100 = 50
			},
		},
		{
			name:        "should handle equal expense values",
			expense:     -100,
			pastExpense: -100,
			budget:      200,
			expMetrics: MonthlyMetrics{
				Value:      -100,
				Budget:     -200,
				Diff:       0,                     // (expense - pastExpense) * -1 => (-100 - (-100)) * -1 = 0
				Percentage: utils.RoundV3(0, 2),   // (diff / abs(pastExpense)) => (0 / 100) * 100 = 0
				Usage:      utils.RoundV3(50, 2),  // abs(expense) / budget => (100 / 200) * 100 = 50
				Left:       utils.RoundV3(100, 2), // budget - abs(expense) => 200 - 100 = 100
			},
		},
		{
			name:        "should handle expense over budget",
			expense:     -300,
			pastExpense: -200,
			budget:      250,
			expMetrics: MonthlyMetrics{
				Value:      -300,
				Budget:     -250,
				Diff:       100,                   // (expense - pastExpense) * -1 => (-300 - (-200)) * -1 = 100
				Percentage: utils.RoundV3(50, 2),  // (diff / abs(pastExpense)) => (100 / 200) * 100 = 50
				Usage:      utils.RoundV3(120, 2), // abs(expense) / budget => (300 / 250) * 100 = 120
				Left:       utils.RoundV3(-50, 2), // budget - abs(expense) => 250 - 300 = -50
			},
		},
		{
			name:        "should handle zero budget",
			expense:     -100,
			pastExpense: -50,
			budget:      0,
			expMetrics: MonthlyMetrics{
				Value:      -100,
				Budget:     0,
				Diff:       50,                    // (expense - pastExpense) * -1 => (-100 - (-50)) * -1 = 50
				Percentage: utils.RoundV3(100, 2), // (diff / abs(pastExpense)) => (50 / 50) * 100 = 100
				Usage:      nil,                   // nil because budget is 0
				Left:       nil,                   // nil because budget is 0
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			metrics := ExpenseMetrics(tc.expense, tc.pastExpense, tc.budget)

			assert.Equal(t, tc.expMetrics, metrics)
		})
	}
}

func TestSavingsMetrics(t *testing.T) {
	tests := []struct {
		name        string
		savings     float64
		pastSavings float64
		budget      float64
		expected    MonthlyMetrics
	}{
		{
			name:        "should compute percentage vs past when past month non-zero",
			savings:     200,
			pastSavings: 100,
			budget:      300,
			expected: MonthlyMetrics{
				Value:      200,
				Budget:     300,
				Diff:       100,                     // 200 - 100
				Percentage: utils.RoundV3(100, 2),   // (200 - 100) / 100 * 100 = 100
				Usage:      utils.RoundV3(66.67, 2), // (200 - 300) / 300 + 1) * 100 = 66.67
				Left:       utils.RoundV3(100, 2),   // 300 - 200 = 100
			},
		},
		{
			name:        "should compute negative percentage when savings less than past",
			savings:     75,
			pastSavings: 100,
			budget:      150,
			expected: MonthlyMetrics{
				Value:      75,
				Budget:     150,
				Diff:       -25,                   // 75 - 100
				Percentage: utils.RoundV3(-25, 2), // (75 - 100) / 100 * 100 = -25
				Usage:      utils.RoundV3(50, 2),  // (75 - 150) / 150 + 1) * 100 = 50
				Left:       utils.RoundV3(75, 2),  // 150 - 75 = 75
			},
		},
		{
			name:        "should set percentage 100 when past is zero and savings positive",
			savings:     150,
			pastSavings: 0,
			budget:      200,
			expected: MonthlyMetrics{
				Value:      150,
				Budget:     200,
				Diff:       150, // 150 - 0
				Percentage: utils.RoundV3(100, 2),
				Usage:      utils.RoundV3(75, 2), // (150 - 200) / 200 + 1) * 100 = 75
				Left:       utils.RoundV3(50, 2), // 200 - 150 = 50
			},
		},
		{
			name:        "should set percentage -100 when past is zero and savings negative",
			savings:     -50,
			pastSavings: 0,
			budget:      100,
			expected: MonthlyMetrics{
				Value:      -50,
				Budget:     100,
				Diff:       -50,                    // -50 - 0
				Percentage: utils.RoundV3(-100, 2), // -50 - 0/ 50 * 100 = -100
				Usage:      utils.RoundV3(-50, 2),  // (-50 -100/ 100 + 1) * 100 = -50
				Left:       utils.RoundV3(150, 2),  // 100 - (-50) = 150
			},
		},
		{
			name:        "should set nil percentage when both past and current savings are zero",
			savings:     0,
			pastSavings: 0,
			budget:      0,
			expected: MonthlyMetrics{
				Value:      0,
				Budget:     0,
				Diff:       0, // 0 - 0
				Percentage: nil,
				Usage:      nil,
				Left:       nil,
			},
		},
		{
			name:        "should handle negative past savings values",
			savings:     100,
			pastSavings: -50,
			budget:      200,
			expected: MonthlyMetrics{
				Value:      100,
				Budget:     200,
				Diff:       150,                   // 100 - (-50)
				Percentage: utils.RoundV3(300, 2), // (100 - (-50)) / (-50) * 100 = 300 (sign flipped)
				Usage:      utils.RoundV3(50, 2),  // (100 - 200) / 200 + 1) * 100 = 50
				Left:       utils.RoundV3(100, 2), // 200 - 100 = 100
			},
		},
		{
			name:        "should handle both negative savings values",
			savings:     -100,
			pastSavings: -50,
			budget:      0,
			expected: MonthlyMetrics{
				Value:      -100,
				Budget:     0,
				Diff:       -50,                    // -100 - (-50)
				Percentage: utils.RoundV3(-100, 2), // (-100 - (-50)) / (-50) * 100 = -100 (sign flipped)
				Usage:      nil,                    // No budget when the budget is zero
				Left:       nil,                    // No budget when the budget is zero
			},
		},
		{
			name:        "should handle zero budget with non-zero savings",
			savings:     250,
			pastSavings: 0,
			budget:      0,
			expected: MonthlyMetrics{
				Value:      250,
				Budget:     0,
				Diff:       250,
				Percentage: utils.RoundV3(100, 2), // (250 - 0) / 0 * 100 = 100
				Usage:      nil,                   // No budget when the budget is zero
				Left:       nil,                   // No budget when the budget is zero
			},
		},
		{
			name:        "should handle very small past savings values",
			savings:     100,
			pastSavings: 0.01,
			budget:      150,
			expected: MonthlyMetrics{
				Value:      100,
				Budget:     150,
				Diff:       99.99,                    // 100 - 0.01
				Percentage: utils.RoundV3(999900, 2), // (100 - 0.01) / 0.01 * 100 = 999900
				Usage:      utils.RoundV3(66.67, 2),  // (100 - 150) / 150 + 1) * 100 = 66.67
				Left:       utils.RoundV3(50, 2),     // 150 - 100 = 50
			},
		},
		{
			name:        "should handle very small negative past savings values",
			savings:     100,
			pastSavings: -0.01,
			budget:      200,
			expected: MonthlyMetrics{
				Value:      100,
				Budget:     200,
				Diff:       100.01,                    // 100 - (-0.01)
				Percentage: utils.RoundV3(1000100, 2), // (100 - (-0.01)) / (-0.01) * 100 = 1000100 (sign flipped)
				Usage:      utils.RoundV3(50, 2),      // (100 - 200) / 200 + 1) * 100 = 50
				Left:       utils.RoundV3(100, 2),     // 200 - 100 = 100
			},
		},
		{
			name:        "should handle equal savings values",
			savings:     100,
			pastSavings: 100,
			budget:      100,
			expected: MonthlyMetrics{
				Value:      100,
				Budget:     100,
				Diff:       0,                     // 100 - 100
				Percentage: utils.RoundV3(0, 2),   // (100 - 100) / 100 * 100 = 0
				Usage:      utils.RoundV3(100, 2), // (100 - 100) / 100 + 1) * 100 = 100
				Left:       utils.RoundV3(0, 2),   // 100 - 100 = 0
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := SavingsMetrics(tc.savings, tc.pastSavings, tc.budget)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestAccountsReport_SetAccountTypeIDs(t *testing.T) {
	tests := []struct {
		name            string
		accountsType    string
		expectedTypeIDs []uint64
	}{
		{
			name:            "should set SavingTypes when AccountsType is Savings",
			accountsType:    "savings",
			expectedTypeIDs: []uint64{1, 2},
		},
		{
			name:            "should set CreditTypes when AccountsType is Credits",
			accountsType:    "credits",
			expectedTypeIDs: []uint64{4},
		},
		{
			name:            "should set InvestmentTypes when AccountsType is Investments",
			accountsType:    "investments",
			expectedTypeIDs: []uint64{3},
		},
		{
			name:            "should set AllTypes when AccountsType is empty string",
			accountsType:    "",
			expectedTypeIDs: []uint64{1, 2, 4, 3},
		},
		{
			name:            "should set AllTypes when AccountsType is unknown value",
			accountsType:    "unknown",
			expectedTypeIDs: []uint64{1, 2, 4, 3},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			report := &AccountsReport{
				AccountsType: tt.accountsType,
			}

			// Act
			report.SetAccountTypeIDs()

			// Assert
			assert.Equal(t, tt.expectedTypeIDs, report.AccountTypeIDs)
		})
	}
}

func TestAccountsReport_SetAccountsReport(t *testing.T) {
	tests := []struct {
		name            string
		accountsType    string
		summary         FinancialSummary
		balance         BalanceSummary
		expectedBalance float64
		expectedIncome  float64
		expectedExpense float64
		expectedSavings float64
	}{
		{
			name:         "should calculate correct values when summary has single month data",
			accountsType: "savings",
			summary: FinancialSummary{
				0: {Income: MonthlyMetrics{Value: 1000}, Expenses: MonthlyMetrics{Value: -500}},
			},
			balance:         BalanceSummary{Balance: 200, PastMonthBalance: 300, InitialBalance: 100},
			expectedBalance: 600,  // 200 + 300 + 100
			expectedIncome:  1000, // 1000
			expectedExpense: -500, // -500
			expectedSavings: 500,  // 1000 + (-500) = 500 (savings type)
		},
		{
			name:         "should calculate correct values when summary has multiple months data",
			accountsType: "savings",
			summary: FinancialSummary{
				0: {Income: MonthlyMetrics{Value: 1500}, Expenses: MonthlyMetrics{Value: -800}},
				1: {Income: MonthlyMetrics{Value: 1200}, Expenses: MonthlyMetrics{Value: -600}},
			},
			balance:         BalanceSummary{Balance: 500, PastMonthBalance: 400, InitialBalance: 200},
			expectedBalance: 1100,  // 500 + 400 + 200
			expectedIncome:  2700,  // 1500 + 1200
			expectedExpense: -1400, // -800 + (-600)
			expectedSavings: 1300,  // 2700 + (-1400) = 1300 (savings type)
		},
		{
			name:         "should not calculate savings when AccountsType is credits",
			accountsType: "credits",
			summary: FinancialSummary{
				0: {Income: MonthlyMetrics{Value: 500}, Expenses: MonthlyMetrics{Value: -300}},
			},
			balance:         BalanceSummary{Balance: 100, PastMonthBalance: 50, InitialBalance: 25},
			expectedBalance: 175,  // 100 + 50 + 25
			expectedIncome:  500,  // 500
			expectedExpense: -300, // -300
			expectedSavings: 0,    // 0 (credits type)
		},
		{
			name:            "should handle empty summary correctly",
			accountsType:    "savings",
			summary:         FinancialSummary{},
			balance:         BalanceSummary{Balance: 300, PastMonthBalance: 200, InitialBalance: 100},
			expectedBalance: 600, // 300 + 200 + 100
			expectedIncome:  0,   // 0 (no summary data)
			expectedExpense: 0,   // 0 (no summary data)
			expectedSavings: 0,   // 0 + 0 = 0 (savings type)
		},
		{
			name:         "should handle negative balance values correctly",
			accountsType: "investments",
			summary: FinancialSummary{
				0: {Income: MonthlyMetrics{Value: 2000}, Expenses: MonthlyMetrics{Value: -1500}},
			},
			balance:         BalanceSummary{Balance: -100, PastMonthBalance: -50, InitialBalance: -25},
			expectedBalance: -175,  // -100 + (-50) + (-25)
			expectedIncome:  2000,  // 2000
			expectedExpense: -1500, // -1500
			expectedSavings: 500,   // 2000 + (-1500) = 500 (not credits)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			report := &AccountsReport{
				AccountsType: tt.accountsType,
			}

			// Act
			report.SetAccountsReport(tt.summary, tt.balance)

			// Assert
			assert.Equal(t, tt.expectedBalance, report.Balance.Value)
			assert.Equal(t, tt.expectedIncome, report.Income.Value)
			assert.Equal(t, tt.expectedExpense, report.Expenses.Value)
			assert.Equal(t, tt.expectedSavings, report.Savings.Value)
		})
	}
}

func TestAccountsReport_ValidateDates(t *testing.T) {
	tests := []struct {
		name        string
		start       time.Time
		end         time.Time
		expectError bool
	}{
		{
			name:        "should return nil when start date is before end date",
			start:       time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			end:         time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC),
			expectError: false,
		},
		{
			name:        "should return error when start date is after end date",
			start:       time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC),
			end:         time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			expectError: true,
		},
		{
			name:        "should return error when start date equals end date",
			start:       time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC),
			end:         time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC),
			expectError: true,
		},
		{
			name:        "should return nil when dates span multiple months",
			start:       time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			end:         time.Date(2024, 3, 31, 0, 0, 0, 0, time.UTC),
			expectError: false,
		},
		{
			name:        "should return nil when dates differ by one day",
			start:       time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			end:         time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			report := &AccountsReport{
				Start: tt.start,
				End:   tt.end,
			}

			// Act
			err := report.ValidateDates()

			// Assert
			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, ErrInvalidDateRange, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
