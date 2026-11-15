package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type EmailRepository struct {
	db *postgres.DB
}

func NewEmailRepository(db *postgres.DB) *EmailRepository {
	return &EmailRepository{
		db: db,
	}
}

// RegisterEmail stores a connection or, if the user already has that address, authorizes it again: new tokens,
// active, error cleared and its open incident closed as reconnected (email.Reconnected = it was down).
// Explicit columns: RETURNING * broke the scan every time emails got a new column.
func (e *EmailRepository) RegisterEmail(ctx context.Context, email *domain.Email) error {
	const query = `
WITH prev AS (
  SELECT id, error FROM emails WHERE user_id = $1 AND email = $2
),
up AS (
  INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, active, provider)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (user_id, email) DO UPDATE SET
    access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
    token_type = EXCLUDED.token_type, active = EXCLUDED.active, provider = EXCLUDED.provider,
    error = NULL, error_at = NULL, updated_at = now()
  RETURNING id, user_id, email, access_token, refresh_token, token_type, active, created_at, updated_at, provider, error
),
closed AS (
  UPDATE connection_incidents SET resolved_at = now(), resolution = 'reconnected'
  WHERE email_id = (SELECT id FROM up) AND resolved_at IS NULL
  RETURNING id
)
SELECT up.id, up.user_id, up.email, up.access_token, up.refresh_token, up.token_type, up.active,
       up.created_at, up.updated_at, up.provider, up.error,
       coalesce((SELECT error FROM prev), '') <> '' OR EXISTS (SELECT 1 FROM closed) AS reconnected
FROM up`

	err := e.db.QueryRow(ctx, query, email.UserID, email.Email, email.Token.Access, email.Token.Refresh,
		email.Token.Type, email.Active, email.Provider).Scan(
		&email.ID,
		&email.UserID,
		&email.Email,
		&email.Token.Access,
		&email.Token.Refresh,
		&email.Token.Type,
		&email.Active,
		&email.CreatedAt,
		&email.UpdatedAt,
		&email.Provider,
		&email.Error,
		&email.Reconnected,
	)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (e *EmailRepository) GetEmail(
	ctx context.Context,
	userID string,
	id uint64,
	isActive *bool,
) (*domain.Email, error) {
	var email domain.Email

	query := e.db.QueryBuilder.Select(
		"id",
		"user_id",
		"email",
		"access_token",
		"refresh_token",
		"token_type",
		"active",
		"provider",
		"error",
		"error_at",
	).From(enums.EmailTableName).
		Where(sq.Eq{"user_id": userID}).
		Where(sq.Eq{"id": id}).
		Limit(1)

	if isActive != nil {
		query = query.Where(sq.Eq{"active": *isActive})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = e.db.QueryRow(ctx, sql, args...).Scan(
		&email.ID,
		&email.UserID,
		&email.Email,
		&email.Token.Access,
		&email.Token.Refresh,
		&email.Token.Type,
		&email.Active,
		&email.Provider,
		&email.Error,
		&email.ErrorAt,
	)

	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &email, nil
}

func (e *EmailRepository) ListEmails(
	ctx context.Context,
	userID string,
	skip uint64,
	limit uint64,
) ([]domain.Email, error) {
	query := e.db.QueryBuilder.Select(
		"id",
		"user_id",
		"email",
		"access_token",
		"refresh_token",
		"token_type",
		"active",
		"provider",
		"error",
		"error_at",
		// the user's connections only (it used to count every user's)
		"count(*) OVER () AS total",
	).From(enums.EmailTableName).
		Where(sq.Eq{"user_id": userID}).
		OrderBy("id").
		Limit(limit).
		Offset(skip)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := e.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	var emails []domain.Email
	for rows.Next() {
		var email domain.Email

		err = rows.Scan(
			&email.ID,
			&email.UserID,
			&email.Email,
			&email.Token.Access,
			&email.Token.Refresh,
			&email.Token.Type,
			&email.Active,
			&email.Provider,
			&email.Error,
			&email.ErrorAt,
			&email.Total,
		)
		if err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}

		emails = append(emails, email)
	}

	return emails, nil
}

func (e *EmailRepository) UpdateEmail(ctx context.Context, email *domain.Email) error {
	query := e.db.QueryBuilder.Update(enums.EmailTableName).
		Set("active", email.Active).
		Where(sq.Eq{"user_id": email.UserID}).
		Where(sq.Eq{"id": email.ID})

	if email.Verify {
		query = query.Set("error", (*string)(nil)).Set("error_at", nil)
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	result, err := e.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	if email.Verify && email.ID != nil {
		if err = e.closeIncident(ctx, e.db, *email.ID, "reconnected"); err != nil {
			return err
		}
	}

	return nil
}

// execer is what closeIncident needs from the pool or a transaction
type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// closeIncident closes the open incident of a connection (if any)
func (e *EmailRepository) closeIncident(ctx context.Context, db execer, emailID uint64, resolution string) error {
	_, err := db.Exec(ctx, `UPDATE connection_incidents SET resolved_at = now(), resolution = $2
WHERE email_id = $1 AND resolved_at IS NULL`, emailID, resolution)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return nil
}

// SaveEmailError marks a connection down (error_at keeps the first moment, an incident opens once) or, with an
// empty code, healthy again (closes the incident as reconnected).
func (e *EmailRepository) SaveEmailError(ctx context.Context, emailID uint64, errorMsg string) error {
	if errorMsg == "" {
		result, err := e.db.Exec(ctx, `UPDATE emails SET error = '', error_at = NULL WHERE id = $1`, emailID)
		if err != nil {
			return mappers.MapPostgresErrorCode(err)
		}
		if result.RowsAffected() == 0 {
			return domain.ErrDataNotFound
		}
		return e.closeIncident(ctx, e.db, emailID, "reconnected")
	}

	const query = `
WITH up AS (
  UPDATE emails SET error = $2, error_at = coalesce(error_at, now())
  WHERE id = $1
  RETURNING id, user_id, provider, error_at
),
opened AS (
  INSERT INTO connection_incidents (email_id, user_id, provider, error_code, started_at)
  SELECT id, user_id, provider, $2, error_at FROM up
  ON CONFLICT (email_id) WHERE resolved_at IS NULL DO NOTHING
  RETURNING id
)
SELECT count(*) FROM up`

	var updated int
	if err := e.db.QueryRow(ctx, query, emailID, errorMsg).Scan(&updated); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if updated == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}

// ClaimConnectionAlert sets emails.alert_sent_at if an alert is due and returns who to tell
func (e *EmailRepository) ClaimConnectionAlert(ctx context.Context, emailID uint64, cooldown time.Duration) (*domain.ConnectionAlert, bool, error) {
	const query = `
UPDATE emails e SET alert_sent_at = now()
FROM users u
WHERE e.id = $1 AND u.id = e.user_id
  AND e.error IS NOT NULL AND e.error <> ''
  AND (e.alert_sent_at IS NULL OR e.alert_sent_at < now() - make_interval(secs => $2))
  AND COALESCE((SELECT p.email_connection_alerts FROM notification_prefs p WHERE p.user_id = e.user_id), true)
RETURNING e.user_id, u.email, e.email, e.provider`

	var alert domain.ConnectionAlert
	err := e.db.QueryRow(ctx, query, emailID, cooldown.Seconds()).Scan(
		&alert.UserID, &alert.UserEmail, &alert.ConnectionEmail, &alert.Provider)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, mappers.MapPostgresErrorCode(err)
	}

	return &alert, true, nil
}

func (e *EmailRepository) DeleteEmailTrx(ctx context.Context, tx pgx.Tx, userID string, id uint64) error {
	if _, err := tx.Exec(ctx, `UPDATE connection_incidents SET resolved_at = now(), resolution = 'deleted'
WHERE email_id = $1 AND user_id = $2 AND resolved_at IS NULL`, id, userID); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	deleteQuery := e.db.QueryBuilder.Delete(enums.EmailTableName).
		Where(sq.Eq{"user_id": userID}).
		Where(sq.Eq{"id": id})

	deleteSQL, deleteArgs, err := deleteQuery.ToSql()
	if err != nil {
		return err
	}

	result, err := tx.Exec(ctx, deleteSQL, deleteArgs...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}
