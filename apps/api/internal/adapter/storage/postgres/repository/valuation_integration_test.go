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

// TestInvestmentValuations: el saldo de una inversión sigue su última valoración más los
// movimientos posteriores en todos los reportes de saldos, sin tocar ingresos ni gastos.
// Inversión en COP creada el 1-sep-2026: aporte de 1 M el 5-sep, vale 1,05 M el 30-sep, aporte de
// 0,5 M el 5-oct y vale 1,6 M el 20-oct.
func TestInvestmentValuations(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-val-" + uuid.NewString()
	d := decimal.RequireFromString
	day := func(s string) time.Time { v, _ := time.Parse(time.DateOnly, s); return v }

	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
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
	invest := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Inversión IT', 0, '') RETURNING id", userID)
	salary := id("INSERT INTO categories (user_id, name, budget, emoji, income) VALUES ($1, 'Sueldo IT', 0, '', true) RETURNING id", userID)
	account := func(name, digits string, typeID int) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, 'COP', '2026-09-01 12:00:00-05') RETURNING id`,
			userID, name, digits, bank, typeID)
	}
	savings := account("Ahorros IT", "0001", 1)
	broker := account("Fondo IT", "0002", 3)
	tx := func(accountID, categoryID uint64, expense bool, amount, at string) {
		_, err := db.Exec(ctx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6)`, userID, categoryID, accountID, expense, amount, at)
		require.NoError(t, err)
	}
	tx(savings, salary, false, "5000000", "2026-09-02 08:00:00-05")
	tx(savings, invest, true, "1000000", "2026-09-05 09:00:00-05")
	tx(broker, invest, false, "1000000", "2026-09-05 09:00:00-05")
	tx(savings, invest, true, "500000", "2026-10-05 09:00:00-05")
	tx(broker, invest, false, "500000", "2026-10-05 09:00:00-05")

	analysis := repository.NewAnalysisRepository(db)
	valuations := repository.NewValuationRepository(db)
	fx := repository.NewFxRepository(db)

	flows := func() (string, string) {
		t.Helper()
		var inc, exp string
		require.NoError(t, db.QueryRow(ctx, `SELECT sum(income)::text, sum(expense)::text FROM analysis_daily($1)
			WHERE date >= '2026-09-01'`, userID).Scan(&inc, &exp))
		return inc, exp
	}
	brokerBalance := func() float64 {
		t.Helper()
		list, err := analysis.GetBalanceByAccount(ctx, userID, nil)
		require.NoError(t, err)
		for _, b := range list {
			if b.AccountID == broker {
				return b.Balance
			}
		}
		t.Fatal("sin la inversión")
		return 0
	}
	incomeBefore, expenseBefore := flows()
	assert.InDelta(t, 1500000, brokerBalance(), 0.001, "sin valoraciones: saldo contable")

	save := func(date, value string) *domain.AccountValuation {
		t.Helper()
		v := &domain.AccountValuation{UserID: userID, AccountID: broker, Date: day(date), Value: d(value), Source: "manual"}
		require.NoError(t, valuations.UpsertValuation(ctx, v))
		return v
	}
	save("2026-09-30", "1040000")
	sept := save("2026-09-30", "1050000") // reemplaza la del mismo día
	oct := save("2026-10-20", "1600000")
	list, err := valuations.ListValuations(ctx, userID, broker)
	require.NoError(t, err)
	require.Len(t, list, 2)
	assert.Equal(t, oct.ID, list[0].ID)
	assert.Equal(t, sept.ID, list[1].ID)
	assert.True(t, list[1].Value.Equal(d("1050000")))

	// saldos anclados
	assert.InDelta(t, 1600000, brokerBalance(), 0.001)
	netWorth, err := fx.GetNetWorth(ctx, userID)
	require.NoError(t, err)
	for _, a := range netWorth.Accounts {
		switch a.AccountID {
		case broker:
			assert.True(t, a.Balance.Equal(d("1600000")), a.Balance.String())
			require.NotNil(t, a.MarketGain)
			assert.True(t, a.MarketGain.Equal(d("100000")), a.MarketGain.String())
		case savings:
			assert.Nil(t, a.MarketGain)
		}
	}
	var septBalance, octBalance string
	require.NoError(t, db.QueryRow(ctx, `SELECT
		max(balance) FILTER (WHERE month = 9)::text, max(balance) FILTER (WHERE month = 10)::text
		FROM analysis_monthly_accounts($1) WHERE account_id = $2 AND year = 2026`, userID, broker).Scan(&septBalance, &octBalance))
	assert.True(t, d(septBalance).Equal(d("1050000")), septBalance)
	assert.True(t, d(octBalance).Equal(d("1600000")), octBalance)
	var savingsAndInvestments string
	require.NoError(t, db.QueryRow(ctx, `SELECT running_savings_balance::text FROM analysis_daily($1)
		WHERE date = '2026-09-30'`, userID).Scan(&savingsAndInvestments))
	assert.True(t, d(savingsAndInvestments).Equal(d("5050000")), savingsAndInvestments) // 4 M ahorros + 1,05 M fondo

	summary, err := analysis.GetBalanceSummary(ctx, userID, day("2026-10-01"), day("2026-11-01"), []uint64{3}, nil)
	require.NoError(t, err)
	assert.InDelta(t, 1050000, summary.PastMonthBalance, 0.001)
	assert.InDelta(t, 550000, summary.Balance, 0.001) // aporte de 0,5 M + 0,05 M de valoración

	// las valoraciones no son flujos
	incomeAfter, expenseAfter := flows()
	assert.Equal(t, incomeBefore, incomeAfter)
	assert.Equal(t, expenseBefore, expenseAfter)

	// rendimiento de octubre
	perf, err := valuations.GetInvestmentPerformance(ctx, userID, day("2026-10-01"), day("2026-10-31"))
	require.NoError(t, err)
	require.Len(t, perf, 1)
	p := perf[0]
	assert.Equal(t, broker, p.AccountID)
	assert.True(t, p.ValueStart.Equal(d("1050000")), p.ValueStart.String())
	assert.True(t, p.ValueEnd.Equal(d("1600000")), p.ValueEnd.String())
	assert.True(t, p.Contributions.Equal(d("500000")), p.Contributions.String())
	assert.True(t, p.Gain.Equal(d("50000")), p.Gain.String())
	assert.True(t, p.ContributionsTotal.Equal(d("1500000")), p.ContributionsTotal.String())
	assert.True(t, p.MarketGainTotal.Equal(d("100000")), p.MarketGainTotal.String())
	require.NotNil(t, p.LastValuationDate)
	assert.Equal(t, "2026-10-20", p.LastValuationDate.Format(time.DateOnly))
	require.NotNil(t, p.GainPercent())
	assert.Equal(t, "3.23", p.GainPercent().String()) // 50.000 / (1.050.000 + 500.000)

	// errores
	notInvestment := &domain.AccountValuation{UserID: userID, AccountID: savings, Date: day("2026-10-01"), Value: d("1"), Source: "manual"}
	assert.ErrorIs(t, valuations.UpsertValuation(ctx, notInvestment), domain.ErrNotInvestmentAccount)
	tooOld := &domain.AccountValuation{UserID: userID, AccountID: broker, Date: day("2026-08-31"), Value: d("1"), Source: "manual"}
	assert.ErrorIs(t, valuations.UpsertValuation(ctx, tooOld), domain.ErrValuationBeforeAccount)
	foreign := &domain.AccountValuation{UserID: "otro", AccountID: broker, Date: day("2026-10-02"), Value: d("1"), Source: "manual"}
	assert.ErrorIs(t, valuations.UpsertValuation(ctx, foreign), domain.ErrNotInvestmentAccount)
	assert.ErrorIs(t, valuations.DeleteValuation(ctx, "otro", broker, oct.ID), domain.ErrDataNotFound)

	// borrar la de octubre: vuelve a la de septiembre + el aporte posterior
	require.NoError(t, valuations.DeleteValuation(ctx, userID, broker, oct.ID))
	assert.InDelta(t, 1550000, brokerBalance(), 0.001)
}
