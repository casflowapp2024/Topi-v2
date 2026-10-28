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

// TestTransfersOutOfFlows: las patas ligadas salen de ingresos y gastos, los saldos y el reporte
// por categoría no cambian, y ligar / crear contraparte / desligar / borrar una pata / descartar
// candidatas mantienen daily_account_totals cuadrado. Datos en septiembre de 2026 con una tasa
// 'manual' COP de 4000 (se salta si la base ya tiene una ese día).
func TestTransfersOutOfFlows(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-tr-" + uuid.NewString()
	d := decimal.RequireFromString
	day := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)

	var insertedRate bool
	require.NoError(t, db.QueryRow(ctx, `WITH ins AS (
		INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('COP', $1, 4000, 'manual')
		ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) > 0 FROM ins`, day).Scan(&insertedRate))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		if insertedRate {
			_, _ = db.Exec(ctx, "DELETE FROM fx_rates WHERE quote = 'COP' AND rate_date = $1 AND source = 'manual'", day)
		}
	})
	if !insertedRate {
		t.Skip("ya hay una tasa manual COP para el 2026-09-15 en esta base")
	}

	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	invest := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Inversión IT', 1000000, '') RETURNING id", userID)
	salary := id("INSERT INTO categories (user_id, name, budget, emoji, income) VALUES ($1, 'Sueldo IT', 0, '', true) RETURNING id", userID)
	account := func(name, digits, currency string, typeID int) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, $6, '2026-09-01 12:00:00-05') RETURNING id`,
			userID, name, digits, bank, typeID, currency)
	}
	savings := account("Ahorros IT", "0001", "COP", 1)
	pocket := account("Bolsillo IT", "0002", "COP", 1)
	broker := account("Inversión IT", "0003", "COP", 3)
	card := account("Tarjeta IT", "0004", "COP", 4)
	dollars := account("Dólares IT", "0005", "USD", 1)

	tx := func(accountID, categoryID uint64, expense bool, amount, at string) uint64 {
		return id(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6) RETURNING id`, userID, categoryID, accountID, expense, amount, at)
	}
	tx(savings, salary, false, "5000000", "2026-09-15 08:00:00-05")
	toBrokerOut := tx(savings, invest, true, "1000000", "2026-09-15 09:00:00-05")
	toBrokerIn := tx(broker, invest, false, "1000000", "2026-09-15 09:01:00-05")
	toPocketOut := tx(savings, invest, true, "200000", "2026-09-15 10:00:00-05")
	toPocketIn := tx(pocket, invest, false, "200000", "2026-09-16 10:00:00-05")
	cardPayment := tx(savings, invest, true, "300000", "2026-09-15 11:00:00-05")
	toDollarsOut := tx(savings, invest, true, "400000", "2026-09-15 12:00:00-05")
	toDollarsIn := tx(dollars, invest, false, "100", "2026-09-15 12:05:00-05")

	transactions := repository.NewTransactionRepository(db)
	analysis := repository.NewAnalysisRepository(db)

	flows := func() (income, expense decimal.Decimal) {
		t.Helper()
		var inc, exp string
		require.NoError(t, db.QueryRow(ctx, `SELECT COALESCE(sum(income), 0)::text, COALESCE(sum(expense), 0)::text
			FROM analysis_daily($1) WHERE date BETWEEN '2026-09-15' AND '2026-09-16'`, userID).Scan(&inc, &exp))
		return d(inc), d(exp)
	}
	balances := func() map[uint64]float64 {
		t.Helper()
		list, err := analysis.GetBalanceByAccount(ctx, userID, nil)
		require.NoError(t, err)
		out := map[uint64]float64{}
		for _, b := range list {
			out[b.AccountID] = b.Balance
		}
		return out
	}
	investReport := func() float64 {
		t.Helper()
		report, err := analysis.GetCategoriesReport(ctx, userID, day)
		require.NoError(t, err)
		for _, m := range report.Expenses.Report {
			if m.CategoryID == invest {
				return m.Value
			}
		}
		t.Fatalf("sin la categoría de inversión en el reporte")
		return 0
	}
	noDrift := func() {
		t.Helper()
		var n int
		require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM daily_account_totals_drift() WHERE user_id = $1", userID).Scan(&n))
		assert.Zero(t, n, "daily_account_totals descuadrado")
	}

	// sin ligar: todo cuenta como flujo (en gastos solo las cuentas de ahorro y tarjeta)
	income, expense := flows()
	assert.True(t, income.Equal(d("5000000")), income.String())
	assert.True(t, expense.Equal(d("-1300000")), expense.String()) // -1.9 M de salidas + 0.6 M de entradas en ahorros
	balancesBefore := balances()
	categoryBefore := investReport()

	// candidatas
	candidates, err := transactions.ListTransferCandidates(ctx, userID, 50)
	require.NoError(t, err)
	byPair := map[[2]uint64]string{}
	for _, c := range candidates {
		byPair[[2]uint64{c.OutTransactionID, c.InTransactionID}] = c.Confidence
	}
	assert.Equal(t, "high", byPair[[2]uint64{toBrokerOut, toBrokerIn}])
	assert.Equal(t, "high", byPair[[2]uint64{toPocketOut, toPocketIn}])
	assert.Equal(t, "low", byPair[[2]uint64{toDollarsOut, toDollarsIn}])

	// ligar existentes
	for _, pair := range [][2]uint64{{toBrokerOut, toBrokerIn}, {toPocketOut, toPocketIn}, {toDollarsOut, toDollarsIn}} {
		link := &domain.TransferLink{UserID: userID, TransactionID: pair[0], CounterpartTransactionID: pair[1]}
		require.NoError(t, transactions.LinkTransactions(ctx, link))
		assert.NotEmpty(t, link.GroupID)
		require.NotNil(t, link.Counterpart.TransferGroupID)
		assert.Equal(t, link.GroupID, *link.Counterpart.TransferGroupID)
	}
	// crear la pata que falta del pago de la tarjeta
	cardLink := &domain.TransferLink{UserID: userID, TransactionID: cardPayment, CounterpartAccountID: card}
	require.NoError(t, transactions.CreateTransferCounterpart(ctx, cardLink))
	assert.Equal(t, card, cardLink.Counterpart.Account.ID)
	assert.False(t, cardLink.Counterpart.Expense)
	assert.Equal(t, invest, cardLink.Counterpart.Category.ID)
	require.NotNil(t, cardLink.Counterpart.AmountBase)
	assert.True(t, cardLink.Counterpart.AmountBase.Equal(d("300000")))

	// ligadas: solo queda el sueldo; saldos iguales (más el pago que ahora sí llegó a la tarjeta)
	income, expense = flows()
	assert.True(t, income.Equal(d("5000000")), income.String())
	assert.True(t, expense.IsZero(), expense.String())
	balancesAfter := balances()
	for account, balance := range balancesBefore {
		if account == card {
			assert.InDelta(t, balance+300000, balancesAfter[account], 0.001)
			continue
		}
		assert.InDelta(t, balance, balancesAfter[account], 0.001, "cuenta %d", account)
	}
	// el presupuesto de inversión sigue viendo el capital que salió: -1 M (las demás se compensan;
	// antes faltaba la entrada en la tarjeta)
	assert.InDelta(t, categoryBefore+300000, investReport(), 0.001)
	assert.InDelta(t, -1000000, investReport(), 0.001)

	summary, err := analysis.GetFinancialSummary(ctx, userID, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	require.Len(t, summary, 1)
	assert.InDelta(t, 5000000, summary[0].Income.Value, 0.001)
	assert.InDelta(t, 0, summary[0].Expenses.Value, 0.001)
	noDrift()

	assert.Empty(t, mustCandidates(t, transactions, userID), "las ligadas ya no son candidatas")

	// errores
	err = transactions.LinkTransactions(ctx, &domain.TransferLink{UserID: userID, TransactionID: toBrokerOut, CounterpartTransactionID: toPocketIn})
	assert.ErrorIs(t, err, domain.ErrTransferLinked)
	err = transactions.LinkTransactions(ctx, &domain.TransferLink{UserID: "otro", TransactionID: toBrokerOut, CounterpartTransactionID: toBrokerIn})
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	err = transactions.CreateTransferCounterpart(ctx, &domain.TransferLink{UserID: userID, TransactionID: cardPayment, CounterpartAccountID: pocket})
	assert.ErrorIs(t, err, domain.ErrTransferLinked)

	// desligar: el capital a la inversión vuelve a ser gasto
	require.NoError(t, transactions.UnlinkTransfer(ctx, userID, *cardLink.Transaction.TransferGroupID))
	require.NoError(t, transactions.LinkTransactions(ctx, &domain.TransferLink{UserID: userID, TransactionID: cardPayment, CounterpartTransactionID: cardLink.Counterpart.ID}))
	var brokerGroup string
	require.NoError(t, db.QueryRow(ctx, "SELECT transfer_group_id::text FROM transactions WHERE id = $1", toBrokerOut).Scan(&brokerGroup))
	require.NoError(t, transactions.UnlinkTransfer(ctx, userID, brokerGroup))
	_, expense = flows()
	assert.True(t, expense.Equal(d("-1000000")), expense.String())
	assert.ErrorIs(t, transactions.UnlinkTransfer(ctx, userID, brokerGroup), domain.ErrDataNotFound)
	noDrift()

	// borrar una pata suelta la otra
	_, err = db.Exec(ctx, "DELETE FROM transactions WHERE id = $1", toPocketIn)
	require.NoError(t, err)
	var orphan *string
	require.NoError(t, db.QueryRow(ctx, "SELECT transfer_group_id::text FROM transactions WHERE id = $1", toPocketOut).Scan(&orphan))
	assert.Nil(t, orphan)
	noDrift()

	// descartar una candidata
	found := false
	for _, c := range mustCandidates(t, transactions, userID) {
		found = found || (c.OutTransactionID == toBrokerOut && c.InTransactionID == toBrokerIn)
	}
	require.True(t, found, "la pareja desligada vuelve a ser candidata")
	require.NoError(t, transactions.DismissTransferCandidate(ctx, userID, toBrokerOut, toBrokerIn))
	require.NoError(t, transactions.DismissTransferCandidate(ctx, userID, toBrokerOut, toBrokerIn)) // idempotente
	for _, c := range mustCandidates(t, transactions, userID) {
		assert.False(t, c.OutTransactionID == toBrokerOut && c.InTransactionID == toBrokerIn)
	}
	assert.ErrorIs(t, transactions.DismissTransferCandidate(ctx, "otro", toBrokerOut, toBrokerIn), domain.ErrDataNotFound)

	// contraparte en otra moneda a la tasa del día: 80.000 COP / 4000 = 20 USD, mismo amount_base
	toUSD := tx(savings, invest, true, "80000", "2026-09-15 13:00:00-05")
	usdLink := &domain.TransferLink{UserID: userID, TransactionID: toUSD, CounterpartAccountID: dollars}
	require.NoError(t, transactions.CreateTransferCounterpart(ctx, usdLink))
	assert.Equal(t, "USD", usdLink.Counterpart.Currency)
	assert.InDelta(t, 20, usdLink.Counterpart.Amount, 0.0001)
	require.NotNil(t, usdLink.Counterpart.AmountBase)
	assert.True(t, usdLink.Counterpart.AmountBase.Equal(d("80000")))
	noDrift()
}

func mustCandidates(t *testing.T, r *repository.TransactionRepository, userID string) []domain.TransferCandidate {
	t.Helper()
	out, err := r.ListTransferCandidates(context.Background(), userID, 100)
	require.NoError(t, err)
	return out
}
