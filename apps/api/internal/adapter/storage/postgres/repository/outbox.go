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
)

// OutboxRepository implements port.OutboxRepository on email_outbox
type OutboxRepository struct {
	db *postgres.DB
}

// NewOutboxRepository creates a new OutboxRepository instance
func NewOutboxRepository(db *postgres.DB) *OutboxRepository {
	return &OutboxRepository{db: db}
}

const outboxColumns = `o.id, o.user_id, o.to_email, o.template, o.payload, o.priority, o.status, o.has_secret,
o.attempts, o.send_after, o.dedupe_key, o.provider_id, o.last_error, o.created_at, o.sent_at`

// Enqueue inserts a pending email; a used dedupe key returns (0, false, nil)
func (r *OutboxRepository) Enqueue(ctx context.Context, email domain.OutboxEmail) (int64, bool, error) {
	sql, args, err := r.db.QueryBuilder.Insert(enums.EmailOutboxTable).
		Columns("user_id", "to_email", "template", "payload", "priority", "send_after", "dedupe_key").
		Values(email.UserID, email.To, email.Template, string(email.Payload), email.Priority, email.SendAfter, email.DedupeKey).
		Suffix("ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id").
		ToSql()
	if err != nil {
		return 0, false, err
	}

	var id int64
	err = r.db.QueryRow(ctx, sql, args...).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, mappers.MapPostgresErrorCode(err)
	}

	return id, true, nil
}

// InsertSending inserts an email already claimed by the caller (sent right away)
func (r *OutboxRepository) InsertSending(ctx context.Context, email domain.OutboxEmail) (int64, error) {
	sql, args, err := r.db.QueryBuilder.Insert(enums.EmailOutboxTable).
		Columns("user_id", "to_email", "template", "payload", "priority", "status", "has_secret", "attempts", "locked_at").
		Values(email.UserID, email.To, email.Template, string(email.Payload), email.Priority, domain.OutboxSending,
			email.HasSecret, 1, sq.Expr("now()")).
		Suffix("RETURNING id").
		ToSql()
	if err != nil {
		return 0, err
	}

	var id int64
	if err = r.db.QueryRow(ctx, sql, args...).Scan(&id); err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}

	return id, nil
}

// Claim marks as sending a batch of ready emails (SKIP LOCKED) and returns them with the recipient status
func (r *OutboxRepository) Claim(ctx context.Context, minPriority, maxPriority int16, limit int, staleAfter time.Duration) ([]domain.OutboxEmail, error) {
	if limit <= 0 {
		return nil, nil
	}

	const query = `
WITH ready AS (
  SELECT id FROM email_outbox
  WHERE priority BETWEEN $1 AND $2
    AND ((status = 'pending' AND send_after <= now())
      OR (status = 'sending' AND NOT has_secret AND locked_at < now() - make_interval(secs => $3)))
  ORDER BY priority, send_after, id
  LIMIT $4
  FOR UPDATE SKIP LOCKED
), claimed AS (
  UPDATE email_outbox o SET status = 'sending', locked_at = now(), attempts = o.attempts + 1
  FROM ready WHERE o.id = ready.id
  RETURNING o.*
)
SELECT ` + outboxColumns + `, COALESCE(u.email_status, 'ok')
FROM claimed o LEFT JOIN users u ON u.id = o.user_id
ORDER BY o.priority, o.send_after, o.id`

	rows, err := r.db.Query(ctx, query, minPriority, maxPriority, staleAfter.Seconds(), limit)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	var emails []domain.OutboxEmail
	for rows.Next() {
		var e domain.OutboxEmail
		var payload []byte
		if err := rows.Scan(&e.ID, &e.UserID, &e.To, &e.Template, &payload, &e.Priority, &e.Status, &e.HasSecret,
			&e.Attempts, &e.SendAfter, &e.DedupeKey, &e.ProviderID, &e.LastError, &e.CreatedAt, &e.SentAt,
			&e.RecipientStatus); err != nil {
			return nil, err
		}
		e.Payload = payload
		emails = append(emails, e)
	}

	return emails, rows.Err()
}

