// Package logmailer implements port.Mailer without sending anything: it writes the email to the log.
// It is the default (MAIL_PROVIDER=log) for local and development.
package logmailer

import (
	"cash-flow/internal/core/domain"
	"context"
	"fmt"
	"github.com/google/uuid"
	"log/slog"
	"strings"
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
	// unique across restarts: a counter alone repeated "log-1" and clashed with email_outbox.provider_id (plan/30)
	id := fmt.Sprintf("log-%d-%s", m.seq.Add(1), uuid.NewString()[:8])

	// outside local the address is masked: no emails in the logs (plan/27)
	to := MaskAddress(msg.To)
	if m.LogBody {
		to = msg.To
	}
	attrs := []any{"provider_id", id, "to", to, "subject", msg.Subject, "template", msg.Tags["template"]}
	if m.LogBody {
		attrs = append(attrs, "text", msg.Text)
	}
	slog.Info("mail (log, not sent)", attrs...)

	return id, nil
}

// MaskAddress keeps the first letter and the domain: "a***@example.com"
func MaskAddress(address string) string {
	local, domain, ok := strings.Cut(address, "@")
	if !ok || local == "" {
		return "***"
	}
	return string([]rune(local)[0]) + "***@" + domain
}
