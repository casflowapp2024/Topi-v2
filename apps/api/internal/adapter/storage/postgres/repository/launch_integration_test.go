//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"

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
