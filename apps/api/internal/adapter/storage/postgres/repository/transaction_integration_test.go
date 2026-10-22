//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Ver, editar y borrar una transacción contra el esquema migrado: la columna source_message_id
// (000020) rompía el Scan de GetTransactionByID, que seleccionaba t.*.
func TestTransaction_GetUpdateDelete(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewTransactionRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "it-" + userID[:8] + "@example.com", Role: domain.RoleUser}))

	var bankID, accountID, categoryID, txID uint64
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID).Scan(&bankID))
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance) VALUES ($1, 'Cuenta IT', '1234', $2, 1, 0) RETURNING id",
		userID, bankID).Scan(&accountID))
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Otros IT', 0, '') RETURNING id", userID).Scan(&categoryID))
	t.Cleanup(func() {
		for _, table := range []string{"transactions", "accounts", "categories", "banks"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})

	date := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, source_message_id) "+
			"VALUES ($1, $2, $3, 'Compra IT', true, 12345, $4, 'msg-it-1') RETURNING id",
		userID, categoryID, accountID, date).Scan(&txID))

	got, err := repo.GetTransactionByID(ctx, userID, txID)
	require.NoError(t, err)
	assert.Equal(t, "Compra IT", got.Description)
	assert.Equal(t, accountID, got.Account.ID)
	assert.Equal(t, "Cuenta IT", got.Account.Name)
	assert.Equal(t, "Banco IT", got.Account.Bank.Name)
	assert.Equal(t, "Otros IT", got.Category.Name)

	update := &domain.Transaction{
		ID: txID, UserID: userID, Description: "Compra IT editada", Expense: true, Amount: 54321, Date: date,
		Category: domain.Category{ID: categoryID}, Account: domain.Account{ID: accountID},
	}
	require.NoError(t, repo.UpdateTransaction(ctx, update))
	got, err = repo.GetTransactionByID(ctx, userID, txID)
	require.NoError(t, err)
	assert.Equal(t, "Compra IT editada", got.Description)
	assert.Equal(t, float64(54321), got.Amount)

	require.NoError(t, repo.DeleteTransaction(ctx, txID, userID))
	_, err = repo.GetTransactionByID(ctx, userID, txID)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
}
