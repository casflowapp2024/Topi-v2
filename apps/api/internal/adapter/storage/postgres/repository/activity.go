package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
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

// founderActivity: per eligible user, whether it opened the app in $1 days (app) or has a healthy connection
// with automatic transactions created in $1 days (reading)
const founderActivity = `
SELECT u.id, trim(u.name || ' ' || u.last_name) AS name, u.email, s.signup_at,
  (SELECT max(a.day)::text FROM user_activity_days a WHERE a.user_id = u.id) AS last_day,
  EXISTS (SELECT 1 FROM user_activity_days a WHERE a.user_id = u.id
          AND a.day >= (now() AT TIME ZONE 'America/Bogota')::date - $1::int) AS by_app,
  (EXISTS (SELECT 1 FROM emails e WHERE e.user_id = u.id AND e.active AND e.error IS NULL)
   AND EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.automated
               AND t.created_at >= now() - make_interval(days => $1::int))) AS by_reading,
  u.founder_confirmed_at
FROM users u
JOIN admin_user_signup s ON s.user_id = u.id
WHERE u.founder_eligible`

// List returns the eligible users split in active and without activity
func (r *FounderRepository) List(ctx context.Context, activeDays int) (domain.FounderList, error) {
	list := domain.FounderList{Active: []domain.FounderRow{}, Inactive: []domain.FounderRow{}}
	rows, err := r.db.Query(ctx, founderActivity+` ORDER BY u.founder_confirmed_at NULLS FIRST, s.signup_at`, activeDays)
	if err != nil {
		return list, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var row domain.FounderRow
		var byApp, byReading bool
		if err = rows.Scan(&row.ID, &row.Name, &row.Email, &row.SignupAt, &row.LastActiveDay, &byApp, &byReading,
			&row.ConfirmedAt); err != nil {
			return list, err
		}
		row.ActiveBy = []string{}
		if byApp {
			row.ActiveBy = append(row.ActiveBy, "app")
		}
		if byReading {
			row.ActiveBy = append(row.ActiveBy, "reading")
		}
		row.Active = byApp || byReading
		list.Eligible++
		if row.ConfirmedAt != nil {
			list.Confirmed++
		}
		if row.Active {
			list.Active = append(list.Active, row)
		} else {
			list.Inactive = append(list.Inactive, row)
		}
	}
	return list, rows.Err()
}

// ConfirmActive confirms the active eligible users not confirmed yet. The update and its audit row go in one
// statement: there is no confirmation without audit.
func (r *FounderRepository) ConfirmActive(ctx context.Context, adminID string, activeDays int, dryRun bool) (domain.FounderBulkResult, error) {
	result := domain.FounderBulkResult{DryRun: dryRun}
	err := r.db.QueryRow(ctx, `WITH f AS (`+founderActivity+`)
SELECT count(*) FILTER (WHERE (by_app OR by_reading) AND founder_confirmed_at IS NULL),
       count(*) FILTER (WHERE founder_confirmed_at IS NOT NULL),
       count(*) FILTER (WHERE NOT (by_app OR by_reading) AND founder_confirmed_at IS NULL)
FROM f`, activeDays).Scan(&result.ToConfirm, &result.AlreadyConfirmed, &result.Inactive)
	if err != nil || dryRun {
		return result, mappers.MapPostgresErrorCode(err)
	}

	err = r.db.QueryRow(ctx, `WITH f AS (`+founderActivity+`),
upd AS (
  UPDATE users u SET founder_confirmed_at = now(), founder_confirmed_by = $2
  FROM f WHERE u.id = f.id AND (f.by_app OR f.by_reading) AND u.founder_confirmed_at IS NULL AND u.founder_eligible
  RETURNING u.id
),
audit AS (
  INSERT INTO admin_audit (admin_id, action, target, detail)
  SELECT $2, 'founder_confirm_active', NULL, jsonb_build_object('confirmed', count(*), 'active_days', $1::int) FROM upd
)
SELECT count(*) FROM upd`, activeDays, adminID).Scan(&result.Confirmed)
	if err != nil {
		return result, mappers.MapPostgresErrorCode(err)
	}
	result.ToConfirm = 0
	result.AlreadyConfirmed += result.Confirmed
	return result, nil
}

// SetConfirmed confirms or unconfirms one eligible user with its audit row in the same statement
func (r *FounderRepository) SetConfirmed(ctx context.Context, adminID, userID string, confirmed bool) error {
	action := domain.AdminActionFounderUnconfirm
	if confirmed {
		action = domain.AdminActionFounderConfirm
	}
	var changed int
	err := r.db.QueryRow(ctx, `WITH target AS (
  SELECT id FROM users WHERE id = $1 AND founder_eligible
),
upd AS (
  UPDATE users u SET
    founder_confirmed_at = CASE WHEN $3 THEN COALESCE(u.founder_confirmed_at, now()) ELSE NULL END,
    founder_confirmed_by = CASE WHEN $3 THEN COALESCE(u.founder_confirmed_by, $2) ELSE NULL END
  FROM target WHERE u.id = target.id
  RETURNING u.id
),
audit AS (
  INSERT INTO admin_audit (admin_id, action, target) SELECT $2, $4, id FROM upd
)
SELECT count(*) FROM upd`, userID, adminID, confirmed, action).Scan(&changed)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if changed == 0 {
		return domain.ErrNotFounderEligible
	}
	return nil
}
