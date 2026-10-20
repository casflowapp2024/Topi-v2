package domain

import (
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"math"
	"sort"
	"time"
)

type Index int8

type FinancialReport struct {
	BalanceReport
	MonthlyReport
}

func (f *FinancialReport) SetFinancialReport(
	financialSummary FinancialSummary,
	savingsBalance BalanceSummary,
	creditsBalance BalanceSummary,
) {
	f.MonthlyReport = financialSummary.CreateMonthlyReport()
	f.BalanceReport.SavingsBalance = savingsBalance.CalculateBalance(false)
	f.BalanceReport.CreditsBalance = creditsBalance.CalculateBalance(true)
}

type BalanceReport struct {
	SavingsBalance MonthlyMetrics
	CreditsBalance MonthlyMetrics
}

type BalanceSummary struct {
	Balance          float64
	PastMonthBalance float64
	InitialBalance   float64
}

func (bs *BalanceSummary) CalculateBalance(credits bool) MonthlyMetrics {
	var (
		thisMonthBalance     = bs.Balance + bs.PastMonthBalance + bs.InitialBalance
		pastMonthBalanceFull float64
	)

	if bs.PastMonthBalance != 0 {
		pastMonthBalanceFull = bs.PastMonthBalance + bs.InitialBalance
	}

	if credits {
		return CreditsBalanceMetrics(thisMonthBalance, pastMonthBalanceFull)
	}

	return SavingsBalanceMetrics(thisMonthBalance, pastMonthBalanceFull)
}

type FinancialSummary map[Index]MonthlyReport

func (f *FinancialSummary) CreateMonthlyReport() MonthlyReport {
	var m MonthlyReport

	if len(*f) < 1 {
		return m
	}

	thisMonth, pastMonth := f.NormalizeMonthSummary()

	return MonthlyReport{
		Income: IncomeMetrics(
			thisMonth.Income.Value,
			pastMonth.Income.Value,
			0,
		),
		Expenses: ExpenseMetrics(
			thisMonth.Expenses.Value,
			pastMonth.Expenses.Value,
			0,
		),
	}
}

func (f *FinancialSummary) NormalizeMonthSummary() (thisMonth, pastMonth MonthlyReport) {
	summary := *f

	thisMonth = summary[Index(0)]
	pastMonth = summary[Index(1)]

	// If only one month exists and current month differs from month, it means a new month has started
	// and doesn't have any data yet, so we map the first value of the summary (thisMonth) to pastMonth
	// and reset thisMonth to an empty MonthlyReport. This prevents showing last month's data as current month data.
	if len(summary) == 1 && thisMonth.Month != thisMonth.CurrentMonth {
		pastMonth = thisMonth
		thisMonth = MonthlyReport{}
	}

	return thisMonth, pastMonth
}

type MonthlyReport struct {
	Income       MonthlyMetrics
	Expenses     MonthlyMetrics
	Month        uint8
	CurrentMonth uint8
}

// =============================================================================
// Categories Report
// =============================================================================

type CategoriesReport struct {
	Income   FlowReport
	Expenses FlowReport
}

type FlowReport struct {
	Value  float64
	Budget float64
	Left   float64
	Report []CategoryMetric
}

type CategoryMetric struct {
	CategoryID uint64
	Name       string
	Emoji      string
	MonthlyMetrics
}

func (c *CategoryMetric) SetMetric(value, budget float64, income bool) {
	var metric MonthlyMetrics

	if income {
		metric = IncomeMetrics(value, 0, budget)
	} else {
		metric = ExpenseMetrics(value, 0, budget)
	}

	if metric.Usage == nil {
		metric.Usage = utils.RoundV3(0, 2)

		if metric.Value != 0 {
			metric.Usage = utils.RoundV3(100, 2)
		}
	}

	if metric.Left == nil {
		metric.Left = utils.RoundV3(0, 2)
	}

	c.MonthlyMetrics = metric
}

