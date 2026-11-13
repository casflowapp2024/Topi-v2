package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// AnalysisRepository implements port.TransactionRepository interface
// and provides access to the postgres database
type AnalysisRepository struct {
	db *postgres.DB
}

// NewAnalysisRepository creates a new transaction repository instance
func NewAnalysisRepository(db *postgres.DB) *AnalysisRepository {
	return &AnalysisRepository{
		db,
	}
}

// flowAmountCalc is a transaction's flow in the user's base currency: positive for income,
// negative for expenses and zero for transfer legs (they move money between the user's accounts),
// including a card payment still waiting for its other leg.
// Reports by category keep counting transfer legs: the user's category still applies to budgets.
const flowAmountCalc = "case when t.transfer_group_id is not null or t.needs_counterpart then 0 " +
	"when t.expense is false then t.amount_base else -t.amount_base end"

// otherLegInInvestment is true when the transfer leg t has its other leg in an investment account.
const otherLegInInvestment = `exists (
	select 1 from transactions o
	join accounts oa on oa.id = o.account_id
	join account_types oat on oat.id = oa.type_id
	where o.transfer_group_id = t.transfer_group_id and o.id <> t.id and oat.class = 'investment')`

// countsInBudget is the rule of the reports by category: a transfer only uses a budget when it moves
// money to or from an investment account. Between the user's own cash accounts, or paying a card,
// nothing was spent, even if the two legs have different categories.
const countsInBudget = "not t.needs_counterpart and (t.transfer_group_id is null or " + otherLegInInvestment + ")"

// GetCardCharges returns the card charges (function card_charges) of the months from start to end.
func (ar *AnalysisRepository) GetCardCharges(ctx context.Context, userID string, start, end time.Time) ([]domain.CardCharge, error) {
	out := make([]domain.CardCharge, 0)
	rows, err := ar.db.Query(ctx, `
		SELECT account_id, account_name, currency, statement_date, charged_on, amount::text, amount_base::text
		FROM card_charges($1)
		WHERE amount_base IS NOT NULL
		  AND charged_on >= date_trunc('month', $2::date)
		  AND charged_on < date_trunc('month', $3::date) + INTERVAL '1 month'
		ORDER BY charged_on, account_id`, userID, start, end)
	if err != nil {
		return out, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			charge             domain.CardCharge
			amount, amountBase string
		)
		if err := rows.Scan(&charge.AccountID, &charge.AccountName, &charge.Currency, &charge.StatementDate, &charge.ChargedOn, &amount, &amountBase); err != nil {
			return out, err
		}
		if charge.Amount, err = decimal.NewFromString(amount); err != nil {
			return out, err
		}
		if charge.AmountBase, err = decimal.NewFromString(amountBase); err != nil {
			return out, err
		}
		out = append(out, charge)
	}
	return out, rows.Err()
}

type installmentShift struct {
	day        string
	categoryID uint64
	amount     float64 // positive: more expense that day
}

// installmentShifts moves what a purchase in installments does not weigh in its month to the months of
// the other installments: out of the purchase day and into the first day of each month, so a month
// knows its installments from the start and the daily series adds up to the report by category.
func (ar *AnalysisRepository) installmentShifts(ctx context.Context, userID string, start, end time.Time) ([]installmentShift, error) {
	rows, err := ar.db.Query(ctx, `
		WITH spread AS (
			SELECT s.purchased_on, s.budget_date, s.category_id, s.amount_base
			FROM installment_schedule($1) s
			JOIN categories c ON c.id = s.category_id AND c.income IS FALSE
			WHERE s.installment > 1 AND s.amount_base IS NOT NULL AND s.purchased_on >= $4::date
		)
		SELECT to_char(x.day, 'YYYY-MM-DD'), x.category_id, sum(x.amount)::float8
		FROM (
			SELECT purchased_on AS day, category_id, -amount_base AS amount FROM spread
			UNION ALL
			SELECT date_trunc('month', budget_date)::date, category_id, amount_base FROM spread
		) x
		WHERE x.day >= date_trunc('month', $2::date) AND x.day < date_trunc('month', $3::date) + INTERVAL '1 month'
		GROUP BY 1, 2`, userID, start, end, domain.InstallmentsFrom)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	var out []installmentShift
	for rows.Next() {
		var shift installmentShift
		if err := rows.Scan(&shift.day, &shift.categoryID, &shift.amount); err != nil {
			return nil, err
		}
		out = append(out, shift)
	}
	return out, rows.Err()
}

