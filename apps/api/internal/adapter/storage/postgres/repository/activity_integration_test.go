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

func TestActivityAndFounderRepositories_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	activity := repository.NewActivityRepository(db)
	founders := repository.NewFounderRepository(db)

	newUser := func(createdAt time.Time) string {
		id := uuid.NewString()
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: "act-" + id[:8] + "@example.com", Role: domain.RoleUser}))
		_, err := db.Exec(ctx, "UPDATE users SET created_at = $2 WHERE id = $1", id, createdAt)
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id) })
		return id
	}

	old := newUser(time.Now().AddDate(-1, 0, 0))
	recent := newUser(time.Now())

	// activity: one row per user and day, repeated writes are ignored, unknown users too
	day := domain.ActivityDay(time.Now())
	require.NoError(t, activity.MarkActive(ctx, old, day))
	require.NoError(t, activity.MarkActive(ctx, old, day))
	require.NoError(t, activity.MarkActive(ctx, old, day.AddDate(0, 0, -1)))
	require.NoError(t, activity.MarkActive(ctx, "does-not-exist", day))

	var rows int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM user_activity_days WHERE user_id = $1", old).Scan(&rows))
	assert.Equal(t, 2, rows)
	var stored string
	require.NoError(t, db.QueryRow(ctx, "SELECT max(day)::text FROM user_activity_days WHERE user_id = $1", old).Scan(&stored))
	assert.Equal(t, day.Format(time.DateOnly), stored)

	// founders: only the users created before the cutoff; running it again marks nobody new
	cutoff := time.Now().AddDate(0, 0, -1)
	marked, err := founders.MarkEligible(ctx, cutoff)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, marked, int64(1))

	eligible := func(id string) bool {
		var value bool
		require.NoError(t, db.QueryRow(ctx, "SELECT founder_eligible FROM users WHERE id = $1", id).Scan(&value))
		return value
	}
	assert.True(t, eligible(old))
	assert.False(t, eligible(recent))

	again, err := founders.MarkEligible(ctx, cutoff)
	require.NoError(t, err)
	assert.Equal(t, int64(0), again)

	// an earlier cutoff never unmarks
	_, err = founders.MarkEligible(ctx, time.Now().AddDate(-5, 0, 0))
	require.NoError(t, err)
	assert.True(t, eligible(old))
}