func (r *CategoriesReport) SortReport(sortBy *string) {
	if sortBy == nil || *sortBy == "" || *sortBy == enums.Amount {
		sort.Slice(r.Income.Report, func(i, j int) bool {
			return r.Income.Report[i].Value > r.Income.Report[j].Value
		})

		sort.Slice(r.Expenses.Report, func(i, j int) bool {
			return r.Expenses.Report[i].Value < r.Expenses.Report[j].Value
		})

		return
	}

	sort.Slice(r.Income.Report, func(i, j int) bool {
		usageI := utils.Normalize(r.Income.Report[i].Usage)
		usageJ := utils.Normalize(r.Income.Report[j].Usage)
		return usageI > usageJ
	})

	sort.Slice(r.Expenses.Report, func(i, j int) bool {
		usageI := utils.Normalize(r.Expenses.Report[i].Usage)
		usageJ := utils.Normalize(r.Expenses.Report[j].Usage)
		return usageI > usageJ
	})
}

func (r *CategoriesReport) CalculateFlowReport() {
	for _, income := range r.Income.Report {
		r.Income.Budget += income.Budget
		r.Income.Left += utils.Normalize(income.Left)
		r.Income.Value += income.Value
	}

	for _, expense := range r.Expenses.Report {
		r.Expenses.Budget += expense.Budget
		r.Expenses.Left += utils.Normalize(expense.Left)
		r.Expenses.Value += expense.Value
	}
}

// =============================================================================
// Account Balance
// =============================================================================

type BalanceByAccount struct {
	AccountID      uint64  `json:"account_id"`
	Name           string  `json:"name"`
	Bank           string  `json:"bank"`
	LastFourDigits string  `json:"last_four_digits"`
	Balance        float64 `json:"balance"`
}

// =============================================================================
// Metrics
// =============================================================================

type MonthlyMetrics struct {
	Value      float64
	Budget     float64
	Diff       float64
	Percentage *float64
	Usage      *float64
	Left       *float64
}

func SavingsBalanceMetrics(balance, pastBalance float64) MonthlyMetrics {
	return IncomeMetrics(balance, pastBalance, 0)
}

func CreditsBalanceMetrics(balance, pastBalance float64) MonthlyMetrics {
	return ExpenseMetrics(balance, pastBalance, 0)
}

func IncomeMetrics(income, pastIncome, budget float64) MonthlyMetrics {
	if income < 0 {
		income = 0
	}

	if pastIncome < 0 {
		pastIncome = 0
	}

	if budget == 0 {
		budget = 0 // To avoid the -0
	}

	diff := utils.Round(income-pastIncome, 2)

	return MonthlyMetrics{
		Value:      utils.Round(income, 2),
		Budget:     budget,
		Diff:       diff,
		Percentage: utils.DifferencePercentage(diff, pastIncome),
		Usage:      utils.UsagePercentage(income, budget),
		Left:       utils.CalculateRemaining(income, budget),
	}
}

func ExpenseMetrics(expense, pastExpense, budget float64) MonthlyMetrics {
	if expense > 0 {
		expense = 0
	}

	if pastExpense > 0 {
		pastExpense = 0
	}

	// Multiply by -1 to allow the logic: if diff is positive, expense increased, otherwise decreased
	diff := utils.Round(expense-pastExpense, 2) * -1

	// Convert expense to positive for calculation
	// If expense is greater than budget, usage will be over 100%
	// If expense is less than budget, usage will be under 100%
	absExpense := math.Abs(expense)

	percentage := utils.DifferencePercentage(diff, math.Abs(pastExpense))
	usage := utils.UsagePercentage(absExpense, budget)
	left := utils.CalculateRemaining(absExpense, budget)

	if budget > 0 {
		budget = budget * -1
	}

	return MonthlyMetrics{
		Value:      utils.Round(expense, 2),
		Budget:     budget,
		Diff:       diff,
		Percentage: percentage,
		Usage:      usage,
		Left:       left,
	}
}