// FailStaleSecrets fails the emails with a secret stuck in sending
func (r *OutboxRepository) FailStaleSecrets(ctx context.Context, staleAfter time.Duration) (int64, error) {
	tag, err := r.db.Exec(ctx, `UPDATE email_outbox SET status = 'failed', last_error = 'interrupted while sending'
WHERE status = 'sending' AND has_secret AND locked_at < now() - make_interval(secs => $1)`, staleAfter.Seconds())
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}
	return tag.RowsAffected(), nil
}

// MarkSent records the provider id
func (r *OutboxRepository) MarkSent(ctx context.Context, id int64, providerID string) error {
	var provider *string
	if providerID != "" {
		provider = &providerID
	}
	return r.update(ctx, id, sq.Eq{
		"status": domain.OutboxSent, "provider_id": provider, "sent_at": sq.Expr("now()"), "last_error": nil,
	})
}

// MarkRetry puts the email back to pending
func (r *OutboxRepository) MarkRetry(ctx context.Context, id int64, lastError string, sendAfter time.Time) error {
	return r.update(ctx, id, sq.Eq{
		"status": domain.OutboxPending, "last_error": lastError, "send_after": sendAfter, "locked_at": nil,
	})
}

// MarkFailed gives up on the email
func (r *OutboxRepository) MarkFailed(ctx context.Context, id int64, lastError string) error {
	return r.update(ctx, id, sq.Eq{"status": domain.OutboxFailed, "last_error": lastError})
}

// MarkSuppressed records why the email was not sent
func (r *OutboxRepository) MarkSuppressed(ctx context.Context, id int64, reason string) error {
	return r.update(ctx, id, sq.Eq{"status": domain.OutboxSuppressed, "last_error": reason})
}

func (r *OutboxRepository) update(ctx context.Context, id int64, values sq.Eq) error {
	sql, args, err := r.db.QueryBuilder.Update(enums.EmailOutboxTable).
		SetMap(values).
		Where(sq.Eq{"id": id}).
		ToSql()
	if err != nil {
		return err
	}
	if _, err = r.db.Exec(ctx, sql, args...); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return nil
}

// CountSentSince counts the sent emails and the ones being sent since the instant
func (r *OutboxRepository) CountSentSince(ctx context.Context, since time.Time) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM email_outbox
WHERE (status = 'sent' AND sent_at >= $1) OR status = 'sending'`, since).Scan(&count)
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}
	return count, nil
}

// RecipientStatus returns users.email_status (ok when the user does not exist)
func (r *OutboxRepository) RecipientStatus(ctx context.Context, userID string) (string, error) {
	var status string
	err := r.db.QueryRow(ctx, `SELECT email_status FROM users WHERE id = $1`, userID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.EmailStatusOK, nil
	}
	if err != nil {
		return domain.EmailStatusOK, mappers.MapPostgresErrorCode(err)
	}
	return status, nil
}

// SetRecipientStatus marks the user of a bounced or complained email
func (r *OutboxRepository) SetRecipientStatus(ctx context.Context, providerID string, to []string, status string) (int64, error) {
	lowered := make([]string, 0, len(to))
	for _, address := range to {
		lowered = append(lowered, domain.NormalizeEmail(address))
	}

	tag, err := r.db.Exec(ctx, `UPDATE users SET email_status = $3, updated_at = now()
WHERE (id IN (SELECT user_id FROM email_outbox WHERE provider_id = $1 AND $1 <> '' AND user_id IS NOT NULL)
       OR lower(email) = ANY($2::text[]))
  AND email_status <> $3
  AND NOT (email_status = 'complained' AND $3 = 'bounced')`, providerID, lowered, status)
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}
	return tag.RowsAffected(), nil
}
