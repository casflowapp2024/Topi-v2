//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLaunchRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewLaunchRepository(db)
	_, err := db.Exec(ctx, "DELETE FROM launch_stages")
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM launch_stages") })

	require.NoError(t, repo.SetStage(ctx, domain.LaunchStage{Stage: domain.StageI1, StartedAt: "2026-11-14", Note: "cercanos", SetBy: "a1"}))
	require.NoError(t, repo.SetStage(ctx, domain.LaunchStage{Stage: domain.StageI1, StartedAt: "2026-11-15", Note: "corregido", SetBy: "a1"}))
	stages, err := repo.Stages(ctx)
	require.NoError(t, err)
	require.Len(t, stages, 1)
	assert.Equal(t, "2026-11-15", stages[0].StartedAt)
	assert.Equal(t, "corregido", stages[0].Note)

	_, err = db.Exec(ctx, "INSERT INTO launch_stages (stage, started_at, set_by) VALUES ('I.9', '2026-11-14', 'a1')")
	assert.Error(t, err, "closed list of stages")

	n, err := repo.GmailConnections(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, n, int64(0))
}

// plan/28 §7: every Gmail account that ever connected is counted once, by hash, and stays counted after the
// connection is removed (like Google's counter). Outlook does not count.
func TestLaunchRepository_GmailGrants(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	repo := repository.NewLaunchRepository(db)
	users := repository.NewUserRepository(db)
	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "gq-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM emails WHERE user_id = $1", userID)
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})
	before, err := repo.GmailGrants(ctx, nil)
	require.NoError(t, err)
	assert.Zero(t, before.Since, "without a baseline date nothing counts as since")

	var start time.Time
	require.NoError(t, db.QueryRow(ctx, "SELECT now()").Scan(&start))
	insert := func(address, provider string) uint64 {
		var id uint64
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider)
VALUES ($1, $2, 'a', 'r', 'Bearer', $3) RETURNING id`, userID, address, provider).Scan(&id))
		return id
	}
	first := insert("Cupo.Uno-"+userID[:8]+"@gmail.com", "gmail")
	insert("cupo.uno-"+userID[:8]+"@gmail.com ", "gmail") // same account, other spelling
	insert("cupo.dos-"+userID[:8]+"@outlook.com", "outlook")
	_, err = db.Exec(ctx, "DELETE FROM emails WHERE id = $1", first)
	require.NoError(t, err)

	after, err := repo.GmailGrants(ctx, &start)
	require.NoError(t, err)
	assert.Equal(t, before.Total+1, after.Total, "one Google account, still counted after removing it")
	assert.Equal(t, int64(1), after.Since)

	var stored string
	require.NoError(t, db.QueryRow(ctx, `SELECT email_hash FROM gmail_oauth_grants ORDER BY first_granted_at DESC LIMIT 1`).Scan(&stored))
	assert.Len(t, stored, 64)
	assert.False(t, strings.Contains(stored, "@"), "only the hash, never the address")
}
