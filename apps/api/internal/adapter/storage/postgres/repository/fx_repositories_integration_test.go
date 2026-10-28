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

// TestMulticurrencyRepositories: cuenta con moneda, transferencia USD→COP, tasa manual, cotización
// y patrimonio, contra el esquema migrado. Usa una tasa 'manual' de hoy (gana sobre las reales).
func TestMulticurrencyRepositories(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-fx-" + uuid.NewString()
	d := decimal.RequireFromString

	var today time.Time
	require.NoError(t, db.QueryRow(ctx, "SELECT (now() AT TIME ZONE 'America/Bogota')::date").Scan(&today))
	var insertedRate bool
	require.NoError(t, db.QueryRow(ctx, `WITH ins AS (
		INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('COP', $1, 4000, 'manual')
		ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) > 0 FROM ins`, today).Scan(&insertedRate))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		if insertedRate {
			_, _ = db.Exec(ctx, "DELETE FROM fx_rates WHERE quote = 'COP' AND rate_date = $1 AND source = 'manual'", today)
		}
	})
	if !insertedRate {
		t.Skip("ya hay una tasa manual COP para hoy en esta base")
	}

	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	var bankID, categoryID uint64
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID).Scan(&bankID))
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Transferencias IT', 0, '') RETURNING id", userID).Scan(&categoryID))

	accounts := repository.NewAccountRepository(db)
	newAccount := func(name, digits, currency string) *domain.Account {
		a := &domain.Account{UserID: userID, Name: name, LastFourDigits: digits, Currency: currency,
			Bank: domain.Bank{ID: bankID}, Type: domain.AccountType{ID: 1}}
		require.NoError(t, accounts.CreateAccount(ctx, a))
		return a
	}
	cop := newAccount("Pesos IT", "1111", "")
	usd := newAccount("Dólares IT", "2222", "USD")
	assert.Equal(t, "COP", cop.Currency, "sin moneda queda en COP")
	assert.Equal(t, "USD", usd.Currency)

	bad := &domain.Account{UserID: userID, Name: "X", LastFourDigits: "3333", Currency: "XXX",
		Bank: domain.Bank{ID: bankID}, Type: domain.AccountType{ID: 1}}
	assert.ErrorIs(t, accounts.CreateAccount(ctx, bad), domain.ErrInvalidCurrency)

	transactions := repository.NewTransactionRepository(db)
	when := time.Now()

	t.Run("transferencia USD a COP", func(t *testing.T) {
		transfer := &domain.Transfer{UserID: userID, FromAccountID: usd.ID, ToAccountID: cop.ID,
			AmountSent: d("100"), AmountReceived: d("390000"), Date: when, Description: "Cambio", CategoryID: categoryID}
		require.NoError(t, transactions.CreateTransfer(ctx, transfer))

		assert.NotEmpty(t, transfer.GroupID)
		assert.Equal(t, "USD", transfer.FromCurrency)
		assert.Equal(t, "COP", transfer.ToCurrency)
		require.NotNil(t, transfer.MarketRate)
		assert.Equal(t, "4000", transfer.MarketRate.String())
		assert.Equal(t, "3900", transfer.EffectiveRate().String())

		out, in := transfer.Out, transfer.In
		assert.True(t, out.Expense)
		assert.False(t, in.Expense)
		assert.Equal(t, transfer.GroupID, *out.TransferGroupID)
		assert.Equal(t, transfer.GroupID, *in.TransferGroupID)
		assert.Equal(t, "USD", out.Currency)
		assert.Equal(t, "COP", in.Currency)
		// los dos lados valen lo que llegó en pesos: no hay ingreso ni gasto en moneda base
		assert.Equal(t, "390000", out.AmountBase.String())
		assert.Equal(t, "390000", in.AmountBase.String())
		assert.Equal(t, "3900", out.FxRate.String())
		assert.Equal(t, "1", in.FxRate.String())
		assert.Equal(t, "transfer", *out.FxRateSource)
	})

	t.Run("transferencia inválida", func(t *testing.T) {
		other := newAccount("Pesos 2 IT", "4444", "COP")
		sameCurrency := &domain.Transfer{UserID: userID, FromAccountID: cop.ID, ToAccountID: other.ID,
			AmountSent: d("10"), AmountReceived: d("11"), Date: when, CategoryID: categoryID}
		assert.ErrorIs(t, transactions.CreateTransfer(ctx, sameCurrency), domain.ErrInvalidTransfer)

		foreign := &domain.Transfer{UserID: "otro-" + userID, FromAccountID: cop.ID, ToAccountID: other.ID,
			AmountSent: d("10"), AmountReceived: d("10"), Date: when, CategoryID: categoryID}
		assert.ErrorIs(t, transactions.CreateTransfer(ctx, foreign), domain.ErrDataNotFound)
	})

	t.Run("la moneda de la cuenta queda bloqueada con movimientos", func(t *testing.T) {
		read, err := accounts.GetAccount(ctx, userID, usd.ID)
		require.NoError(t, err)
		assert.True(t, read.HasTransactions)
		assert.Equal(t, "USD", read.Currency)
	})

	t.Run("cotización", func(t *testing.T) {
		quote, err := repository.NewFxRepository(db).GetQuote(ctx, "USD", "COP", today)
		require.NoError(t, err)
		require.NotNil(t, quote.Rate)
		assert.Equal(t, "4000", quote.Rate.String())
		assert.Equal(t, "manual", *quote.Source)
	})

	t.Run("patrimonio: USD a la tasa de hoy y pérdida cambiaria", func(t *testing.T) {
		netWorth, err := repository.NewFxRepository(db).GetNetWorth(ctx, userID)
		require.NoError(t, err)
		assert.Equal(t, "COP", netWorth.BaseCurrency)

		byID := map[uint64]domain.NetWorthAccount{}
		for _, a := range netWorth.Accounts {
			byID[a.AccountID] = a
		}
		assert.Equal(t, "390000", byID[cop.ID].Balance.String())
		assert.Equal(t, "0", byID[cop.ID].UnrealizedGain.String())
		// salieron 100 USD que costaron 390.000; hoy valen 400.000: −10.000
		assert.Equal(t, "-100", byID[usd.ID].Balance.String())
		assert.Equal(t, "-400000", byID[usd.ID].BaseValue.String())
		assert.Equal(t, "-390000", byID[usd.ID].Cost.String())
		assert.Equal(t, "-10000", byID[usd.ID].UnrealizedGain.String())
		assert.Equal(t, "-10000", netWorth.Total.String())
		assert.False(t, netWorth.MissingRates)
	})

	t.Run("tasa manual recalcula amount_base", func(t *testing.T) {
		list, err := transactions.ListTransactions(ctx, domain.TransactionFilters{UserID: userID, Limit: 10})
		require.NoError(t, err)
		var outID uint64
		for _, tx := range list {
			if tx.Expense {
				outID = tx.ID
				assert.Equal(t, "USD", tx.Account.Currency)
			}
		}
		require.NotZero(t, outID)

		rate := d("3950")
		update := &domain.Transaction{ID: outID, UserID: userID, Expense: true, Checked: true, FxRate: &rate}
		require.NoError(t, transactions.UpdateTransaction(ctx, update))
		assert.Equal(t, "3950", update.FxRate.String())
		assert.Equal(t, "395000", update.AmountBase.String())
		assert.Equal(t, "user", *update.FxRateSource)
	})
}