// extraExpensesByDay is what the expense flows do not have by themselves, by day (YYYY-MM-DD): the card
// charges and the installments. Positive: more expense that day.
func (ar *AnalysisRepository) extraExpensesByDay(ctx context.Context, userID string, start, end time.Time) (map[string]float64, error) {
	out, err := ar.cardChargesByDay(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	shifts, err := ar.installmentShifts(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	for _, shift := range shifts {
		out[shift.day] += shift.amount
	}
	return out, nil
}

// cardChargesByDay sums the charges in the base currency by day (YYYY-MM-DD)
func (ar *AnalysisRepository) cardChargesByDay(ctx context.Context, userID string, start, end time.Time) (map[string]float64, error) {
	charges, err := ar.GetCardCharges(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	out := make(map[string]float64)
	for _, c := range charges {
		out[c.ChargedOn.Format("2006-01-02")] += c.AmountBase.InexactFloat64()
	}
	return out, nil
}

// byMonth rolls a map by day up to a map by month (YYYY-MM)
func byMonth(days map[string]float64) map[string]float64 {
	out := make(map[string]float64)
	for day, amount := range days {
		out[day[:7]] += amount
	}
	return out
}

// GetFinancialSummary retrieves a financial summary for a user, including income and expenses
// grouped by month. The summary includes data for the specified time range, with
// transactions properly adjusted to the user's timezone.
//
// The function calculates income from saving-type accounts and expenses from all account types,
// using the user's timezone settings to ensure accurate monthly grouping.
//
// Parameters:
//   - ctx: The context for the database operation
//   - userID: The ID of the user whose financial summary is being retrieved
//   - start: The start time for the financial summary period
//   - end: The end time for the financial summary period
//
// Returns:
//   - domain.FinancialSummary containing monthly financial reports with income and expense data
//   - An error if the database query fails, or nil if successful
func (ar *AnalysisRepository) GetFinancialSummary(
	ctx context.Context,
	userID string,
	start time.Time,
	end time.Time,
) (domain.FinancialSummary, error) {
	var (
		summary   = make(domain.FinancialSummary)
		lastMonth = end.AddDate(0, -1, 0)
	)

	extraByDay, err := ar.extraExpensesByDay(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	extra := byMonth(extraByDay)
	currentMonth := lastMonth.Format("2006-01")
	currentMonthFound := false

	// Date calculations in user's timezone
	userDate := "(t.date at time zone coalesce(u.utc_offset, 'utc'))::date"

	// Amount calculation in the user's base currency: positive for income, negative for expenses.
	// Transfer legs (transfer_group_id) are neither income nor expense.
	amountCalc := flowAmountCalc

	// Income: from categories marked as income AND saving/investment account types
	incomeSum := fmt.Sprintf(
		"sum(case when c.income is true and ac.type_id in (%s) then %s else 0 end)",
		sq.Placeholders(len(enums.SavingAndInvestmentTypes)),
		amountCalc,
	)

	// Expenses: from categories marked as NOT income AND saving/credit account types
	expenseSum := fmt.Sprintf(
		"sum(case when c.income is false and ac.type_id in (%s) then %s else 0 end)",
		sq.Placeholders(len(enums.SavingAndCreditTypes)),
		amountCalc,
	)

	query := ar.db.QueryBuilder.Select(
		"extract(year from "+userDate+") as year",
		"extract(month from "+userDate+") as month",
		"extract(month from ?::date) as last_month",
		incomeSum+" as income",
		expenseSum+" as expense",
	).
		From(enums.TransactionsTableName + " AS t").
		LeftJoin(enums.AccountTableName + " ac ON ac.id = t.account_id").
		LeftJoin(enums.CategoryTableName + " c ON c.id = t.category_id").
		LeftJoin(enums.UserExtraTableName + " u ON u.user_id = t.user_id").
		Where(sq.Eq{"t.user_id": userID}).
		Where(sq.Expr(userDate+" >= ?::date", start)).
		Where(sq.Expr(userDate+" < ?::date", end)).
		GroupBy("year, month").
		OrderBy("year DESC, month DESC")

	sqlQuery, args, err := query.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	// Combine all arguments in the correct order
	finalArgs := utils.PrepareQueryArgs(
		lastMonth, // For last_month calculation
		enums.SavingAndInvestmentTypes,
		enums.SavingAndCreditTypes,
		args,
	)

	rows, err := ar.db.Query(ctx, sqlQuery, finalArgs...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	// Process results
	index := domain.Index(0)
	for rows.Next() {
		var report domain.MonthlyReport
		var year uint16

		err = rows.Scan(
			&year,
			&report.Month,
			&report.CurrentMonth,
			&report.Income.Value,
			&report.Expenses.Value,
		)

		if err != nil {
			return nil, err
		}

		month := fmt.Sprintf("%04d-%02d", year, report.Month)
		currentMonthFound = currentMonthFound || month == currentMonth
		report.Expenses.Value -= extra[month]
		summary[index] = report
		index++
	}

	// Un mes sin movimientos también tiene sus cuotas
	if amount := extra[currentMonth]; !currentMonthFound && amount != 0 {
		if past, ok := summary[0]; ok {
			summary[1] = past
		}
		current := domain.MonthlyReport{Month: uint8(lastMonth.Month()), CurrentMonth: uint8(lastMonth.Month())}
		current.Expenses.Value = -amount
		summary[0] = current
	}

	return summary, nil
}

// GetBalanceSummary retrieves a summary of balances for a user's accounts, filtered by account types.
// It calculates and returns three key financial metrics:
//   - Initial Balance: The sum of initial balances across selected accounts
//   - Past Month Balance: The sum of balances from previous months
//   - Current Month Balance: Net transactions (income minus expenses) for the specified time range
//
// The function uses the user's timezone settings to ensure accurate time boundaries
// when calculating the current period balance.
//
// Parameters:
//   - ctx: The context for the database operation
//   - userID: The ID of the user whose balance summary is being retrieved
//   - accountTypes: A slice of account type IDs to filter which accounts are included
//   - startTime: The start time for the balance summary period
//   - endTime: The end time for the balance summary period
//
// Returns:
//   - domain.BalanceSummary containing initial balance, past month balance, and current balance
//   - An error if the database query fails, or nil if successful
func (ar *AnalysisRepository) GetBalanceSummary(
	ctx context.Context,
	userID string,
	start time.Time,
	end time.Time,
	accountTypes []uint64,
	accounts []int64,
) (domain.BalanceSummary, error) {
	var summary = domain.BalanceSummary{}

	// Accounts can have different currencies: each account's native amounts are converted to the
	// user's base currency with the rate of the last day of the period (today at most).
	toBase := "fx_rate_at(a.currency, user_base_currency(a.user_id), least(?::date - 1, current_date))"

	// Query for initial balance
	initialBalance := ar.db.QueryBuilder.Select().
		Column(sq.Expr("coalesce(sum(a.initial_balance * "+toBase+"), 0) as initial_balance", end)).
		From(enums.AccountTableName + " as a").
		Where(sq.Eq{"a.user_id": userID}).
		Where(sq.Eq{"a.type_id": accountTypes})

	// Native movements per account and day: daily totals plus the valuation adjustments of the
	// investments (their balance is anchored to the last valuation)
	movements := ar.db.QueryBuilder.Select("d.account_id", "d.day", "d.inflow - d.outflow as net").
		From(enums.DailyAccountTotalsTableName+" as d").
		Where(sq.Eq{"d.user_id": userID}).
		Suffix("union all select vd.account_id, vd.day, vd.delta from account_valuation_deltas(?) as vd", userID)

	// Query for past month balance (everything before the period)
	pastMonthBalance := ar.db.QueryBuilder.Select().
		Column(sq.Expr("coalesce(sum(m.net * "+toBase+"), 0) as past_month_balance", end)).
		FromSelect(movements, "m").
		Join(enums.AccountTableName + " as a on a.id = m.account_id").
		Where(sq.Eq{"a.type_id": accountTypes}).
		Where(sq.Expr("m.day < ?::date", start))

	// Query for current period movements (days are already in the user's timezone)
	currentPeriodBalance := ar.db.QueryBuilder.Select().
		Column(sq.Expr("coalesce(sum(m.net * "+toBase+"), 0) as current_period_balance", end)).
		FromSelect(movements, "m").
		Join(enums.AccountTableName + " as a on a.id = m.account_id").
		Where(sq.Eq{"a.type_id": accountTypes}).
		Where(sq.Expr("m.day >= ?::date", start)).
		Where(sq.Expr("m.day < ?::date", end))

	if len(accounts) > 0 {
		initialBalance = initialBalance.Where(sq.Eq{"a.id": accounts})
		pastMonthBalance = pastMonthBalance.Where(sq.Eq{"m.account_id": accounts})
		currentPeriodBalance = currentPeriodBalance.Where(sq.Eq{"m.account_id": accounts})
	}

	// Convert subqueries to SQL
	initialBalanceSQL, initArgs, err := initialBalance.PlaceholderFormat(sq.Question).ToSql()
	if err != nil {
		return summary, err
	}

	pastMonthBalanceSQL, pastArgs, err := pastMonthBalance.PlaceholderFormat(sq.Question).ToSql()
	if err != nil {
		return summary, err
	}

	currentPeriodBalanceSQL, currentArgs, err := currentPeriodBalance.PlaceholderFormat(sq.Question).ToSql()
	if err != nil {
		return summary, err
	}

	// Use a cross-join pattern to ensure we get exactly one row
	mainQuery := ar.db.QueryBuilder.Select(
		"("+initialBalanceSQL+") AS initial_balance",
		"("+pastMonthBalanceSQL+") AS past_month_balance",
		"("+currentPeriodBalanceSQL+") AS balance",
	)

	sqlQuery, _, err := mainQuery.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return summary, err
	}

	finalArgs := utils.PrepareQueryArgs(
		initArgs,
		pastArgs,
		currentArgs,
	)

	// Execute the query
	err = ar.db.QueryRow(ctx, sqlQuery, finalArgs...).Scan(
		&summary.InitialBalance,
		&summary.PastMonthBalance,
		&summary.Balance,
	)

	if err != nil {
		return summary, mappers.MapPostgresErrorCode(err)
	}

	return summary, nil
}

// GetBalanceByAccount retrieves detailed balance information for each account belonging to a user,
// optionally filtered by account types. It calculates the total balance by combining:
//   - Initial balance of the account
//   - Current month transactions (income minus expenses)
//   - Past month accumulated balance
//
// For each account, it includes identifying information such as account name, bank name,
// and last four digits of the account number. The results are ordered by total balance
// in descending order.
//
// Parameters:
//   - ctx: The context for the database operation
//   - userID: The ID of the user whose account balances are being retrieved
//   - accountTypes: Optional slice of account type IDs to filter which accounts are included
//
// Returns:
//   - A slice of domain.BalanceByAccount containing detailed balance information for each account
//   - An error if the database query fails, or nil if successful
func (ar *AnalysisRepository) GetBalanceByAccount(
	ctx context.Context,
	userID string,
	accountTypes []uint64,
) ([]domain.BalanceByAccount, error) {
	var accountsBalanceList = make([]domain.BalanceByAccount, 0)

	// Native balance (account currency) up to the end of the current month in the user's timezone
	nextMonth := "(date_trunc('month', now() at time zone user_timezone(a.user_id)) + interval '1 month')::date"
	movements := "(select sum(d.inflow - d.outflow) from " + enums.DailyAccountTotalsTableName +
		" as d where d.account_id = a.id and d.day < " + nextMonth + ")"
	// investments: the balance is anchored to their valuations
	valuations := "(select sum(vd.delta) from account_valuation_deltas(a.user_id) as vd" +
		" where vd.account_id = a.id and vd.day < " + nextMonth + ")"

	query := ar.db.QueryBuilder.Select(
		"a.id",
		"a.name",
		"b.name as bank",
		"a.last_four_digits",
		"coalesce(a.initial_balance, 0) + coalesce("+movements+", 0) + coalesce("+valuations+", 0) as total_balance",
	).From(enums.AccountTableName+" as a").
		LeftJoin(enums.BankTableName+" as b on a.bank_id = b.id and a.user_id = b.user_id").
		Where(sq.Eq{"a.user_id": userID}).
		OrderBy("total_balance desc", "a.id")

	if accountTypes != nil {
		query = query.Where(sq.Eq{"a.type_id": accountTypes})
	}

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return accountsBalanceList, err
	}

	rows, err := ar.db.Query(ctx, sqlQuery, args...)
	if err != nil {
		err = mappers.MapPostgresErrorCode(err)
		if errors.Is(err, domain.ErrDataNotFound) {
			return accountsBalanceList, nil
		}

		return accountsBalanceList, err
	}

	for rows.Next() {
		var balance domain.BalanceByAccount

		err = rows.Scan(
			&balance.AccountID,
			&balance.Name,
			&balance.Bank,
			&balance.LastFourDigits,
			&balance.Balance,
		)

		if err != nil {
			return accountsBalanceList, err
		}

		accountsBalanceList = append(accountsBalanceList, balance)
	}

	return accountsBalanceList, nil
}

func (ar *AnalysisRepository) GetCategoriesReport(
	ctx context.Context,
	userID string,
	filter time.Time,
) (domain.CategoriesReport, error) {
	var (
		report        domain.CategoriesReport
		incomeReport  = make([]domain.CategoryMetric, 0)
		expenseReport = make([]domain.CategoryMetric, 0)
	)

	chargesByDay, err := ar.cardChargesByDay(ctx, userID, filter, filter)
	if err != nil {
		return report, err
	}
	charged := 0.0
	for _, amount := range chargesByDay {
		charged += amount
	}
	// Si el usuario borró la categoría, vuelve: los cargos ya están en los gastos del mes
	shifts, err := ar.installmentShifts(ctx, userID, filter, filter)
	if err != nil {
		return report, err
	}
	shifted := make(map[uint64]float64)
	for _, shift := range shifts {
		shifted[shift.categoryID] += shift.amount
	}
	if charged != 0 {
		if _, err = ar.db.Exec(ctx, `
			INSERT INTO categories (user_id, name, budget, emoji, income)
			SELECT $1::varchar, $2::varchar, 0, '1f4b3', false
			WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id = $1 AND lower(name) = lower($2))`,
			userID, domain.CardChargesCategory); err != nil {
			return report, mappers.MapPostgresErrorCode(err)
		}
	}

	// Calculate the expense
	amountExpr := "coalesce(sum(case when t.expense is false then t.amount_base else -t.amount_base end), 0)"

	// Extract month and year expressions for date filtering
	convertedDate := "t.date at time zone coalesce(u.utc_offset, 'utc')"
	filterMonthExpr := "extract(month from " + convertedDate + ")"
	filterYearExpr := "extract(year from " + convertedDate + ")"
	requestedMonthExpr := "extract(month from ?::date)"
	requestedYearExpr := "extract(year from ?::date)"

	// Create subquery for filtered transactions
	transactionSubquery := ar.db.QueryBuilder.
		Select(
			amountExpr+"as amount",
			"t.category_id",
		).
		From(enums.Transactions + " as t").
		LeftJoin(enums.UserExtraTableName + " u ON u.user_id = t.user_id").
		LeftJoin(enums.AccountTableName + " as a on t.account_id = a.id").
		Where(sq.Eq{"t.user_id": userID}).
		Where(sq.Expr(filterMonthExpr+" = "+requestedMonthExpr, filter)).
		Where(sq.Expr(filterYearExpr+" = "+requestedYearExpr, filter)).
		Where(sq.Eq{"a.type_id": enums.SavingAndCreditTypes}).
		Where(countsInBudget).
		GroupBy("t.category_id")

	subquerySQL, subqueryArgs, err := transactionSubquery.PlaceholderFormat(sq.Question).ToSql()
	if err != nil {
		return report, err
	}

	query := ar.db.QueryBuilder.
		Select(
			"c.id",
			"c.name",
			"c.emoji",
			// the budget of the requested month, not the current one (plan/26-presupuestos-historicos.md)
			fmt.Sprintf("coalesce(budget_at(c.id, date '%s'), 0)", filter.Format(time.DateOnly)),
			"coalesce(t.amount, 0)",
			"c.income",
		).
		From(enums.Categories + " as c").
		LeftJoin("(" + subquerySQL + ") as t on c.id = t.category_id").
		Where(sq.Eq{"c.user_id": userID})

	sqlQuery, args, err := query.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return report, err
	}

	// Combine arguments: subquery args first, then main query args
	allArgs := utils.PrepareQueryArgs(subqueryArgs, args)

	rows, err := ar.db.Query(ctx, sqlQuery, allArgs...)
	if err != nil {
		return report, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var (
			metric        domain.CategoryMetric
			budget, value float64
			income        bool
		)

		err = rows.Scan(
			&metric.CategoryID,
			&metric.Name,
			&metric.Emoji,
			&budget,
			&value,
			&income,
		)

		if err != nil {
			return report, err
		}

		if !income {
			value -= shifted[metric.CategoryID]
			if strings.EqualFold(metric.Name, domain.CardChargesCategory) {
				value -= charged
			}
		}

		metric.SetMetric(value, budget, income)

		if income {
			incomeReport = append(incomeReport, metric)
		} else {
			expenseReport = append(expenseReport, metric)
		}
	}

	report.Income.Report = incomeReport
	report.Expenses.Report = expenseReport

	return report, nil
}

// investmentMoves is what the expense categories used of their budgets moving money to investment
// accounts (negative) or back (positive), by day, in the months from start to end. analysis_daily
// leaves transfers out of the flows, so this is what separates a flow from the use of a budget.
func (ar *AnalysisRepository) investmentMoves(ctx context.Context, userID string, start, end time.Time) (map[string]float64, error) {
	rows, err := ar.db.Query(ctx, `
		SELECT to_char(x.day, 'YYYY-MM-DD'), sum(x.amount)::float8
		FROM (
			SELECT (t.date AT TIME ZONE user_timezone($1))::date AS day,
			       CASE WHEN t.expense THEN -t.amount_base ELSE t.amount_base END AS amount
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			JOIN account_types at ON at.id = a.type_id AND at.class <> 'investment'
			JOIN categories c ON c.id = t.category_id AND c.income IS FALSE
			WHERE t.user_id = $1 AND t.transfer_group_id IS NOT NULL AND `+otherLegInInvestment+`
		) x
		WHERE x.day >= date_trunc('month', $2::date) AND x.day < date_trunc('month', $3::date) + INTERVAL '1 month'
		GROUP BY 1`, userID, start, end)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	moves := make(map[string]float64)
	for rows.Next() {
		var day string
		var amount float64
		if err := rows.Scan(&day, &amount); err != nil {
			return nil, err
		}
		moves[day] = amount
	}
	return moves, rows.Err()
}

// GetDailyAnalysis queries the daily analysis (analysis_daily) for the month of fr.End
func (ar *AnalysisRepository) GetDailyAnalysis(ctx context.Context, fr *domain.FinancialResolver) {
	defer fr.Wg.Done()

	var (
		out domain.FinancialAnalysisDaily
		err error
	)

	extra, err := ar.extraExpensesByDay(ctx, fr.UserID, fr.End, fr.End)
	if err != nil {
		fr.DailyErr = err
		return
	}
	extraInMonth := 0.0

	sqlQuery := `
		SELECT date, income, expense, mtd_income, mtd_expense, mtd_savings,
		       running_savings_balance, running_credits_balance, updated_at
		FROM ` + enums.DailyAnalysisFunction + `($1)
		WHERE extract(year from date) = extract(year from $2::date)
		  AND extract(month from date) = extract(month from $2::date)
		ORDER BY date`

	rows, err := ar.db.Query(ctx, sqlQuery, fr.UserID, fr.End)
	if err != nil {
		fr.DailyErr = mappers.MapPostgresErrorCode(err)
		return
	}

	for rows.Next() {
		var (
			date, updatedAt                                           time.Time
			income, expense                                           float64
			mtdIncome, mtdExpense, mtdSavings, runSavings, runCredits float64
		)

		if err = rows.Scan(
			&date,
			&income,
			&expense,
			&mtdIncome,
			&mtdExpense,
			&mtdSavings,
			&runSavings,
			&runCredits,
			&updatedAt,
		); err != nil {
			fr.DailyErr = err
			return
		}

		extraToday := extra[date.Format("2006-01-02")]
		extraInMonth += extraToday

		out.Income = append(out.Income, income)
		out.Expense = append(out.Expense, expense-extraToday)
		out.MTDIncome = append(out.MTDIncome, mtdIncome)
		out.MTDExpense = append(out.MTDExpense, mtdExpense-extraInMonth)
		out.MTDSavings = append(out.MTDSavings, mtdSavings-extraInMonth)
		out.RSavingsBalance = append(out.RSavingsBalance, runSavings)
		out.RCreditsBalance = append(out.RCreditsBalance, runCredits)
		out.Date = append(out.Date, date.Format("2006-01-02"))
		out.UpdatedAt = updatedAt
	}

	moves, err := ar.investmentMoves(ctx, fr.UserID, fr.End, fr.End)
	if err != nil {
		fr.DailyErr = err
		return
	}
	moved := 0.0
	for i, day := range out.Date {
		moved += moves[day]
		out.MTDBudget = append(out.MTDBudget, utils.Round(out.MTDExpense[i]+moved, 2))
	}

	defer fr.Mu.Unlock()
	fr.Mu.Lock()

	fr.Rsp.Daily = out
}

// GetMonthlyAnalysis queries the monthly analysis (analysis_monthly) for the provided date range
func (ar *AnalysisRepository) GetMonthlyAnalysis(ctx context.Context, fr *domain.FinancialResolver) {
	defer fr.Wg.Done()

	var (
		out           domain.FinancialAnalysisMonthly
		err           error
		incomeBudget  float64
		expenseBudget float64
	)

	extraByDay, err := ar.extraExpensesByDay(ctx, fr.UserID, fr.Start.AddDate(0, -1, 0), fr.End)
	if err != nil {
		fr.MonthlyErr = err
		return
	}
	extra := byMonth(extraByDay)

	// Convert year and month to a comparable numeric format (YYYYMM)
	startYearMonth := fr.Start.Year()*100 + int(fr.Start.Month())
	endYearMonth := fr.End.Year()*100 + int(fr.End.Month())

	sqlQuery := `
		SELECT ma.year, ma.month, ma.income, ma.income_past, ma.expense, ma.expense_past,
		       ma.savings, ma.savings_past, ma.running_savings_balance, ma.running_savings_balance_past,
		       ma.running_credits_balance, ma.running_credits_balance_past, ma.updated_at,
		       budgets.income_budget, budgets.expense_budget
		FROM ` + enums.MonthlyAnalysisFunction + `($1) ma
		CROSS JOIN LATERAL (
			-- each month with the budgets it had (category_budgets), not with the current ones
			SELECT coalesce(sum(b.budget) filter (where c.income = true), 0) as income_budget,
			       coalesce(sum(b.budget) filter (where c.income = false), 0) as expense_budget
			FROM ` + enums.CategoryTableName + ` c
			CROSS JOIN LATERAL (SELECT budget_at(c.id, make_date(ma.year::int, ma.month::int, 1)) AS budget) b
			WHERE c.user_id = $1
		) budgets
		WHERE (ma.year * 100 + ma.month) >= $2
		  AND (ma.year * 100 + ma.month) <= $3
		ORDER BY ma.year, ma.month`

	rows, err := ar.db.Query(ctx, sqlQuery, fr.UserID, startYearMonth, endYearMonth)
	if err != nil {
		fr.MonthlyErr = mappers.MapPostgresErrorCode(err)
		return
	}

	for rows.Next() {
		var (
			year, month                                                    uint16
			income, incomePast, expense, expensePast, savings, savingsPast float64
			runSavings, runSavingsPast, runCredits, runCreditsPast         float64
			updatedAt                                                      time.Time
		)

		if err = rows.Scan(
			&year,
			&month,
			&income,
			&incomePast,
			&expense,
			&expensePast,
			&savings,
			&savingsPast,
			&runSavings,
			&runSavingsPast,
			&runCredits,
			&runCreditsPast,
			&updatedAt,
			&incomeBudget,
			&expenseBudget,
		); err != nil {
			fr.MonthlyErr = err
			return
		}

		extraNow := extra[fmt.Sprintf("%04d-%02d", year, month)]
		pastMonth := time.Date(int(year), time.Month(month)-1, 1, 0, 0, 0, 0, time.UTC)
		extraPast := extra[pastMonth.Format("2006-01")]
		expense -= extraNow
		expensePast -= extraPast
		savings -= extraNow
		savingsPast -= extraPast

		out.Income = append(out.Income, domain.IncomeMetrics(income, incomePast, incomeBudget))
		out.Expense = append(out.Expense, domain.ExpenseMetrics(expense, expensePast, expenseBudget))
		out.Savings = append(out.Savings, domain.SavingsMetrics(savings, savingsPast, incomeBudget-expenseBudget))
		out.IncomeBudget = append(out.IncomeBudget, utils.Round(incomeBudget, 2))
		out.ExpenseBudget = append(out.ExpenseBudget, utils.Round(expenseBudget, 2))
		out.SavingsBudget = append(out.SavingsBudget, utils.Round(incomeBudget-expenseBudget, 2))
		out.RSavingsBalance = append(out.RSavingsBalance, domain.SavingsBalanceMetrics(runSavings, runSavingsPast))
		out.RCreditsBalance = append(out.RCreditsBalance, domain.CreditsBalanceMetrics(runCredits, runCreditsPast))

		// Add dates
		out.Year = append(out.Year, year)
		out.Month = append(out.Month, month)
		out.UpdatedAt = updatedAt
	}

	moves, err := ar.investmentMoves(ctx, fr.UserID, fr.Start, fr.End)
	if err != nil {
		fr.MonthlyErr = err
		return
	}
	movedByMonth := byMonth(moves)
	for i, year := range out.Year {
		key := fmt.Sprintf("%04d-%02d", year, out.Month[i])
		out.BudgetSpent = append(out.BudgetSpent, utils.Round(math.Min(out.Expense[i].Value+movedByMonth[key], 0), 2))
	}

	defer fr.Mu.Unlock()
	fr.Mu.Lock()
	fr.Rsp.Monthly = out
	// the budgets of the last month of the range (the current one when the range ends today)
	fr.Rsp.SetBudgets(incomeBudget, expenseBudget)
}

// GetCategoryAnalysis retrieves the category behavior analysis over time for the given user and category.
// It calculates monthly expenses and budget for a specific category over a date range,
// using the user's timezone settings to ensure accurate month boundaries.
//
// Parameters:
//   - ctx: The context for the database operation
//   - userID: The ID of the user whose category analysis is being retrieved
//   - categoryID: The ID of the category to analyze
//   - start: The start date of the analysis period
//   - end: The end date of the analysis period
//
// Returns:
//   - domain.CategoryAnalysis containing budget and monthly metrics for the category
//   - An error if the database query fails, or nil if successful
func (ar *AnalysisRepository) GetCategoryAnalysis(
	ctx context.Context,
	userID string,
	categoryID uint64,
	start time.Time,
	end time.Time,
) (domain.CategoryAnalysis, error) {
	var analysis domain.CategoryAnalysis

	// Create timezone expression
	convertedDate := "(t.date at time zone coalesce(u.utc_offset, 'utc'))::date"

	// Build the query using QueryBuilder
	query := ar.db.QueryBuilder.Select(
		"extract(year from "+convertedDate+") as year",
		"extract(month from "+convertedDate+") as month",
		"coalesce(max(budget_at(c.id, "+convertedDate+")), 0) as budget",
		"sum((case when t.expense then -1 else 1 end) * t.amount_base) as expense",
		"bool_or(c.income) as is_income_category",
	).
		From(enums.TransactionsTableName + " as t").
		LeftJoin(enums.AccountTableName + " as a on a.id = t.account_id and a.user_id = t.user_id").
		LeftJoin(enums.UserExtraTableName + " as u on t.user_id = u.user_id").
		LeftJoin(enums.CategoryTableName + " as c on t.category_id = c.id").
		Where(sq.Eq{"t.user_id": userID}).
		Where(sq.Eq{"a.type_id": enums.SavingAndCreditTypes}).
		Where(countsInBudget).
		Where(sq.Eq{"t.category_id": categoryID}).
		Where(sq.Expr(convertedDate+" >= ?::date", start)).
		Where(sq.Expr(convertedDate+" < ?::date", end)).
		GroupBy("1, 2").
		OrderBy("1, 2")

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return analysis, err
	}

	rows, err := ar.db.Query(ctx, sqlQuery, args...)
	if err != nil {
		return analysis, mappers.MapPostgresErrorCode(err)
	}

	var (
		monthlyMetrics      []domain.MonthlyMetrics
		yearList, monthList []uint16
		budget              float64
		monthlyBudgets      = []float64{}
	)

	type monthRow struct {
		year, month      uint16
		budget, balance  float64
		isIncomeCategory bool
	}
	var months []monthRow

	for rows.Next() {
		var m monthRow

		err = rows.Scan(&m.year, &m.month, &m.budget, &m.balance, &m.isIncomeCategory)
		if err != nil {
			return analysis, mappers.MapPostgresErrorCode(err)
		}
		months = append(months, m)
	}

	// Cargos de tarjeta y cuotas no son transacciones de ese mes: se suman a su categoría, también en
	// meses sin movimientos
	var name string
	if err = ar.db.QueryRow(ctx, "SELECT name FROM "+enums.CategoryTableName+" WHERE id = $1 AND user_id = $2",
		categoryID, userID).Scan(&name); err == nil {
		byDay := make(map[string]float64)
		if strings.EqualFold(name, domain.CardChargesCategory) {
			if byDay, err = ar.cardChargesByDay(ctx, userID, start, end.AddDate(0, 0, -1)); err != nil {
				return analysis, err
			}
		}
		shifts, err := ar.installmentShifts(ctx, userID, start, end.AddDate(0, 0, -1))
		if err != nil {
			return analysis, err
		}
		for _, shift := range shifts {
			if shift.categoryID == categoryID {
				byDay[shift.day] += shift.amount
			}
		}
		for key, amount := range byMonth(byDay) {
			var year, month uint16
			if _, err := fmt.Sscanf(key, "%d-%d", &year, &month); err != nil {
				return analysis, err
			}
			i := slices.IndexFunc(months, func(m monthRow) bool { return m.year == year && m.month == month })
			if i < 0 {
				months = append(months, monthRow{year: year, month: month, budget: -1})
				i = len(months) - 1
			}
			months[i].balance -= amount
		}
		slices.SortFunc(months, func(a, b monthRow) int { return int(a.year)*100 + int(a.month) - int(b.year)*100 - int(b.month) })
	}

	// months without transactions (only charges or installments) take the budget they had; the analysis budget is
	// the one of the last month of the range (the current one when the range ends today)
	last := end.AddDate(0, 0, -1) // end is exclusive
	budgets, err := ar.categoryBudgetsByMonth(ctx, userID, categoryID, start, last)
	if err != nil {
		return analysis, err
	}
	budget = budgets[last.Format("2006-01")]

	for i := range months {
		m := &months[i]
		if m.budget < 0 {
			m.budget = budgets[fmt.Sprintf("%04d-%02d", m.year, m.month)]
		}
		monthlyBudgets = append(monthlyBudgets, utils.Round(m.budget, 2))

		var monthlyMetric domain.MonthlyMetrics

		if m.isIncomeCategory {
			monthlyMetric = domain.IncomeMetrics(m.balance, 0, m.budget)
		} else {
			monthlyMetric = domain.ExpenseMetrics(m.balance, 0, m.budget)
		}

		monthlyMetrics = append(monthlyMetrics, monthlyMetric)
		yearList = append(yearList, m.year)
		monthList = append(monthList, m.month)
	}

	analysis.Budget = budget
	analysis.MonthlyBudget = monthlyBudgets
	analysis.Monthly = monthlyMetrics
	analysis.Year = yearList
	analysis.Month = monthList

	return analysis, nil
}

// GetAccountAnalysis retrieves the account behavior analysis over time for the given user and account.
// It calculates monthly balance, income, and expenses for a specific account over a date range,
// using analysis_monthly_accounts (native balances in the account currency).
//
// Parameters:
//   - ctx: The context for the database operation
//   - userID: The ID of the user whose account analysis is being retrieved
//   - accountID: The ID of the account to analyze
//   - start: The start date of the analysis period
//   - end: The end date of the analysis period
//
// Returns:
//   - domain.AccountAnalysis containing monthly metrics for the account
//   - An error if the database query fails, or nil if successful
func (ar *AnalysisRepository) GetAccountAnalysis(
	ctx context.Context,
	userID string,
	accountID uint64,
	start time.Time,
	end time.Time,
) (domain.AccountAnalysis, error) {
	var analysis domain.AccountAnalysis

	// Convert year and month to a comparable numeric format (YYYYMM)
	startYearMonth := start.Year()*100 + int(start.Month())
	endYearMonth := end.Year()*100 + int(end.Month())

	sqlQuery := `
		SELECT account_name, type_id, year, month, balance, balance_past
		FROM ` + enums.MonthlyAccountsFunction + `($1)
		WHERE account_id = $2
		  AND (year * 100 + month) >= $3
		  AND (year * 100 + month) <= $4
		ORDER BY year, month`

	rows, err := ar.db.Query(ctx, sqlQuery, userID, accountID, startYearMonth, endYearMonth)
	if err != nil {
		return analysis, mappers.MapPostgresErrorCode(err)
	}

	var (
		accountName    string
		balanceMetrics []domain.MonthlyMetrics
		yearList       []uint16
		monthList      []uint16
	)

	for rows.Next() {
		var (
			typeID               uint64
			year, month          uint16
			balance, balancePast float64
		)

		err = rows.Scan(
			&accountName,
			&typeID,
			&year,
			&month,
			&balance,
			&balancePast,
		)
		if err != nil {
			return analysis, mappers.MapPostgresErrorCode(err)
		}

		metric := domain.MonthlyMetrics{}

		if utils.ContainsInt(typeID, enums.SavingAndInvestmentTypes) {
			metric = domain.SavingsBalanceMetrics(balance, balancePast)
		} else if utils.ContainsInt(typeID, enums.CreditTypes) {
			metric = domain.CreditsBalanceMetrics(balance, balancePast)
		} else {
			metric = domain.SavingsBalanceMetrics(balance, balancePast)
		}

		// Create monthly metrics for each type
		balanceMetrics = append(balanceMetrics, metric)
		yearList = append(yearList, year)
		monthList = append(monthList, month)
	}

	analysis.AccountID = accountID
	analysis.AccountName = accountName
	analysis.Balance = balanceMetrics
	analysis.Year = yearList
	analysis.Month = monthList

	return analysis, nil
}

func (ar *AnalysisRepository) GetFinancialAccountSummary(
	ctx context.Context,
	userID string,
	start time.Time,
	end time.Time,
	accountTypes domain.AccountTypes,
	accounts []int64,
) (domain.FinancialSummary, error) {
	var (
		summary         = make(domain.FinancialSummary)
		lastMonth       = end.AddDate(0, -1, 0)
		income, expense string
	)

	// Date calculations in user's timezone
	userDate := "(t.date at time zone coalesce(u.utc_offset, 'utc'))::date"

	if accountTypes.IsSaving() {
		// Income: from categories marked as income
		income = fmt.Sprintf("sum(case when c.income is true then %s else 0 end)", flowAmountCalc)

		// Expenses: from categories marked as NOT income
		expense = fmt.Sprintf("sum(case when c.income is false then %s else 0 end)", flowAmountCalc)

	} else {
		// Amount calculation: positive for income, negative for expenses (transfers excluded)
		income = "sum(case when t.expense is false and t.transfer_group_id is null then t.amount_base else 0 end)"
		if accountTypes.IsCredit() {
			// Everything that comes in is a payment, and payments are transfers from another account
			income = "sum(case when t.expense is false then t.amount_base else 0 end)"
		}
		expense = "sum(case when t.expense is true and t.transfer_group_id is null then -t.amount_base else 0 end)"
	}

	query := ar.db.QueryBuilder.Select(
		"extract(year from "+userDate+") as year",
		"extract(month from "+userDate+") as month",
		"extract(month from ?::date) as last_month",
		income+" as income",
		expense+" as expense",
	).
		From(enums.TransactionsTableName + " AS t").
		LeftJoin(enums.AccountTableName + " ac ON ac.id = t.account_id").
		LeftJoin(enums.CategoryTableName + " c ON c.id = t.category_id").
		LeftJoin(enums.UserExtraTableName + " u ON u.user_id = t.user_id").
		Where(sq.Eq{"t.user_id": userID}).
		Where(sq.Expr(userDate+" >= ?::date", start)).
		Where(sq.Expr(userDate+" < ?::date", end)).
		Where(sq.Eq{"ac.type_id": accountTypes}).
		Where(sq.Eq{"t.account_id": accounts}).
		GroupBy("year, month").
		OrderBy("year DESC, month DESC")

	sqlQuery, args, err := query.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	// Combine all arguments in the correct order
	finalArgs := utils.PrepareQueryArgs(
		lastMonth, // For last_month calculation
		args,
	)

	rows, err := ar.db.Query(ctx, sqlQuery, finalArgs...)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return summary, nil
		}
		return nil, err
	}

	// Process results
	index := domain.Index(0)
	for rows.Next() {
		var report domain.MonthlyReport

		err = rows.Scan(
			nil, // year (not used)
			&report.Month,
			&report.CurrentMonth,
			&report.Income.Value,
			&report.Expenses.Value,
		)

		if err != nil {
			return nil, err
		}

		summary[index] = report
		index++
	}

	return summary, nil
}

// categoryBudgetsByMonth is the budget of the user's category in each month from start to end ("2026-11" -> budget);
// empty when the category is not the user's
func (ar *AnalysisRepository) categoryBudgetsByMonth(ctx context.Context, userID string, categoryID uint64, start, end time.Time) (map[string]float64, error) {
	rows, err := ar.db.Query(ctx, `
		SELECT to_char(g.m, 'YYYY-MM'), coalesce(budget_at(c.id, g.m::date), 0)
		FROM categories c
		CROSS JOIN generate_series(date_trunc('month', $3::date), date_trunc('month', $4::date), interval '1 month') AS g(m)
		WHERE c.id = $1 AND c.user_id = $2`,
		categoryID, userID, start.Format(time.DateOnly), end.Format(time.DateOnly))
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	out := make(map[string]float64)
	for rows.Next() {
		var key string
		var amount float64
		if err = rows.Scan(&key, &amount); err != nil {
			return nil, err
		}
		out[key] = amount
	}
	return out, rows.Err()
}
