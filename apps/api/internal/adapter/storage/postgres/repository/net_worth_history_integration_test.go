//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNetWorthHistory: el patrimonio al cierre de cada mes se calcula como el de hoy, pero a esa fecha.
// Cuentas creadas el 1-sep-2026: ahorros (sueldo de 5 M), un fondo (aporte de 1 M el 5-sep que vale
// 1,05 M el 30-sep; aporte de 0,5 M el 5-oct, vale 1,6 M el 20-oct) y una tarjeta con corte el 15
// (compra de 200 mil el 10-sep, de 100 mil el 5-oct y un pago de 100 mil el 20-oct).
func TestNetWorthHistory(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-nwh-" + uuid.NewString()
	d := decimal.RequireFromString
	day := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }

	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM account_valuations WHERE user_id = $1", userID)
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
	cat := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Varios IT', 0, '') RETURNING id", userID)
	salary := id("INSERT INTO categories (user_id, name, budget, emoji, income) VALUES ($1, 'Sueldo IT', 0, '', true) RETURNING id", userID)
	account := func(name, digits string, typeID int) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, 'COP', '2026-09-01 12:00:00-05') RETURNING id`,
			userID, name, digits, bank, typeID)
	}
	savings := account("Ahorros IT", "0001", 1)
	broker := account("Fondo IT", "0002", 3)
	card := account("Visa IT", "0004", 4)
	_, err = db.Exec(ctx, "INSERT INTO credit_card_details (account_id, user_id, statement_day, due_day) VALUES ($1, $2, 15, 5)", card, userID)
	require.NoError(t, err)
	tx := func(accountID, categoryID uint64, expense bool, amount, at string) {
		t.Helper()
		_, err := db.Exec(ctx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6)`, userID, categoryID, accountID, expense, amount, at)
		require.NoError(t, err)
	}
	tx(savings, salary, false, "5000000", "2026-09-02 08:00:00-05")
	tx(savings, cat, true, "1000000", "2026-09-05 09:00:00-05")
	tx(broker, cat, false, "1000000", "2026-09-05 09:00:00-05")
	tx(card, cat, true, "200000", "2026-09-10 10:00:00-05")
	tx(savings, cat, true, "500000", "2026-10-05 09:00:00-05")
	tx(broker, cat, false, "500000", "2026-10-05 09:00:00-05")
	tx(card, cat, true, "100000", "2026-10-05 10:00:00-05")
	tx(savings, cat, true, "100000", "2026-10-20 09:00:00-05")
	tx(card, cat, false, "100000", "2026-10-20 09:00:00-05")

	valuations := repository.NewValuationRepository(db)
	for date, value := range map[string]string{"2026-09-30": "1050000", "2026-10-20": "1600000"} {
		require.NoError(t, valuations.UpsertValuation(ctx,
			&domain.AccountValuation{UserID: userID, AccountID: broker, Date: day(date), Value: d(value), Source: "manual"}))
	}

	fx := repository.NewFxRepository(db)
	history, err := fx.GetNetWorthHistory(ctx, userID, 36)
	require.NoError(t, err)
	assert.Equal(t, "COP", history.BaseCurrency)
	require.NotEmpty(t, history.Points)
	byDay := map[string]domain.NetWorthPoint{}
	for i, p := range history.Points {
		byDay[p.Date.Format(time.DateOnly)] = p
		if i > 0 {
			assert.True(t, p.Date.After(history.Points[i-1].Date), "de la más vieja a la más nueva")
		}
	}
	_, before := byDay["2026-08-31"]
	assert.False(t, before, "sin cuentas en agosto no hay punto")

	check := func(date, total, cash, investments, credit, cost string) {
		t.Helper()
		p, ok := byDay[date]
		require.True(t, ok, date)
		assert.True(t, p.Total.Equal(d(total)), "%s total %s", date, p.Total)
		assert.True(t, p.CashTotal.Equal(d(cash)), "%s efectivo %s", date, p.CashTotal)
		assert.True(t, p.InvestmentsTotal.Equal(d(investments)), "%s inversiones %s", date, p.InvestmentsTotal)
		assert.True(t, p.CreditTotal.Equal(d(credit)), "%s tarjetas %s", date, p.CreditTotal)
		require.NotNil(t, p.InvestmentsCost, date)
		assert.True(t, p.InvestmentsCost.Equal(d(cost)), "%s aportado %s", date, p.InvestmentsCost)
		assert.False(t, p.MissingRates)
	}
	// 30-sep: el corte del 15 cobra los 200 mil; la compra del 5-oct todavía no existe
	check("2026-09-30", "4850000", "4000000", "1050000", "-200000", "1000000")
	// 31-oct: lo pagado el 20 cubre el corte del 15-oct (100 mil)
	check("2026-10-31", "5000000", "3400000", "1600000", "0", "1500000")

	// el último punto es hoy y coincide con el patrimonio de hoy
	now, err := fx.GetNetWorth(ctx, userID)
	require.NoError(t, err)
	last := history.Points[len(history.Points)-1]
	assert.Equal(t, now.Date.Format(time.DateOnly), last.Date.Format(time.DateOnly))
	assert.True(t, last.Total.Equal(now.Total), "%s vs %s", last.Total, now.Total)
	assert.True(t, last.CreditTotal.Equal(now.CreditTotal), "%s vs %s", last.CreditTotal, now.CreditTotal)
	assert.True(t, last.InvestmentsTotal.Equal(now.InvestmentsTotal))

	// el estado de la tarjeta a una fecha pasada no ve lo comprado después
	var debt string
	require.NoError(t, db.QueryRow(ctx, "SELECT debt::text FROM credit_card_status($1, '2026-09-30') WHERE account_id = $2",
		userID, card).Scan(&debt))
	assert.True(t, d(debt).Equal(d("200000")), debt)

	// meses pedidos: el mes actual cuenta como uno
	recent, err := fx.GetNetWorthHistory(ctx, userID, 1)
	require.NoError(t, err)
	require.Len(t, recent.Points, 1)
	assert.Equal(t, last.Date, recent.Points[0].Date)
}
