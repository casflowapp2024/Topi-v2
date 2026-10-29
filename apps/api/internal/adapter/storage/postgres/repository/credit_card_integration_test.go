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
	assert.Equal(t, []string{"Comisiones", "Compras IT", "intereses"}, categories, "no crea Intereses si ya hay una")

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
	assert.True(t, s.Debt.Equal(d("300000")), s.Debt.String()) // 450.000 en compras − 150.000 pagados
	require.NotNil(t, s.Available)
	assert.True(t, s.Available.Equal(d("700000")), s.Available.String())
	require.NotNil(t, s.LastStatement)
	assert.Equal(t, firstOfMonth.Format(time.DateOnly), s.LastStatement.Format(time.DateOnly))
	assert.Equal(t, firstOfMonth.AddDate(0, 1, 0).Format(time.DateOnly), s.NextStatement.Format(time.DateOnly))
	assert.Equal(t, firstOfMonth.AddDate(0, 0, 19).Format(time.DateOnly), s.DueDate.Format(time.DateOnly))
	assert.True(t, s.StatementDebt.Equal(d("400000")), s.StatementDebt.String())
	assert.True(t, s.PaidSinceStatement.Equal(d("150000")), s.PaidSinceStatement.String())
	assert.True(t, s.PendingStatement.Equal(d("250000")), s.PendingStatement.String())
	assert.True(t, s.PurchasesSince.Equal(d("50000")), s.PurchasesSince.String())
	assert.Equal(t, 1, s.InstallmentPurchases)
}
