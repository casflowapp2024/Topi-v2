//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAccountsReportCash: en la vista de una cuenta de efectivo, Entró y Salió son todo lo que entró y
// salió de la cuenta (transferencias incluidas, sin importar si la categoría es de ingreso o de gasto),
// así que Entró − Salió es lo que se movió el saldo; las cifras van en la moneda de la cuenta.
// Septiembre de 2026 con una tasa 'manual' COP de 4000 el 16 (se salta si la base ya tiene una ese día).
func TestAccountsReportCash(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-ar-" + uuid.NewString()
	day := time.Date(2026, 9, 16, 0, 0, 0, 0, time.UTC)

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
		t.Skip("ya hay una tasa manual COP para el 2026-09-16 en esta base")
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
	food := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Comida IT', 0, '') RETURNING id", userID)
	// categoría de ingreso usada para un pago que sale: antes restaba de Entró en vez de sumar a Salió
	funds := id("INSERT INTO categories (user_id, name, budget, emoji, income) VALUES ($1, 'Fondos IT', 0, '', true) RETURNING id", userID)
	account := func(name, digits, currency string) int64 {
		return int64(id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, 1, 0, $5, '2026-09-01 12:00:00-05') RETURNING id`,
			userID, name, digits, bank, currency))
	}
	savings := account("Ahorros IT", "0001", "COP")
	dollars := account("Dólares IT", "0002", "USD")
	tx := func(accountID int64, categoryID uint64, expense bool, amount string, group any) {
		t.Helper()
		_, err := db.Exec(ctx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, transfer_group_id)
			VALUES ($1, $2, $3, 'IT', $4, $5, '2026-09-16 10:00:00-05', $6)`, userID, categoryID, accountID, expense, amount, group)
		require.NoError(t, err)
	}
	group := uuid.NewString()
	tx(dollars, funds, false, "100", nil)   // entra
	tx(dollars, food, false, "5", nil)      // devolución en una categoría de gasto: entra
	tx(dollars, food, true, "30", nil)      // sale
	tx(dollars, food, true, "20", group)    // transferencia que sale: 20 USD
	tx(savings, food, false, "80000", group) // ... y entra a la de pesos (80.000 COP)
	tx(savings, funds, true, "1400000", nil) // sale, con categoría de ingreso

	analysis := repository.NewAnalysisRepository(db)
	report := func(accountID int64) domain.AccountsReport {
		t.Helper()
		r := domain.AccountsReport{UserID: userID, Start: day.AddDate(0, 0, -15), End: day.AddDate(0, 0, 15),
			Accounts: []int64{accountID}, AccountsType: enums.Savings}
		r.SetAccountTypeIDs()
		financial, err := analysis.GetFinancialAccountSummary(ctx, userID, r.Start, r.End, r.AccountTypeIDs, r.Accounts)
		require.NoError(t, err)
		balance, err := analysis.GetBalanceSummary(ctx, userID, r.Start, r.End, r.AccountTypeIDs, r.Accounts)
		require.NoError(t, err)
		r.SetAccountsReport(financial, balance)
		return r
	}

	usd := report(dollars)
	assert.InDelta(t, 105, usd.Income.Value, 0.001, "en dólares, devolución y transferencia incluidas")
	assert.InDelta(t, -50, usd.Expenses.Value, 0.001)
	assert.InDelta(t, 55, usd.Balance.Value, 0.001, "saldo en la moneda de la cuenta")

	cop := report(savings)
	assert.InDelta(t, 80000, cop.Income.Value, 0.001, "la transferencia que entra cuenta")
	assert.InDelta(t, -1400000, cop.Expenses.Value, 0.001, "el pago con categoría de ingreso sale")
	assert.InDelta(t, cop.Income.Value+cop.Expenses.Value, cop.Balance.Value, 0.001, "Entró − Salió = lo que se movió el saldo")
}
