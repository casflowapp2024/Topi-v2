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

// BANK_UNSUPPORTED_ALERT_SINCE: connections created before the cutoff never get the automatic email (the panel
// writes to those people personally); the ones created after it do.
func TestClaimUnsupportedAlerts_Since(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewReadingRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "si-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		for _, table := range []string{"accounts", "banks", "emails"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})
	var bank uint64
	require.NoError(t, db.QueryRow(ctx, "INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco SI', 'x@si.test') RETURNING id", userID).Scan(&bank))
	connection := func(address, age, digits string) uint64 {
		var id uint64
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider, created_at)
VALUES ($1, $2, 'a', 'r', 'Bearer', 'gmail', now() - $3::interval) RETURNING id`, userID, address, age).Scan(&id))
		_, err := db.Exec(ctx, `INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, email_id)
VALUES ($1, $2, $5, $3, 1, 0, 'COP', $4)`, userID, address, bank, id, digits)
		require.NoError(t, err)
		return id
	}
	old := connection("vieja@gmail.com", "60 days", "0001")
	recent := connection("nueva@gmail.com", "3 days", "0002")

	cutoff := time.Now().Add(-10 * 24 * time.Hour)
	alerts, err := repo.ClaimUnsupportedAlerts(ctx, domain.UnsupportedAfter, &cutoff, 1000)
	require.NoError(t, err)
	var mine []uint64
	for _, a := range alerts {
		if a.UserID == userID {
			mine = append(mine, a.EmailID)
		}
	}
	assert.Equal(t, []uint64{recent}, mine, "the old connection is left for a personal email")

	var claimed bool
	require.NoError(t, db.QueryRow(ctx, "SELECT unsupported_alert_at IS NOT NULL FROM emails WHERE id = $1", old).Scan(&claimed))
	assert.False(t, claimed, "not marked either: it is simply out of the automatic email")
}
