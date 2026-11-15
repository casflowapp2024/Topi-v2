package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"time"
)

// FeedbackRepository implements port.FeedbackRepository on feedback (plan/27 §E)
type FeedbackRepository struct {
	db *postgres.DB
}

// NewFeedbackRepository creates a new FeedbackRepository instance
func NewFeedbackRepository(db *postgres.DB) *FeedbackRepository {
	return &FeedbackRepository{db: db}
}

// Create inserts the opinion
func (r *FeedbackRepository) Create(ctx context.Context, f *domain.Feedback) error {
	var version *string
	if f.AppVersion != "" {
		version = &f.AppVersion
	}
	err := r.db.QueryRow(ctx, `INSERT INTO feedback (user_id, text, contact_ok, app_version) VALUES ($1, $2, $3, $4)
RETURNING id, created_at`, f.UserID, f.Text, f.ContactOK, version).Scan(&f.ID, &f.CreatedAt)
	return mappers.MapPostgresErrorCode(err)
}

// CountSince counts the opinions of a user since an instant (daily limit)
func (r *FeedbackRepository) CountSince(ctx context.Context, userID string, since time.Time) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM feedback WHERE user_id = $1 AND created_at >= $2`, userID, since).Scan(&n)
	return n, mappers.MapPostgresErrorCode(err)
}

// List returns the newest opinions (only the short user id, never a name or email)
func (r *FeedbackRepository) List(ctx context.Context, unreadOnly bool, limit int) ([]domain.Feedback, error) {
	rows, err := r.db.Query(ctx, `SELECT id, user_id, text, contact_ok, coalesce(app_version, ''), created_at, read_at
FROM feedback WHERE (NOT $1 OR read_at IS NULL) ORDER BY created_at DESC LIMIT $2`, unreadOnly, limit)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	items := []domain.Feedback{}
	for rows.Next() {
		var f domain.Feedback
		if err = rows.Scan(&f.ID, &f.UserID, &f.Text, &f.ContactOK, &f.AppVersion, &f.CreatedAt, &f.ReadAt); err != nil {
			return nil, err
		}
		f.ShortUser = domain.ShortUserID(f.UserID)
		items = append(items, f)
	}
	return items, rows.Err()
}

// CountUnread counts the opinions nobody read yet
func (r *FeedbackRepository) CountUnread(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM feedback WHERE read_at IS NULL`).Scan(&n)
	return n, mappers.MapPostgresErrorCode(err)
}

// MarkRead marks one opinion as read (idempotent; unknown id = not found)
func (r *FeedbackRepository) MarkRead(ctx context.Context, id uint64) error {
	result, err := r.db.Exec(ctx, `UPDATE feedback SET read_at = coalesce(read_at, now()) WHERE id = $1`, id)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}
	return nil
}
