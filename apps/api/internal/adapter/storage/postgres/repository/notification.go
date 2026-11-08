package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// NotificationRepository implements port.NotificationRepository on notification_prefs
type NotificationRepository struct {
	db *postgres.DB
}

// NewNotificationRepository creates a new NotificationRepository instance
func NewNotificationRepository(db *postgres.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// GetPrefs returns the preferences, or the defaults when there is no row
func (r *NotificationRepository) GetPrefs(ctx context.Context, userID string) (domain.NotificationPrefs, error) {
	prefs := domain.DefaultNotificationPrefs()
	err := r.db.QueryRow(ctx, `SELECT email_monthly_summary, email_connection_alerts, email_product_news
FROM notification_prefs WHERE user_id = $1`, userID).Scan(&prefs.MonthlySummary, &prefs.ConnectionAlerts, &prefs.ProductNews)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DefaultNotificationPrefs(), nil
	}
	if err != nil {
		return prefs, mappers.MapPostgresErrorCode(err)
	}
	return prefs, nil
}

// SavePrefs upserts every preference
func (r *NotificationRepository) SavePrefs(ctx context.Context, userID string, prefs domain.NotificationPrefs) error {
	_, err := r.db.Exec(ctx, `INSERT INTO notification_prefs (user_id, email_monthly_summary, email_connection_alerts, email_product_news)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id) DO UPDATE SET
  email_monthly_summary = EXCLUDED.email_monthly_summary,
  email_connection_alerts = EXCLUDED.email_connection_alerts,
  email_product_news = EXCLUDED.email_product_news,
  updated_at = now()`, userID, prefs.MonthlySummary, prefs.ConnectionAlerts, prefs.ProductNews)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return nil
}

// SetPref turns one stream on or off keeping the rest (defaults for a new row)
func (r *NotificationRepository) SetPref(ctx context.Context, userID, kind string, value bool) error {
	var column string
	switch kind {
	case domain.UnsubMonthlySummary:
		column = "email_monthly_summary"
	case domain.UnsubConnectionAlerts:
		column = "email_connection_alerts"
	default:
		return fmt.Errorf("unknown preference %q", kind)
	}

	query := fmt.Sprintf(`INSERT INTO notification_prefs (user_id, %[1]s) VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE SET %[1]s = EXCLUDED.%[1]s, updated_at = now()`, column)
	tag, err := r.db.Exec(ctx, query, userID, value)
	if err != nil {
		mapped := mappers.MapPostgresErrorCode(err)
		// a signed link of a deleted user
		if errors.Is(mapped, domain.ErrUniqueConstraintViolated) { // 23503: foreign key
			return domain.ErrUserNotFoundException
		}
		return mapped
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFoundException
	}
	return nil
}

// MonthlySummaryRecipients lists the users with the summary on, a healthy email and nothing queued yet
func (r *NotificationRepository) MonthlySummaryRecipients(ctx context.Context, month string) ([]domain.MailRecipient, error) {
	rows, err := r.db.Query(ctx, `SELECT u.id, u.email
FROM notification_prefs p
JOIN users u ON u.id = p.user_id
WHERE p.email_monthly_summary AND u.email_status = 'ok'
  AND NOT EXISTS (SELECT 1 FROM email_outbox o WHERE o.dedupe_key = $1 || ':' || u.id || ':' || $2)
ORDER BY u.id`, domain.TemplateMonthlySummary, month)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	var recipients []domain.MailRecipient
	for rows.Next() {
		var rcp domain.MailRecipient
		if err := rows.Scan(&rcp.UserID, &rcp.Email); err != nil {
			return nil, err
		}
		recipients = append(recipients, rcp)
	}
	return recipients, rows.Err()
}

// BaseCurrency returns user_extra.base_currency (COP when the user has no user_extra)
func (r *NotificationRepository) BaseCurrency(ctx context.Context, userID string) (string, error) {
	var currency string
	if err := r.db.QueryRow(ctx, `SELECT user_base_currency($1)`, userID).Scan(&currency); err != nil {
		return "COP", mappers.MapPostgresErrorCode(err)
	}
	return currency, nil
}
