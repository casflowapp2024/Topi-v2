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

func TestEmailRepository_ClaimConnectionAlert(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewEmailRepository(db)

	userID := uuid.NewString()
	account := "ca-" + userID[:8] + "@example.com"
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: account, Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM emails WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM notification_prefs WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})

	var emailID uint64
	require.NoError(t, db.QueryRow(ctx, `INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider)
VALUES ($1, 'banco@gmail.com', 'a', 'r', 'Bearer', 'gmail') RETURNING id`, userID).Scan(&emailID))

	// no error: nothing to alert
	_, ok, err := repo.ClaimConnectionAlert(ctx, emailID, domain.ConnectionAlertCooldown)
	require.NoError(t, err)
	assert.False(t, ok)

	require.NoError(t, repo.SaveEmailError(ctx, emailID, "token_expired_or_revoked"))
	alert, ok, err := repo.ClaimConnectionAlert(ctx, emailID, domain.ConnectionAlertCooldown)
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, &domain.ConnectionAlert{UserID: userID, UserEmail: account, ConnectionEmail: "banco@gmail.com", Provider: "gmail"}, alert)

	// second time inside 7 days: no
	_, ok, err = repo.ClaimConnectionAlert(ctx, emailID, domain.ConnectionAlertCooldown)
	require.NoError(t, err)
	assert.False(t, ok)

	// 8 days later: yes again
	_, err = db.Exec(ctx, "UPDATE emails SET alert_sent_at = now() - interval '8 days' WHERE id = $1", emailID)
	require.NoError(t, err)
	_, ok, err = repo.ClaimConnectionAlert(ctx, emailID, 7*24*time.Hour)
	require.NoError(t, err)
	assert.True(t, ok)

	// the user turned the alerts off
	_, err = db.Exec(ctx, "UPDATE emails SET alert_sent_at = NULL WHERE id = $1", emailID)
	require.NoError(t, err)
	_, err = db.Exec(ctx, "INSERT INTO notification_prefs (user_id, email_connection_alerts) VALUES ($1, false)", userID)
	require.NoError(t, err)
	_, ok, err = repo.ClaimConnectionAlert(ctx, emailID, domain.ConnectionAlertCooldown)
	require.NoError(t, err)
	assert.False(t, ok)
}
