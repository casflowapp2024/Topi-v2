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

func TestAuthCodeRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	codes := repository.NewAuthCodeRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "ac-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID) })

	// new users are not verified; MarkEmailVerified is idempotent
	user, err := users.GetUserByID(ctx, userID)
	require.NoError(t, err)
	assert.Nil(t, user.EmailVerifiedAt)
	assert.Equal(t, domain.EmailStatusOK, user.EmailStatus)
	require.NoError(t, users.MarkEmailVerified(ctx, userID))
	user, _ = users.GetUserByID(ctx, userID)
	require.NotNil(t, user.EmailVerifiedAt)
	first := *user.EmailVerifiedAt
	require.NoError(t, users.MarkEmailVerified(ctx, userID))
	user, _ = users.GetUserByID(ctx, userID)
	assert.Equal(t, first, *user.EmailVerifiedAt)

	_, err = codes.GetLatest(ctx, userID, domain.CodePasswordReset)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)

	expires := time.Now().Add(10 * time.Minute)
	require.NoError(t, codes.Create(ctx, userID, domain.CodePasswordReset, "hash-1", expires))
	require.NoError(t, codes.Create(ctx, userID, domain.CodeVerifyEmail, "hash-v", expires))
	require.NoError(t, codes.Create(ctx, userID, domain.CodePasswordReset, "hash-2", expires))

	latest, err := codes.GetLatest(ctx, userID, domain.CodePasswordReset)
	require.NoError(t, err)
	assert.Equal(t, "hash-2", latest.CodeHash, "the new code replaces the old one")
	assert.WithinDuration(t, expires, latest.ExpiresAt, time.Second)

	var active int
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM auth_codes WHERE user_id = $1 AND used_at IS NULL`, userID).Scan(&active))
	assert.Equal(t, 2, active, "one reset + one verify")

	attempts, err := codes.IncrementAttempts(ctx, latest.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, attempts)

	used, err := codes.MarkUsed(ctx, latest.ID)
	require.NoError(t, err)
	assert.True(t, used)
	used, err = codes.MarkUsed(ctx, latest.ID)
	require.NoError(t, err)
	assert.False(t, used, "a code is used once")

	_, err = codes.GetLatest(ctx, userID, domain.CodePasswordReset)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	verify, err := codes.GetLatest(ctx, userID, domain.CodeVerifyEmail)
	require.NoError(t, err)
	assert.Equal(t, "hash-v", verify.CodeHash)
}
