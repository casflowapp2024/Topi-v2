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

// TestCardPayments: un pago de tarjeta por correo queda fuera de los flujos mientras espera su otra
// pata; se liga solo si hay exactamente un gasto que coincide, sin importar qué correo llegó primero;
// con dudas sigue esperando; y con la tarjeta por cortes la deuda, el patrimonio y los ciclos salen
// de las compras y los pagos, no del saldo acumulado.
func TestCardPayments(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-cp-" + uuid.NewString()
	d := decimal.RequireFromString

	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})
	var today time.Time
	require.NoError(t, db.QueryRow(ctx, "SELECT (now() AT TIME ZONE 'America/Bogota')::date").Scan(&today))
	if today.Day() <= 3 {
		t.Skip("cerca del corte: las fechas relativas de la prueba quedarían en otro periodo")
	}
	firstOfMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	lastMonth := firstOfMonth.AddDate(0, -1, 0)
	twoMonthsAgo := firstOfMonth.AddDate(0, -2, 0)

	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	cat := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Tarjetas IT', 0, '') RETURNING id", userID)
	account := func(name, digits string, typeID int, initial float64) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'COP', $7) RETURNING id`, userID, name, digits, bank, typeID, initial, twoMonthsAgo.AddDate(0, 0, -5))
	}
	// la tarjeta arranca con una deuda que nunca se aclara: el saldo acumulado no sirve de nada
	card := account("Visa IT", "0004", 4, -1000000)
	nomina := account("Nomina IT", "0001", 1, 0)
	ahorros := account("Ahorros IT", "0002", 1, 0)

	transactions := repository.NewTransactionRepository(db)
	at := func(day time.Time, hour int) time.Time {
		return time.Date(day.Year(), day.Month(), day.Day(), hour, 0, 0, 0, time.FixedZone("COT", -5*3600))
	}
	email := func(accountID uint64, expense bool, amount float64, when time.Time, pending bool) domain.Transaction {
		t.Helper()
		msg := uuid.NewString()
		created, err := transactions.AdminCreateTransactions(ctx, []domain.Transaction{{
			UserID: userID, Category: domain.Category{ID: cat}, Account: domain.Account{ID: accountID},
			Description: "IT", Expense: expense, Amount: amount, Date: when, Automated: true,
			SourceMessageID: &msg, NeedsCounterpart: pending,
		}})
		require.NoError(t, err)
		require.Len(t, created.Created, 1)
		return created.Created[0]
	}
	reload := func(tx domain.Transaction) *domain.Transaction {
		t.Helper()
		out, err := transactions.GetTransactionByID(ctx, userID, tx.ID)
		require.NoError(t, err)
		return out
	}
	transferInflow := func() decimal.Decimal {
		t.Helper()
		var out string
		require.NoError(t, db.QueryRow(ctx, `SELECT COALESCE(sum(transfer_inflow), 0)::text FROM daily_account_totals
			WHERE user_id = $1 AND account_id = $2`, userID, card).Scan(&out))
		return d(out)
	}
	assertTotalsSquare := func() {
		t.Helper()
		var drift int
		require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM (
			SELECT * FROM daily_account_totals_expected($1)
			EXCEPT SELECT user_id, account_id, category_id, day, inflow, outflow, inflow_base, outflow_base,
			              tx_count, missing_base_count, transfer_inflow, transfer_outflow, transfer_inflow_base, transfer_outflow_base
			FROM daily_account_totals WHERE user_id = $1) x`, userID).Scan(&drift))
		assert.Zero(t, drift, "daily_account_totals descuadrado")
	}

	// sin contraparte: espera, y ya cuenta como transferencia
	day := at(today.AddDate(0, 0, -2), 10)
	pago := email(card, false, 700000, day, true)
	assert.True(t, pago.NeedsCounterpart)
	linked, err := transactions.LinkPendingCardPayments(ctx, userID)
	require.NoError(t, err)
	assert.Zero(t, linked)
	assert.True(t, transferInflow().Equal(d("700000")), transferInflow().String())
	assertTotalsSquare()

	// llega después el correo de la salida: se liga solo y deja de esperar
	salida := email(nomina, true, 700000, day.Add(2*time.Hour), false)
	linked, err = transactions.LinkPendingCardPayments(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, 1, linked)
	pagoLigado, salidaLigada := reload(pago), reload(salida)
	assert.False(t, pagoLigado.NeedsCounterpart)
	require.NotNil(t, pagoLigado.TransferGroupID)
	assert.Equal(t, *pagoLigado.TransferGroupID, *salidaLigada.TransferGroupID)
	assert.True(t, transferInflow().Equal(d("700000")), "ligado sigue fuera de los flujos")
	assertTotalsSquare()

	// con dos gastos posibles no adivina: sigue esperando
	duda := at(lastMonth.AddDate(0, 0, 10), 10)
	otroPago := email(card, false, 55000, duda, true)
	email(nomina, true, 55000, duda, false)
	email(ahorros, true, 55000, duda, false)
	linked, err = transactions.LinkPendingCardPayments(ctx, userID)
	require.NoError(t, err)
	assert.Zero(t, linked)
	assert.True(t, reload(otroPago).NeedsCounterpart)

	// la cuenta sugerida es la que ya pagó esta tarjeta
	suggested, err := transactions.SuggestCounterpartAccount(ctx, userID, otroPago.ID)
	require.NoError(t, err)
	require.NotNil(t, suggested)
	assert.Equal(t, nomina, *suggested)

	// crear la contraparte a mano también deja de esperar
	link := &domain.TransferLink{UserID: userID, TransactionID: otroPago.ID, CounterpartAccountID: ahorros}
	require.NoError(t, transactions.CreateTransferCounterpart(ctx, link))
	assert.False(t, reload(otroPago).NeedsCounterpart)
	assertTotalsSquare()

	// "no pagué desde mis cuentas": vuelve a ser una entrada normal
	ajeno := email(card, false, 20000, at(lastMonth.AddDate(0, 0, 12), 10), true)
	require.NoError(t, transactions.DismissCounterpart(ctx, userID, ajeno.ID))
	assert.False(t, reload(ajeno).NeedsCounterpart)
	assert.ErrorIs(t, transactions.DismissCounterpart(ctx, userID, ajeno.ID), domain.ErrDataNotFound)
	assertTotalsSquare()

	// pasarlo a gasto al editar también deja de esperar
	editado := email(card, false, 30000, at(lastMonth.AddDate(0, 0, 13), 10), true)
	gasto := reload(editado)
	gasto.Expense = true
	require.NoError(t, transactions.UpdateTransaction(ctx, gasto))
	assert.False(t, reload(editado).NeedsCounterpart)
	assertTotalsSquare()

	// reglas por corte: corte el 1, último corte = el 1 de este mes
	email(card, true, 600000, at(lastMonth.AddDate(0, 0, 20), 10), false) // compras del último corte
	email(card, true, 90000, at(today.AddDate(0, 0, -1), 10), false)      // consumos de este corte
	email(card, true, 400000, at(twoMonthsAgo.AddDate(0, 0, 20), 10), false)

	cards := repository.NewCreditCardRepository(db)
	statement := int16(1)
	require.NoError(t, cards.SaveCreditCard(ctx, &domain.CreditCardDetails{AccountID: card, UserID: userID, StatementDay: &statement}))
	status, err := cards.ListCreditCardStatus(ctx, userID)
	require.NoError(t, err)
	require.Len(t, status, 1)
	s := status[0]
	// compras del corte: 600.000 + los 30.000 editados; pagos después del corte: 700.000
	assert.True(t, s.StatementDebt.Equal(d("630000")), s.StatementDebt.String())
	assert.True(t, s.PendingStatement.IsZero(), s.PendingStatement.String())
	assert.True(t, s.PurchasesSince.Equal(d("90000")), s.PurchasesSince.String())
	// 90.000 de consumos − 70.000 pagados de más; el saldo acumulado diría más de un millón
	assert.True(t, s.Debt.Equal(d("20000")), s.Debt.String())

	var balance, gain string
	require.NoError(t, db.QueryRow(ctx, `SELECT balance::text, unrealized_gain::text FROM net_worth($1)
		WHERE account_id = $2`, userID, card).Scan(&balance, &gain))
	assert.True(t, d(balance).Equal(d("-20000")), balance)
	assert.True(t, d(gain).IsZero(), gain)

	cycles, err := cards.ListCreditCardCycles(ctx, userID, card)
	require.NoError(t, err)
	require.Len(t, cycles, 3, "la cuenta se creó hace tres cortes")
	last := cycles[len(cycles)-1]
	assert.Equal(t, firstOfMonth.Format(time.DateOnly), last.StatementDate.Format(time.DateOnly))
	assert.True(t, last.Purchases.Equal(d("630000")), last.Purchases.String())
	assert.True(t, last.Payments.Equal(d("700000")), last.Payments.String())
	assert.True(t, last.Counted)
	assert.False(t, cycles[0].Counted, "el primer corte no está completo")

	// una devolución pequeña no paga el corte
	var pending string
	require.NoError(t, db.QueryRow(ctx, `UPDATE transactions SET date = date - INTERVAL '1 month'
		WHERE user_id = $1 AND id = $2 RETURNING id::text`, userID, pago.ID).Scan(&pending))
	email(card, false, 5000, at(today.AddDate(0, 0, -1), 11), false)
	status, err = cards.ListCreditCardStatus(ctx, userID)
	require.NoError(t, err)
	assert.True(t, status[0].PendingStatement.Equal(d("625000")), status[0].PendingStatement.String())
	assert.True(t, status[0].Debt.Equal(d("715000")), status[0].Debt.String())
}
