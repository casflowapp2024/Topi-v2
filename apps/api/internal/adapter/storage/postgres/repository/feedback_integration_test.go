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

func TestFeedbackRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewFeedbackRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "fb-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM feedback WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})

	before, err := repo.CountUnread(ctx)
	require.NoError(t, err)

	first := &domain.Feedback{UserID: userID, Text: "Que lea Davivienda", ContactOK: true, AppVersion: "web"}
	require.NoError(t, repo.Create(ctx, first))
	require.NoError(t, repo.Create(ctx, &domain.Feedback{UserID: userID, Text: "Modo oscuro más oscuro"}))

	n, err := repo.CountSince(ctx, userID, time.Now().Add(-time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 2, n)

	unread, err := repo.CountUnread(ctx)
	require.NoError(t, err)
	assert.Equal(t, before+2, unread)

	items, err := repo.List(ctx, true, 200)
	require.NoError(t, err)
	var mine []domain.Feedback
	for _, f := range items {
		if f.UserID == userID {
			mine = append(mine, f)
		}
	}
	require.Len(t, mine, 2)
	assert.Equal(t, userID[:8], mine[0].ShortUser)

	require.NoError(t, repo.MarkRead(ctx, first.ID))
	require.NoError(t, repo.MarkRead(ctx, first.ID), "idempotent")
	assert.ErrorIs(t, repo.MarkRead(ctx, 999999999), domain.ErrDataNotFound)
	unread, err = repo.CountUnread(ctx)
	require.NoError(t, err)
	assert.Equal(t, before+1, unread)

	// the table refuses an empty text or one over 500 characters
	_, err = db.Exec(ctx, "INSERT INTO feedback (user_id, text) VALUES ($1, '   ')", userID)
	assert.Error(t, err)
}
