package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"time"
)

// LaunchRepository implements port.LaunchRepository (plan/27 §I)
type LaunchRepository struct {
	db *postgres.DB
}

// NewLaunchRepository creates a new LaunchRepository instance
func NewLaunchRepository(db *postgres.DB) *LaunchRepository {
	return &LaunchRepository{db: db}
}

// Stages returns the stages that started, in order
func (r *LaunchRepository) Stages(ctx context.Context) ([]domain.LaunchStage, error) {
	rows, err := r.db.Query(ctx, `SELECT stage, started_at::text, note, updated_at FROM launch_stages ORDER BY stage`)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	stages := []domain.LaunchStage{}
	for rows.Next() {
		var s domain.LaunchStage
		if err = rows.Scan(&s.Stage, &s.StartedAt, &s.Note, &s.UpdatedAt); err != nil {
			return nil, err
		}
		stages = append(stages, s)
	}
	return stages, rows.Err()
}

// SetStage creates or updates the start of a stage
func (r *LaunchRepository) SetStage(ctx context.Context, s domain.LaunchStage) error {
	_, err := r.db.Exec(ctx, `INSERT INTO launch_stages (stage, started_at, note, set_by) VALUES ($1, $2::date, $3, $4)
ON CONFLICT (stage) DO UPDATE SET started_at = EXCLUDED.started_at, note = EXCLUDED.note, set_by = EXCLUDED.set_by,
  updated_at = now()`, s.Stage, s.StartedAt, s.Note, s.SetBy)
	return mappers.MapPostgresErrorCode(err)
}

// GmailGrants counts the Google accounts that ever connected (hashes in gmail_oauth_grants, plan/28 §7)
func (r *LaunchRepository) GmailGrants(ctx context.Context, since *time.Time) (domain.GmailGrants, error) {
	var g domain.GmailGrants
	err := r.db.QueryRow(ctx, `SELECT count(*), count(*) FILTER (WHERE $1::timestamptz IS NOT NULL AND first_granted_at > $1)
FROM gmail_oauth_grants`, since).Scan(&g.Total, &g.Since)
	return g, mappers.MapPostgresErrorCode(err)
}

// GmailConnections counts distinct Gmail addresses connected today (only a count: no address leaves the database)
func (r *LaunchRepository) GmailConnections(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `SELECT count(DISTINCT lower(email)) FROM emails WHERE provider = 'gmail'`).Scan(&n)
	return n, mappers.MapPostgresErrorCode(err)
}