func SavingsMetrics(savings, pastSavings, budget float64) MonthlyMetrics {
	diff := utils.Round(savings-pastSavings, 2)

	if budget == 0 {
		budget = 0 // To avoid the -0
	}

	return MonthlyMetrics{
		Value:      utils.Round(savings, 2),
		Budget:     budget,
		Diff:       diff,
		Percentage: utils.DifferencePercentage(diff, pastSavings),
		Usage:      utils.UsagePercentage(savings, budget),
		Left:       utils.CalculateRemaining(savings, budget),
	}
}

// =============================================================================
// Financial Analysis
// =============================================================================

type FinancialAnalysis struct {
	IncomeBudget  float64                  `json:"income_budget"`
	ExpenseBudget float64                  `json:"expense_budget"`
	SavingsBudget float64                  `json:"savings_budget"`
	Daily         FinancialAnalysisDaily   `json:"daily"`
	Monthly       FinancialAnalysisMonthly `json:"monthly"`
}

func (f *FinancialAnalysis) SetBudgets(income, expense float64) {
	f.IncomeBudget = utils.Round(income, 2)
	f.ExpenseBudget = utils.Round(expense, 2)
	f.SavingsBudget = utils.Round(income-expense, 2)
}

type FinancialAnalysisDaily struct {
	Income          []float64
	Expense         []float64
	MTDIncome       []float64
	MTDExpense      []float64
	MTDSavings      []float64
	RSavingsBalance []float64
	RCreditsBalance []float64
	Date            []string
	UpdatedAt       time.Time
}

type FinancialAnalysisMonthly struct {
	Income          []MonthlyMetrics
	Expense         []MonthlyMetrics
	Savings         []MonthlyMetrics
	RSavingsBalance []MonthlyMetrics
	RCreditsBalance []MonthlyMetrics
	Year            []uint16
	Month           []uint16
	UpdatedAt       time.Time
}

type CategoryAnalysis struct {
	Budget  float64          `json:"budget"`
	Monthly []MonthlyMetrics `json:"monthly"`
	Year    []uint16
	Month   []uint16
}

// =============================================================================
// Accounts Report
// =============================================================================

type AccountsReport struct {
	UserID         string
	Start          time.Time
	End            time.Time
	Accounts       []int64
	AccountsType   string
	AccountTypeIDs []uint64
	Balance        MonthlyMetrics
	Savings        MonthlyMetrics
	Income         MonthlyMetrics
	Expenses       MonthlyMetrics
}

func (a *AccountsReport) SetAccountTypeIDs() {
	switch a.AccountsType {
	case enums.Savings:
		a.AccountTypeIDs = enums.SavingTypes
	case enums.Credits:
		a.AccountTypeIDs = enums.CreditTypes
	case enums.Investments:
		a.AccountTypeIDs = enums.InvestmentTypes
	default:
		a.AccountTypeIDs = enums.AllTypes
	}
}

func (a *AccountsReport) SetAccountsReport(
	summary FinancialSummary,
	balance BalanceSummary,
) {
	var (
		income  float64
		expense float64
		savings float64
	)

	totalBalance := balance.InitialBalance + balance.PastMonthBalance + balance.Balance

	for _, report := range summary {
		income += report.Income.Value
		expense += report.Expenses.Value
	}

	if expense > 0 {
		expense = 0
	}

	if a.AccountsType != enums.Credits {
		savings = income + expense // + since expense is negative
	}

	a.Balance.Value = utils.Round(totalBalance, 2)
	a.Income.Value = utils.Round(income, 2)
	a.Expenses.Value = utils.Round(expense, 2)
	a.Savings.Value = utils.Round(savings, 2)
}

func (a *AccountsReport) ValidateDates() error {
	if a.Start.After(a.End) || a.Start.Equal(a.End) {
		return ErrInvalidDateRange
	}
	return nil
}

// =============================================================================
// Accounts Analysis
// =============================================================================

// AccountAnalysis represents the account behavior analysis over time
type AccountAnalysis struct {
	AccountID   uint64           `json:"account_id"`
	AccountName string           `json:"account_name"`
	Balance     []MonthlyMetrics `json:"balance"`
	Year        []uint16         `json:"year"`
	Month       []uint16         `json:"month"`
}
