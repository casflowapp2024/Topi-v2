//go:build integration

package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type installmentRow struct {
	Installment, Installments int
	BudgetDate                string
	StatementDate             *string
	Amount                    decimal.Decimal
	AmountBase                *decimal.Decimal
}

// TestInstallmentSchedule: el calendario sale de transactions.installments: suma exacta, meses cortos,
// corte de cada cuota, tasa de la compra, y se corrige solo al cambiar las cuotas o borrar la compra.
func TestInstallmentSchedule(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-cuo-" + uuid.NewString()
	rateDay := time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC)

	var insertedRate bool
	require.NoError(t, db.QueryRow(ctx, `WITH ins AS (
		INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('COP', $1, 4000, 'manual')
		ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) > 0 FROM ins`, rateDay).Scan(&insertedRate))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM credit_card_details WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		if insertedRate {
			_, _ = db.Exec(ctx, "DELETE FROM fx_rates WHERE quote = 'COP' AND rate_date = $1 AND source = 'manual'", rateDay)
		}
	})
	if !insertedRate {
		t.Skip("ya hay una tasa manual COP para el 2026-02-10 en esta base")
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
	category := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Compras IT', 0, '') RETURNING id", userID)
	account := func(name, digits, currency string, typeID int, statementDay any) uint64 {
		t.Helper()
		acc := id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, $6, '2025-12-01 12:00:00-05') RETURNING id`, userID, name, digits, bank, typeID, currency)
		if typeID == 4 {
			_, err := db.Exec(ctx, "INSERT INTO credit_card_details (account_id, user_id, statement_day) VALUES ($1, $2, $3)", acc, userID, statementDay)
			require.NoError(t, err)
		}
		return acc
	}
	card := account("Tarjeta IT", "0001", "COP", 4, 15)
	lastDay := account("Corte 31 IT", "0002", "COP", 4, 31)
	noCut := account("Sin corte IT", "0003", "COP", 4, nil)
	dollars := account("Dólares IT", "0004", "USD", 4, 15)
	savings := account("Ahorros IT", "0005", "COP", 1, nil)

	tx := func(accountID uint64, expense bool, amount, at string, installments any) uint64 {
		t.Helper()
		return id(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, installments)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6, $7) RETURNING id`, userID, category, accountID, expense, amount, at, installments)
	}
	schedule := func(transactionID uint64) []installmentRow {
		t.Helper()
		rows, err := db.Query(ctx, `
			SELECT installment, installments, budget_date::text, statement_date::text, amount::text, amount_base::text
			FROM installment_schedule($1) WHERE transaction_id = $2 ORDER BY installment`, userID, transactionID)
		require.NoError(t, err)
		defer rows.Close()
		var out []installmentRow
		for rows.Next() {
			var r installmentRow
			var amount string
			var base *string
			require.NoError(t, rows.Scan(&r.Installment, &r.Installments, &r.BudgetDate, &r.StatementDate, &amount, &base))
			r.Amount = decimal.RequireFromString(amount)
			if base != nil {
				b := decimal.RequireFromString(*base)
				r.AmountBase = &b
			}
			out = append(out, r)
		}
		return out
	}
	budgetDates := func(rows []installmentRow) []string {
		out := make([]string, len(rows))
		for i, r := range rows {
			out[i] = r.BudgetDate
		}
		return out
	}
	statementDates := func(rows []installmentRow) []string {
		out := make([]string, len(rows))
		for i, r := range rows {
			if r.StatementDate != nil {
				out[i] = *r.StatementDate
			}
		}
		return out
	}

	// La última cuota absorbe el redondeo: la suma es exacta
	thirds := schedule(tx(card, true, "1000000", "2026-01-10 10:00:00-05", 3))
	require.Len(t, thirds, 3)
	assert.Equal(t, "333333.3333", thirds[0].Amount.String())
	assert.Equal(t, "333333.3334", thirds[2].Amount.String())
	assert.Equal(t, 3, thirds[0].Installments)
	total := decimal.Zero
	for _, r := range thirds {
		total = total.Add(r.Amount)
	}
	assert.True(t, total.Equal(decimal.NewFromInt(1000000)), total.String())

	// Antes del corte: la primera cuota se cobra en el corte de ese mes. El mes de gasto empieza en la compra.
	assert.Equal(t, []string{"2026-01-10", "2026-02-10", "2026-03-10"}, budgetDates(thirds))
	assert.Equal(t, []string{"2026-01-15", "2026-02-15", "2026-03-15"}, statementDates(thirds))

	// El día del corte entra a ese corte; después, al siguiente, cruzando de año
	onCut := schedule(tx(card, true, "200000", "2026-01-15 10:00:00-05", 2))
	assert.Equal(t, []string{"2026-01-15", "2026-02-15"}, statementDates(onCut))
	afterCut := schedule(tx(card, true, "300000", "2026-12-20 10:00:00-05", 3))
	assert.Equal(t, []string{"2027-01-15", "2027-02-15", "2027-03-15"}, statementDates(afterCut))

	// Meses cortos: el 31 cae en el último día del mes, en el gasto y en el corte
	endOfMonth := schedule(tx(lastDay, true, "300000", "2026-01-31 10:00:00-05", 3))
	assert.Equal(t, []string{"2026-01-31", "2026-02-28", "2026-03-31"}, budgetDates(endOfMonth))
	assert.Equal(t, []string{"2026-01-31", "2026-02-28", "2026-03-31"}, statementDates(endOfMonth))

	// La fecha es la del usuario: 23:00 en Bogotá ya es el día siguiente en UTC
	lateNight := schedule(tx(card, true, "200000", "2026-03-15 23:00:00-05", 2))
	assert.Equal(t, "2026-03-15", lateNight[0].BudgetDate)
	assert.Equal(t, "2026-03-15", *lateNight[0].StatementDate)

	// Sin día de corte hay calendario de gasto, pero no de cobro
	unbilled := schedule(tx(noCut, true, "200000", "2026-01-10 10:00:00-05", 2))
	require.Len(t, unbilled, 2)
	assert.Nil(t, unbilled[0].StatementDate)

	// Entre monedas: cuotas en la moneda de la cuenta, con la tasa de la compra
	foreign := schedule(tx(dollars, true, "300", "2026-02-10 10:00:00-05", 3))
	require.Len(t, foreign, 3)
	assert.Equal(t, "100", foreign[0].Amount.String())
	require.NotNil(t, foreign[0].AmountBase)
	assert.Equal(t, "400000", foreign[0].AmountBase.String())
	assert.Equal(t, "400000", foreign[2].AmountBase.String())

	// Solo compras con tarjeta
	assert.Empty(t, schedule(tx(card, true, "50000", "2026-01-10 10:00:00-05", nil)), "sin cuotas no hay calendario")
	assert.Empty(t, schedule(tx(card, false, "50000", "2026-01-10 10:00:00-05", 3)), "una entrada no se reparte")
	assert.Empty(t, schedule(tx(savings, true, "50000", "2026-01-10 10:00:00-05", 3)), "fuera de la tarjeta no aplica")

	// Una pata de transferencia no se reparte
	leg := tx(card, true, "60000", "2026-01-10 10:00:00-05", 3)
	other := tx(savings, false, "60000", "2026-01-10 10:01:00-05", nil)
	group := uuid.NewString()
	_, err = db.Exec(ctx, "UPDATE transactions SET transfer_group_id = $1 WHERE id = ANY($2)", group, []int64{int64(leg), int64(other)})
	require.NoError(t, err)
	assert.Empty(t, schedule(leg))

	// Cambiar las cuotas, quitarlas o borrar la compra corrige el calendario
	changing := tx(card, true, "600000", "2026-01-10 10:00:00-05", 6)
	require.Len(t, schedule(changing), 6)
	_, err = db.Exec(ctx, "UPDATE transactions SET installments = 2 WHERE id = $1", changing)
	require.NoError(t, err)
	changed := schedule(changing)
	require.Len(t, changed, 2)
	assert.Equal(t, "300000", changed[1].Amount.String())
	_, err = db.Exec(ctx, "UPDATE transactions SET installments = NULL WHERE id = $1", changing)
	require.NoError(t, err)
	assert.Empty(t, schedule(changing))
	deleted := tx(card, true, "100000", "2026-01-10 10:00:00-05", 2)
	_, err = db.Exec(ctx, "DELETE FROM transactions WHERE id = $1", deleted)
	require.NoError(t, err)
	assert.Empty(t, schedule(deleted))

	// El calendario es del usuario
	var others int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM installment_schedule($1)", "otro-"+userID).Scan(&others))
	assert.Zero(t, others)

	// Marcar que ya se preguntó no toca el calendario ni los totales diarios
	reviewed := tx(card, true, "100000", "2026-01-10 10:00:00-05", 2)
	_, err = db.Exec(ctx, "UPDATE transactions SET installments_reviewed_at = now() WHERE id = $1", reviewed)
	require.NoError(t, err)
	require.Len(t, schedule(reviewed), 2)
	var drift int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM daily_account_totals_drift() WHERE user_id = $1", userID).Scan(&drift))
	assert.Zero(t, drift, "daily_account_totals descuadrado")
}
