package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=mail.go -destination=mock/mail.go -package=mock

// Mailer sends one rendered email through a provider (Resend) or the log (local)
type Mailer interface {
	// Send returns the provider id of the email
	Send(ctx context.Context, msg domain.EmailMessage) (string, error)
}

// MailRenderer renders a template with its data (subject, HTML and text)
type MailRenderer interface {
	Render(template string, data map[string]any) (*domain.RenderedEmail, error)
}

// OutboxRepository persists email_outbox
type OutboxRepository interface {
	// Enqueue inserts a pending email. With a dedupe key already used it returns (0, false, nil).
	Enqueue(ctx context.Context, email domain.OutboxEmail) (int64, bool, error)
	// InsertSending inserts an email already claimed (status sending, attempts 1): the caller sends it now
	InsertSending(ctx context.Context, email domain.OutboxEmail) (int64, error)
	// Claim marks as sending up to limit ready emails with priority in [minPriority, maxPriority]
	// (pending and due, or sending without a secret whose lock is older than staleAfter),
	// ordered by priority and send_after, with FOR UPDATE SKIP LOCKED.
	Claim(ctx context.Context, minPriority, maxPriority int16, limit int, staleAfter time.Duration) ([]domain.OutboxEmail, error)
	// FailStaleSecrets marks as failed the emails with a secret stuck in sending (they cannot be rebuilt)
	FailStaleSecrets(ctx context.Context, staleAfter time.Duration) (int64, error)
	MarkSent(ctx context.Context, id int64, providerID string) error
	MarkRetry(ctx context.Context, id int64, lastError string, sendAfter time.Time) error
	MarkFailed(ctx context.Context, id int64, lastError string) error
	MarkSuppressed(ctx context.Context, id int64, reason string) error
	// CountSentSince counts the emails sent (or being sent) since the instant (daily quota)
	CountSentSince(ctx context.Context, since time.Time) (int, error)
	// RecipientStatus returns users.email_status (ok if the user does not exist)
	RecipientStatus(ctx context.Context, userID string) (string, error)
}

// MailService enqueues and sends emails
type MailService interface {
	// Enqueue renders later (payload without sensitive data)
	Enqueue(ctx context.Context, email domain.OutboxEmail) (int64, error)
	// SendSecret sends now an email whose data carries a secret (a code): it is recorded in the
	// outbox without the secret and is not retried. It does not block: the send runs in background.
	SendSecret(ctx context.Context, email domain.OutboxEmail, secret map[string]any) error
	// ProcessOnce sends a batch respecting the daily quota; returns how many were processed
	ProcessOnce(ctx context.Context) (int, error)
	// Run calls ProcessOnce every interval until ctx ends
	Run(ctx context.Context, interval time.Duration)
}
