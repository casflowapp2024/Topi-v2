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

func TestReactivationRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewReactivationRepository(db)
	prefs := repository.NewNotificationRepository(db)

	userID := uuid.NewString()
	address := "re-" + userID[:8] + "@example.com"
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: address, Name: "Ana", Role: domain.RoleUser}))
	t.Cleanup(func() {
		for _, table := range []string{"email_outbox", "emails", "notification_prefs"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})

	target, err := repo.Target(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, address, target.Email)
	assert.Equal(t, "Ana", target.FirstName())
	assert.True(t, target.PersonalAllowed, "personal emails are on by default (no prefs row)")
	assert.False(t, target.ConnectionDown)
	assert.Nil(t, target.LastSentAt)

	_, err = repo.Target(ctx, "nobody-"+userID)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)

	// a connection down and a personal email queued
	_, err = db.Exec(ctx, `INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider, error)
VALUES ($1, 'x@gmail.com', 'a', 'r', 'Bearer', 'gmail', 'token_expired_or_revoked')`, userID)
	require.NoError(t, err)
	since := time.Now().Add(-time.Minute)
	before, err := repo.SentSince(ctx, since)
	require.NoError(t, err)
	_, err = db.Exec(ctx, `INSERT INTO email_outbox (user_id, to_email, template, payload, priority)
VALUES ($1, $2, 'reactivation_personal', '{}', 3)`, userID, address)
	require.NoError(t, err)

	target, err = repo.Target(ctx, userID)
	require.NoError(t, err)
	assert.True(t, target.ConnectionDown)
	require.NotNil(t, target.LastSentAt)
	after, err := repo.SentSince(ctx, since)
	require.NoError(t, err)
	assert.Equal(t, before+1, after)

	// the unsubscribe link of a personal email turns them off
	require.NoError(t, prefs.SetPref(ctx, userID, domain.UnsubPersonal, false))
	target, err = repo.Target(ctx, userID)
	require.NoError(t, err)
	assert.False(t, target.PersonalAllowed)
}
