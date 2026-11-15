//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// RegisterEmail must keep working when emails gets new columns (000039 added alert_sent_at and broke a
// RETURNING * scan: connecting or reconnecting an email failed).
func TestEmailRepository_RegisterEmail(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewEmailRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "re-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM emails WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})

	email := &domain.Email{
		UserID:   userID,
		Email:    "lectura@gmail.com",
		Token:    domain.EmailToken{Access: "a", Refresh: "r", Type: "Bearer"},
		Active:   true,
		Provider: "gmail",
	}
	require.NoError(t, repo.RegisterEmail(ctx, email))
	require.NotNil(t, email.ID)
	assert.Equal(t, "gmail", email.Provider)
	assert.Nil(t, email.Error)
	assert.False(t, email.CreatedAt.IsZero())

	got, err := repo.GetEmail(ctx, userID, *email.ID, nil)
	require.NoError(t, err)
	assert.Equal(t, "lectura@gmail.com", got.Email)
	assert.Equal(t, "r", got.Token.Refresh)
}
