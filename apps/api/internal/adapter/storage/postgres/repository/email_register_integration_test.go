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

// plan/27 §D: a connection that goes down keeps the first error_at, opens one incident, and reconnecting it
// (registering the same address again) clears the error and closes the incident; deleting closes it as deleted.
func TestEmailRepository_ConnectionIncidents(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewEmailRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "ci-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM connection_incidents WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM emails WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})

	register := func() *domain.Email {
		email := &domain.Email{UserID: userID, Email: "banco@gmail.com", Active: true, Provider: "gmail",
			Token: domain.EmailToken{Access: "a", Refresh: "r", Type: "Bearer"}}
		require.NoError(t, repo.RegisterEmail(ctx, email))
		return email
	}
	type incident struct {
		Code       string
		Resolution *string
	}
	incidents := func() []incident {
		rows, err := db.Query(ctx, `SELECT error_code, resolution FROM connection_incidents WHERE user_id = $1 ORDER BY id`, userID)
		require.NoError(t, err)
		defer rows.Close()
		var out []incident
		for rows.Next() {
			var i incident
			require.NoError(t, rows.Scan(&i.Code, &i.Resolution))
			out = append(out, i)
		}
		return out
	}

	first := register()
	assert.False(t, first.Reconnected, "a new connection is not a reconnect")
	id := *first.ID

	require.NoError(t, repo.SaveEmailError(ctx, id, "token_expired_or_revoked"))
	down, err := repo.GetEmail(ctx, userID, id, nil)
	require.NoError(t, err)
	require.NotNil(t, down.ErrorAt)
	firstErrorAt := *down.ErrorAt

	// the worker reports it again: same error_at, still one incident
	require.NoError(t, repo.SaveEmailError(ctx, id, "token_expired_or_revoked"))
	down, err = repo.GetEmail(ctx, userID, id, nil)
	require.NoError(t, err)
	assert.True(t, firstErrorAt.Equal(*down.ErrorAt))
	require.Len(t, incidents(), 1)
	assert.Nil(t, incidents()[0].Resolution)

	// reconnect: same row, error cleared, incident closed
	again := register()
	assert.True(t, again.Reconnected)
	assert.Equal(t, id, *again.ID, "reconnecting keeps the connection (and the accounts linked to it)")
	assert.Nil(t, again.Error)
	back, err := repo.GetEmail(ctx, userID, id, nil)
	require.NoError(t, err)
	assert.Nil(t, back.Error)
	assert.Nil(t, back.ErrorAt)
	require.Len(t, incidents(), 1)
	require.NotNil(t, incidents()[0].Resolution)
	assert.Equal(t, "reconnected", *incidents()[0].Resolution)

	// registering a healthy connection again is not a reconnect
	assert.False(t, register().Reconnected)

	// down again, then deleted
	require.NoError(t, repo.SaveEmailError(ctx, id, "authorization_error"))
	require.Len(t, incidents(), 2)
	tx, err := db.Begin(ctx)
	require.NoError(t, err)
	require.NoError(t, repo.DeleteEmailTrx(ctx, tx, userID, id))
	require.NoError(t, tx.Commit(ctx))
	got := incidents()
	require.Len(t, got, 2)
	require.NotNil(t, got[1].Resolution)
	assert.Equal(t, "deleted", *got[1].Resolution)
	assert.Equal(t, "authorization_error", got[1].Code)
}

// Reading.Reconnect: % reconnected within 7 days (over incidents at least 7 days old) and median hours
func TestAdminMetrics_ReconnectStats(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	metrics := repository.NewAdminMetricsRepository(db)

	var existing int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM connection_incidents").Scan(&existing))
	if existing > 0 {
		t.Skip("connection_incidents is not empty in this database")
	}

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "rs-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM connection_incidents WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})
	// 20 days ago, back in 10 h | 15 days ago, back in 30 h | 10 days ago, back after 9 days | 9 days ago, open |
	// 2 days ago, open (too recent to count in the 7-day share)
	_, err := db.Exec(ctx, `INSERT INTO connection_incidents (user_id, provider, error_code, started_at, resolved_at, resolution) VALUES
($1, 'gmail', 'x', now() - interval '20 days', now() - interval '20 days' + interval '10 hours', 'reconnected'),
($1, 'gmail', 'x', now() - interval '15 days', now() - interval '15 days' + interval '30 hours', 'reconnected'),
($1, 'gmail', 'x', now() - interval '10 days', now() - interval '1 day', 'reconnected'),
($1, 'gmail', 'x', now() - interval '9 days', NULL, NULL),
($1, 'outlook', 'x', now() - interval '2 days', NULL, NULL)`, userID)
	require.NoError(t, err)

	health, err := metrics.Reading(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(5), health.Reconnect.Incidents90d)
	assert.Equal(t, int64(2), health.Reconnect.Open)
	require.NotNil(t, health.Reconnect.Reconnected7dPct)
	assert.InDelta(t, 50.0, *health.Reconnect.Reconnected7dPct, 0.01) // 2 of the 4 that are >= 7 days old
	require.NotNil(t, health.Reconnect.MedianHours)
	assert.InDelta(t, 30.0, *health.Reconnect.MedianHours, 0.01) // 10 h, 30 h, 216 h
}
