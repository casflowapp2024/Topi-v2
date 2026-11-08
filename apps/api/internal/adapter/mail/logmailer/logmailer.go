// Package logmailer implements port.Mailer without sending anything: it writes the email to the log.
// It is the default (MAIL_PROVIDER=log) for local and development.
package logmailer

import (
	"cash-flow/internal/core/domain"
	"context"
	"fmt"
	"log/slog"
	"sync/atomic"
)

// Mailer logs the emails instead of sending them
type Mailer struct {
	seq atomic.Int64
	// LogBody also logs the text body (local only: it may contain a code)
	LogBody bool
}

// New creates a log mailer
func New(logBody bool) *Mailer {
	return &Mailer{LogBody: logBody}
}

// Send writes the email to the log and returns a fake provider id
func (m *Mailer) Send(_ context.Context, msg domain.EmailMessage) (string, error) {
	id := fmt.Sprintf("log-%d", m.seq.Add(1))

	attrs := []any{"provider_id", id, "to", msg.To, "subject", msg.Subject, "template", msg.Tags["template"]}
	if m.LogBody {
		attrs = append(attrs, "text", msg.Text)
	}
	slog.Info("mail (log, not sent)", attrs...)

	return id, nil
}
