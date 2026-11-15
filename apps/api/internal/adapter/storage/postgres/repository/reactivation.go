package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ReactivationRepository reads what decides a personal reactivation email (plan/27 §G)
type ReactivationRepository struct {
	db *postgres.DB
}

// NewReactivationRepository creates a new ReactivationRepository instance
func NewReactivationRepository(db *postgres.DB) *ReactivationRepository {
	return &ReactivationRepository{db: db}
}

// Target: the person, its suppression and preference, founder, a connection down and the last personal email
func (r *ReactivationRepository) Target(ctx context.Context, userID string) (*domain.ReactivationTarget, error) {
	var t domain.ReactivationTarget
	err := r.db.QueryRow(ctx, `SELECT u.id, u.email,
  trim(coalesce(nullif(u.name, ''), (SELECT ue.name FROM user_extra ue WHERE ue.user_id = u.id ORDER BY ue.id LIMIT 1), '')),
  coalesce(u.email_status, ''),
  coalesce((SELECT p.email_personal FROM notification_prefs p WHERE p.user_id = u.id), true),
  u.founder_eligible OR u.founder_confirmed_at IS NOT NULL,
  EXISTS (SELECT 1 FROM emails e WHERE e.user_id = u.id AND coalesce(e.error, '') <> ''),
  (SELECT max(o.created_at) FROM email_outbox o
     WHERE o.user_id = u.id AND o.template = 'reactivation_personal' AND o.status NOT IN ('failed', 'suppressed'))
FROM users u WHERE u.id = $1`, userID).Scan(&t.UserID, &t.Email, &t.Name, &t.EmailStatus, &t.PersonalAllowed,
		&t.Founder, &t.ConnectionDown, &t.LastSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrDataNotFound
	}
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	return &t, nil
}

// SentSince counts the personal emails queued since an instant (daily limit, everyone together)
func (r *ReactivationRepository) SentSince(ctx context.Context, since time.Time) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM email_outbox
WHERE template = 'reactivation_personal' AND created_at >= $1 AND status NOT IN ('failed', 'suppressed')`, since).Scan(&n)
	return n, mappers.MapPostgresErrorCode(err)
}
