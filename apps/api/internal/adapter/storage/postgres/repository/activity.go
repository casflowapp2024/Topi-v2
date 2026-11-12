package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/mappers"
	"context"
	"time"
)

// ActivityRepository implements port.ActivityRepository on user_activity_days
type ActivityRepository struct {
	db *postgres.DB
}

// NewActivityRepository creates a new ActivityRepository instance
func NewActivityRepository(db *postgres.DB) *ActivityRepository {
	return &ActivityRepository{db: db}
}

// MarkActive inserts (user, day); an existing row (or a deleted user) is ignored
func (r *ActivityRepository) MarkActive(ctx context.Context, userID string, day time.Time) error {
	_, err := r.db.Exec(ctx, `INSERT INTO user_activity_days (user_id, day)
SELECT id, $2::date FROM users WHERE id = $1
ON CONFLICT DO NOTHING`, userID, day.Format(time.DateOnly))
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return nil
}

// FounderRepository implements port.FounderRepository on users
type FounderRepository struct {
	db *postgres.DB
}

// NewFounderRepository creates a new FounderRepository instance
func NewFounderRepository(db *postgres.DB) *FounderRepository {
	return &FounderRepository{db: db}
}

// MarkEligible sets founder_eligible = true for the users created before cutoff (never unmarks)
func (r *FounderRepository) MarkEligible(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := r.db.Exec(ctx, `UPDATE users SET founder_eligible = true
WHERE created_at < $1 AND NOT founder_eligible`, cutoff)
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}
	return tag.RowsAffected(), nil
}
