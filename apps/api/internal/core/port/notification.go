package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=notification.go -destination=mock/notification.go -package=mock

// NotificationRepository persists the email preferences (notification_prefs)
type NotificationRepository interface {
	// GetPrefs returns the preferences (defaults when the user has no row)
	GetPrefs(ctx context.Context, userID string) (domain.NotificationPrefs, error)
	SavePrefs(ctx context.Context, userID string, prefs domain.NotificationPrefs) error
	// SetPref turns one stream on or off (domain.Unsub* kinds)
	SetPref(ctx context.Context, userID, kind string, value bool) error
	// MonthlySummaryRecipients lists the users with the summary on, email ok, and without one
	// already queued for the month (dedupe key)
	MonthlySummaryRecipients(ctx context.Context, month string) ([]domain.MailRecipient, error)
	// BaseCurrency returns user_extra.base_currency (COP by default)
	BaseCurrency(ctx context.Context, userID string) (string, error)
}

// NotificationService manages the email preferences, the unsubscribe links and the monthly summary
type NotificationService interface {
	GetPrefs(ctx context.Context, userID string) (domain.NotificationPrefs, error)
	UpdatePrefs(ctx context.Context, userID string, prefs domain.NotificationPrefs) (domain.NotificationPrefs, error)
	// Unsubscribe applies a signed link and returns the kind turned off
	Unsubscribe(ctx context.Context, token string) (string, error)
	// CheckUnsubscribe validates a link without applying it and returns its kind
	CheckUnsubscribe(token string) (string, error)
	// UnsubscribeURL builds the signed one-click link of a template (List-Unsubscribe)
	UnsubscribeURL(userID, template string) string
	// ScheduleMonthlySummaries queues the summary of the previous month during the first days
	ScheduleMonthlySummaries(ctx context.Context, now time.Time) (int, error)
	// RunScheduler calls ScheduleMonthlySummaries every interval until ctx ends
	RunScheduler(ctx context.Context, interval time.Duration)
}
