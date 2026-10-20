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

func TestUserRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewUserRepository(db)

	id := uuid.NewString()
	email := "it-" + id[:8] + "@example.com"
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id) })

	// migrated-like user without password
	require.NoError(t, repo.CreateUser(ctx, &domain.User{ID: id, Email: email, Name: "It", LastName: "Test", Role: domain.RoleUser}))

	err := repo.CreateUser(ctx, &domain.User{ID: uuid.NewString(), Email: "IT-" + id[:8] + "@EXAMPLE.COM", Role: domain.RoleUser})
	assert.ErrorIs(t, err, domain.ErrUsernameExistsException, "email is unique on lower(email)")

	user, err := repo.GetUserByEmail(ctx, "IT-"+id[:8]+"@Example.com")
	require.NoError(t, err)
	assert.Equal(t, id, user.ID)
	assert.False(t, user.HasPassword())

	_, err = repo.GetUserByID(ctx, "does-not-exist")
	assert.ErrorIs(t, err, domain.ErrUserNotFoundException)

	// set-initial-password only works once
	require.NoError(t, repo.SetInitialPassword(ctx, id, "hash-1"))
	assert.ErrorIs(t, repo.SetInitialPassword(ctx, id, "hash-2"), domain.ErrNotAuthorizedException)

	user, err = repo.GetUserByID(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "hash-1", *user.PasswordHash)
	assert.NotNil(t, user.PasswordSetAt)
	assert.Equal(t, 0, user.TokenVersion)

	version, err := repo.UpdatePassword(ctx, id, "hash-3")
	require.NoError(t, err)
	assert.Equal(t, 1, version)

	require.NoError(t, repo.UpdateProfile(ctx, id, "Nuevo", "Nombre"))
	user, err = repo.GetUserByID(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "Nuevo", user.Name)
	assert.Equal(t, "Nombre", user.LastName)
}

func TestRefreshTokenAndEvents_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	tokens := repository.NewRefreshTokenRepository(db)
	events := repository.NewAuthEventRepository(db)

	id := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: "it-" + id[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM auth_events WHERE user_id = $1", id)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	})

	hash := "hash-" + id
	require.NoError(t, tokens.Create(ctx, id, hash, time.Now().Add(time.Hour)))

	token, err := tokens.GetByHash(ctx, hash)
	require.NoError(t, err)
	assert.False(t, token.IsRevoked())

	revoked, err := tokens.Revoke(ctx, token.ID)
	require.NoError(t, err)
	assert.True(t, revoked)

	revoked, err = tokens.Revoke(ctx, token.ID)
	require.NoError(t, err)
	assert.False(t, revoked, "a second revoke must report the token was already used")

	require.NoError(t, tokens.Create(ctx, id, hash+"-2", time.Now().Add(time.Hour)))
	require.NoError(t, tokens.RevokeAllForUser(ctx, id))
	token, err = tokens.GetByHash(ctx, hash+"-2")
	require.NoError(t, err)
	assert.True(t, token.IsRevoked())

	_, err = tokens.GetByHash(ctx, "missing")
	assert.ErrorIs(t, err, domain.ErrDataNotFound)

	require.NoError(t, events.Record(ctx, domain.AuthEvent{UserID: id, Event: domain.EventLoginOK, IP: "127.0.0.1"}))
	var count int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM auth_events WHERE user_id = $1 AND email IS NULL", id).Scan(&count))
	assert.Equal(t, 1, count)
}
