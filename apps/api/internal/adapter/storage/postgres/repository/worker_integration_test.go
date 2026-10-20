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

func TestAdminCreateTransactions_IdempotencyAndLegacyDedupe(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewTransactionRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "it-" + userID[:8] + "@example.com", Role: domain.RoleUser}))

	var bankID, accountID, categoryID uint64
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

	base := time.Date(2026, 10, 17, 8, 30, 0, 0, time.UTC)
	newTx := func(msg *string, amount float64, date time.Time) domain.Transaction {
		return domain.Transaction{
			UserID: userID, Description: "Compra IT", Expense: true, Amount: amount, Date: date,
			Category: domain.Category{ID: categoryID}, Account: domain.Account{ID: accountID},
			Automated: true, SourceMessageID: msg,
		}
	}
	msg := func(id string) *string { return &id }

	// legacy transaction stored by the previous reader (no source_message_id)
	_, err := db.Exec(ctx,
		"INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, automated) "+
			"VALUES ($1, $2, $3, 'Legacy', true, 50000, $4, true)", userID, categoryID, accountID, base)
	require.NoError(t, err)

	result, err := repo.AdminCreateTransactions(ctx, []domain.Transaction{
		newTx(msg("m-1"), 50000, base.Add(90*time.Second)), // legacy duplicate (±2 min)
		newTx(msg("m-2"), 50000, base.Add(3*time.Minute)),  // same amount, outside the window
		newTx(msg("m-3"), 70000, base),                     // different amount
	})
	require.NoError(t, err)
	assert.Len(t, result.Created, 2)
	require.Len(t, result.Skipped, 1)
	assert.Equal(t, "m-1", *result.Skipped[0].SourceMessageID)
	assert.Equal(t, domain.SkipLegacyDuplicate, result.Skipped[0].Reason)
	assert.Equal(t, "m-2", *result.Created[0].SourceMessageID)

	// reprocessing the same emails never duplicates
	result, err = repo.AdminCreateTransactions(ctx, []domain.Transaction{
		newTx(msg("m-2"), 50000, base.Add(3*time.Minute)),
		newTx(msg("m-3"), 70000, base),
	})
	require.NoError(t, err)
	assert.Empty(t, result.Created)
	require.Len(t, result.Skipped, 2)
	assert.Equal(t, domain.SkipDuplicateMessage, result.Skipped[0].Reason)
	assert.Equal(t, domain.SkipDuplicateMessage, result.Skipped[1].Reason)

	var count int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE user_id = $1", userID).Scan(&count))
	assert.Equal(t, 3, count, "legacy + m-2 + m-3")

	// without source_message_id (manual admin load) the old behaviour is kept: plain insert
	result, err = repo.AdminCreateTransactions(ctx, []domain.Transaction{newTx(nil, 50000, base)})
	require.NoError(t, err)
	assert.Len(t, result.Created, 1)
}

func TestEmailJobRepository_EnqueueDedupe(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewEmailJobRepository(db)

	key := "999999:it-" + uuid.NewString()[:8] + "@banco.test"
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM email_jobs WHERE dedupe_key = $1", key) })

	// hourly job (priority 0) scheduled in the future
	var hourly int64
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO email_jobs (payload, priority, dedupe_key, run_after) "+
			"VALUES ('{\"onboarding\":false}', 0, $1, now() + interval '1 hour') RETURNING id",
		key).Scan(&hourly))

	// "leer ahora" for the same pair reuses and promotes the pending job
	id, err := repo.Enqueue(ctx, []byte(`{"onboarding":true}`), 1, key)
	require.NoError(t, err)
	assert.Equal(t, hourly, id)

	var (
		priority   int16
		runNow     bool
		onboarding bool
		active     int
	)
	require.NoError(t, db.QueryRow(ctx,
		"SELECT priority, run_after <= now(), (payload->>'onboarding')::bool FROM email_jobs WHERE id = $1", id).
		Scan(&priority, &runNow, &onboarding))
	assert.Equal(t, int16(1), priority)
	assert.True(t, runNow)
	assert.True(t, onboarding, "a pending job takes the new payload")

	require.NoError(t, db.QueryRow(ctx,
		"SELECT count(*) FROM email_jobs WHERE dedupe_key = $1 AND status IN ('pending','running')", key).Scan(&active))
	assert.Equal(t, 1, active)

	// once done, a new job can be enqueued for the same pair
	_, err = db.Exec(ctx, "UPDATE email_jobs SET status = 'done' WHERE id = $1", id)
	require.NoError(t, err)
	next, err := repo.Enqueue(ctx, []byte(`{}`), 1, key)
	require.NoError(t, err)
	assert.NotEqual(t, id, next)
}
