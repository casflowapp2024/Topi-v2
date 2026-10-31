//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCreditCards: términos de la tarjeta, categorías de cargos y el estado del corte. Corte el 1 y
// pago el 20: el último corte es el 1 de este mes. Compras el mes pasado (una a 6 cuotas), un pago
// y una compra hoy.
func TestCreditCards(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-cc-card-" + uuid.NewString()
	d := decimal.RequireFromString

	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})
	var today time.Time
	require.NoError(t, db.QueryRow(ctx, "SELECT (now() AT TIME ZONE 'America/Bogota')::date").Scan(&today))
	if today.Day() == 1 {
		t.Skip("el día del corte: las compras de hoy no quedarían después del corte")
	}
	firstOfMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	lastMonth := firstOfMonth.AddDate(0, -1, 0)

	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	cat := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Compras IT', 0, '') RETURNING id", userID)
	_, err = db.Exec(ctx, "INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'intereses', 0, '')", userID)
	require.NoError(t, err)
	account := func(name, digits string, typeID int) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, 'COP', $6) RETURNING id`, userID, name, digits, bank, typeID, lastMonth.AddDate(0, 0, -5))
	}
	card := account("Visa IT", "0004", 4)
	savings := account("Ahorros IT", "0001", 1)

	transactions := repository.NewTransactionRepository(db)
	at := func(day time.Time, hour int) time.Time {
		return time.Date(day.Year(), day.Month(), day.Day(), hour, 0, 0, 0, time.FixedZone("COT", -5*3600))
	}
	create := func(accountID uint64, expense bool, amount float64, when time.Time, installments *int16) *domain.Transaction {
		t.Helper()
		tx := &domain.Transaction{UserID: userID, Category: domain.Category{ID: cat}, Account: domain.Account{ID: accountID},
			Description: "IT", Expense: expense, Amount: amount, Date: when, Installments: installments}
		created, err := transactions.CreateTransaction(ctx, tx)
		require.NoError(t, err)
		return created
	}
	six, one := int16(6), int16(1)
	create(card, true, 300000, at(lastMonth.AddDate(0, 0, 9), 10), nil)
	deferred := create(card, true, 100000, at(lastMonth.AddDate(0, 0, 19), 10), &six)
	require.NotNil(t, deferred.Installments)
	assert.Equal(t, int16(6), *deferred.Installments)
	single := create(card, true, 50000, at(today, 9), &one)
	assert.Nil(t, single.Installments, "1 cuota = sin cuotas")
	create(card, false, 150000, at(today, 10), nil) // pago
	create(savings, true, 1000, at(today, 11), nil)

	// editar las cuotas: omitirlas las conserva, 0 las quita
	deferred.Installments = nil
	require.NoError(t, transactions.UpdateTransaction(ctx, deferred))
	require.NotNil(t, deferred.Installments)
	zero := int16(0)
	cleared := *single
	cleared.Installments = &zero
	require.NoError(t, transactions.UpdateTransaction(ctx, &cleared))
	assert.Nil(t, cleared.Installments)

	repo := repository.NewCreditCardRepository(db)
	limit, statement, due := d("1000000"), int16(1), int16(20)
	terms := &domain.CreditCardDetails{AccountID: card, UserID: userID, CreditLimit: &limit, StatementDay: &statement, DueDay: &due}
	require.NoError(t, repo.SaveCreditCard(ctx, terms))
	require.NoError(t, repo.SaveCreditCard(ctx, terms), "guardar otra vez no duplica categorías")
	var categories []string
	rows, err := db.Query(ctx, "SELECT name FROM categories WHERE user_id = $1 ORDER BY name", userID)
	require.NoError(t, err)
	for rows.Next() {
		var name string
		require.NoError(t, rows.Scan(&name))
		categories = append(categories, name)
	}
	rows.Close()
	assert.Equal(t, []string{"Cargos de Tarjeta", "Comisiones", "Compras IT", "intereses"}, categories, "no crea Intereses si ya hay una")

	got, err := repo.GetCreditCard(ctx, userID, card)
	require.NoError(t, err)
	require.NotNil(t, got.CreditLimit)
	assert.True(t, got.CreditLimit.Equal(limit))
	assert.Equal(t, int16(20), *got.DueDay)
	_, err = repo.GetCreditCard(ctx, userID, savings)
	assert.ErrorIs(t, err, domain.ErrNotCreditAccount)
	assert.ErrorIs(t, repo.SaveCreditCard(ctx, &domain.CreditCardDetails{AccountID: savings, UserID: userID}), domain.ErrNotCreditAccount)

	status, err := repo.ListCreditCardStatus(ctx, userID)
	require.NoError(t, err)
	require.Len(t, status, 1)
	s := status[0]
	assert.Equal(t, card, s.AccountID)
	// el corte ya tiene un pago: quedan los consumos de este corte y las 5 cuotas que faltan
	assert.True(t, s.Debt.Equal(d("133333.3333")), s.Debt.String())
	require.NotNil(t, s.Available)
	assert.True(t, s.Available.Equal(d("866666.6667")), s.Available.String())
	require.NotNil(t, s.LastStatement)
	assert.Equal(t, firstOfMonth.Format(time.DateOnly), s.LastStatement.Format(time.DateOnly))
	assert.Equal(t, firstOfMonth.AddDate(0, 1, 0).Format(time.DateOnly), s.NextStatement.Format(time.DateOnly))
	assert.Equal(t, firstOfMonth.AddDate(0, 0, 19).Format(time.DateOnly), s.DueDate.Format(time.DateOnly))
	assert.True(t, s.StatementDebt.Equal(d("316666.6667")), s.StatementDebt.String()) // contado + primera cuota
	assert.True(t, s.PaidSinceStatement.Equal(d("150000")), s.PaidSinceStatement.String())
	assert.True(t, s.PendingStatement.IsZero(), s.PendingStatement.String())
	assert.True(t, s.PurchasesSince.Equal(d("66666.6667")), s.PurchasesSince.String()) // contado + segunda cuota
	assert.Equal(t, 1, s.InstallmentPurchases)
}

// TestCardCharges: lo pagado por encima de lo debido por corte es un cargo, en el mes del pago, y entra
// a gastos y a su categoría. Un pago que luego resulta adelantado lo corrige un corte cerrado, y el
// corte en curso no descuenta nada todavía.
func TestCardCharges(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-chg-" + uuid.NewString()
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM credit_card_details WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})
	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	buys := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Compras IT', 0, '') RETURNING id", userID)
	category := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Cargos de Tarjeta', 100000, '') RETURNING id", userID)
	account := func(name, digits string, typeID int) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, 'COP', '2026-08-01 12:00:00-05') RETURNING id`, userID, name, digits, bank, typeID)
	}
	card := account("Tarjeta IT", "0001", 4)
	_, err = db.Exec(ctx, "INSERT INTO credit_card_details (account_id, user_id, statement_day, due_day) VALUES ($1, $2, 15, 5)", card, userID)
	require.NoError(t, err)
	tx := func(accountID uint64, expense bool, amount, at string) {
		t.Helper()
		id(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6) RETURNING id`, userID, buys, accountID, expense, amount, at)
	}
	charges := func(today string) map[string]string {
		t.Helper()
		rows, err := db.Query(ctx, "SELECT charged_on::text, amount::text FROM card_charges($1, $2::date)", userID, today)
		require.NoError(t, err)
		defer rows.Close()
		out := map[string]string{}
		for rows.Next() {
			var day, amount string
			require.NoError(t, rows.Scan(&day, &amount))
			out[day] = strings.TrimSuffix(amount, ".0000")
		}
		return out
	}

	tx(card, true, "1000000", "2026-09-20 10:00:00-05")  // corte del 15-oct
	tx(card, false, "1030000", "2026-10-25 10:00:00-05") // pago con intereses
	assert.Equal(t, map[string]string{"2026-10-25": "30000"}, charges("2026-10-31"))

	// compra después del corte: no se confunde con el pago anterior
	tx(card, true, "200000", "2026-10-20 10:00:00-05") // corte del 15-nov
	assert.Equal(t, map[string]string{"2026-10-25": "30000"}, charges("2026-11-20"), "corte en curso sin pago: no descuenta")

	// pago parcial en un corte cerrado: faltan 100.000; el cargo era pago adelantado y lo demás se arrastra
	tx(card, false, "100000", "2026-11-20 10:00:00-05")
	assert.Empty(t, charges("2026-12-16"))

	// el arrastre (70.000) + 300.000 del corte contra 400.000 pagados: 30.000 de cargo
	tx(card, true, "300000", "2026-11-25 10:00:00-05")
	tx(card, false, "400000", "2026-12-20 10:00:00-05")
	assert.Equal(t, map[string]string{"2026-12-20": "30000"}, charges("2026-12-31"))

	// una compra que llega tarde corrige el cargo sola
	tx(card, true, "10000", "2026-11-26 10:00:00-05")
	assert.Equal(t, map[string]string{"2026-12-20": "20000"}, charges("2026-12-31"))
	_, err = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1 AND date >= '2026-10-20 00:00:00-05' AND date <> '2026-10-25 10:00:00-05'", userID)
	require.NoError(t, err)

	// en los reportes: gasto del mes del pago y de su categoría, sin ser una transacción
	analysis := repository.NewAnalysisRepository(db)
	october := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	report, err := analysis.GetCategoriesReport(ctx, userID, october)
	require.NoError(t, err)
	for _, m := range report.Expenses.Report {
		if m.CategoryID == category {
			assert.InDelta(t, -30000, m.Value, 0.001)
		}
	}
	summary, err := analysis.GetFinancialSummary(ctx, userID, time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	require.Len(t, summary, 1)
	assert.InDelta(t, 1030000-30000, summary[0].Expenses.Value, 0.001, "el pago sin ligar suma; el cargo resta")

	fr := &domain.FinancialResolver{UserID: userID, Start: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC), End: october,
		Rsp: &domain.FinancialAnalysis{}, Mu: &sync.Mutex{}, Wg: &sync.WaitGroup{}}
	fr.Wg.Add(2)
	analysis.GetDailyAnalysis(ctx, fr)
	analysis.GetMonthlyAnalysis(ctx, fr)
	require.NoError(t, fr.DailyErr)
	require.NoError(t, fr.MonthlyErr)
	last := len(fr.Rsp.Daily.MTDExpense) - 1
	require.GreaterOrEqual(t, last, 0)
	assert.InDelta(t, 1030000-30000, fr.Rsp.Daily.MTDExpense[last], 0.001)
	assert.InDelta(t, 1030000-30000, fr.Rsp.Daily.MTDBudget[last], 0.001)
	listed, err := analysis.GetCardCharges(ctx, userID, october, october)
	require.NoError(t, err)
	require.Len(t, listed, 1)
	assert.Equal(t, "Tarjeta IT", listed[0].AccountName)

	history, err := analysis.GetCategoryAnalysis(ctx, userID, category, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	require.Len(t, history.Monthly, 1)
	assert.InDelta(t, -30000, history.Monthly[0].Value, 0.001)
}

// TestCardChargesWithInstallments: el banco cobra la cuota. Pagarla exacta no deja cargo, pagar de más
// deja justo los intereses, y la deuda sigue siendo la compra completa hasta pagarla toda.
func TestCardChargesWithInstallments(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-chgq-" + uuid.NewString()
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM credit_card_details WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})
	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	category := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Compras IT', 0, '') RETURNING id", userID)
	card := id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
		VALUES ($1, 'Tarjeta IT', '0001', $2, 4, 0, 'COP', '2026-08-01 12:00:00-05') RETURNING id`, userID, bank)
	_, err = db.Exec(ctx, "INSERT INTO credit_card_details (account_id, user_id, statement_day, due_day) VALUES ($1, $2, 15, 5)", card, userID)
	require.NoError(t, err)
	tx := func(expense bool, amount, at string, installments any) uint64 {
		t.Helper()
		return id(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, installments)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6, $7) RETURNING id`, userID, category, card, expense, amount, at, installments)
	}
	charges := func(today string) map[string]string {
		t.Helper()
		rows, err := db.Query(ctx, "SELECT charged_on::text, amount::text FROM card_charges($1, $2::date)", userID, today)
		require.NoError(t, err)
		defer rows.Close()
		out := map[string]string{}
		for rows.Next() {
			var day, amount string
			require.NoError(t, rows.Scan(&day, &amount))
			out[day] = strings.TrimSuffix(amount, ".0000")
		}
		return out
	}
	billed := func(from, to string) decimal.Decimal {
		t.Helper()
		var out string
		require.NoError(t, db.QueryRow(ctx, "SELECT card_billed($1, $2, $3::date, $4::date)::text", userID, card, from, to).Scan(&out))
		return decimal.RequireFromString(out)
	}

	// 600.000 a 3 cuotas + 50.000 de contado, ambas en el corte del 15-oct
	purchase := tx(true, "600000", "2026-09-20 10:00:00-05", 3)
	tx(true, "50000", "2026-09-25 10:00:00-05", nil)
	assert.True(t, billed("2026-09-15", "2026-10-15").Equal(decimal.NewFromInt(250000)))
	assert.True(t, billed("2026-10-15", "2026-11-15").Equal(decimal.NewFromInt(200000)))
	assert.True(t, billed("2026-11-15", "2026-12-15").Equal(decimal.NewFromInt(200000)))
	assert.True(t, billed("2026-12-15", "2027-01-15").IsZero(), "no quedan cuotas")

	// pago exacto del corte: sin cargo, aunque la compra completa sea mayor
	tx(false, "250000", "2026-10-25 10:00:00-05", nil)
	assert.Empty(t, charges("2026-10-31"))

	// la segunda cuota con intereses: el cargo son los intereses
	tx(false, "218000", "2026-11-25 10:00:00-05", nil)
	assert.Equal(t, map[string]string{"2026-11-25": "18000"}, charges("2026-11-30"))

	// sin las cuotas, el mismo pago no dejaría cargo: quitarlas lo recalcula
	_, err = db.Exec(ctx, "UPDATE transactions SET installments = NULL WHERE id = $1", purchase)
	require.NoError(t, err)
	assert.Empty(t, charges("2026-11-30"))
}
