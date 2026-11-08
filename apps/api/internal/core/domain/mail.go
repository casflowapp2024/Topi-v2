package domain

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Outbox statuses (email_outbox.status)
const (
	OutboxPending    = "pending"
	OutboxSending    = "sending"
	OutboxSent       = "sent"
	OutboxFailed     = "failed"
	OutboxSuppressed = "suppressed"
)

// Recipient statuses (users.email_status)
const (
	EmailStatusOK         = "ok"
	EmailStatusBounced    = "bounced"
	EmailStatusComplained = "complained"
)

// Outbox priorities: 1 = transactional (first and with reserved quota)
const (
	MailPriorityTransactional int16 = 1
	MailPriorityNotification  int16 = 3
	MailPriorityBulk          int16 = 5
)

// Mail templates (adapter/mail/templates/<name>.{html,txt})
const (
	TemplatePasswordCode   = "password_code"
	TemplateVerifyEmail    = "verify_email"
	TemplateConnectionDown = "connection_down"
	TemplateMonthlySummary = "monthly_summary"
	TemplateBillingGeneric = "billing_generic"
)

// ErrMailRejected wraps provider errors that will not succeed on retry (invalid recipient, etc.)
var ErrMailRejected = errors.New("email rejected by the provider")

// ErrMailNotAllowed is returned when MAIL_ONLY_TO does not include the recipient
var ErrMailNotAllowed = errors.New("recipient not allowed by MAIL_ONLY_TO")

// IsTransactionalTemplate reports whether the template is sent because the user asked for it
// (no unsubscribe link). The rest carry List-Unsubscribe.
func IsTransactionalTemplate(template string) bool {
	switch template {
	case TemplatePasswordCode, TemplateVerifyEmail, TemplateBillingGeneric:
		return true
	}
	return false
}

// IgnoresSuppression reports whether the template is sent even to a bounced/complained address:
// only the password code, because the user is asking for it right now.
func IgnoresSuppression(template string) bool {
	return template == TemplatePasswordCode
}

// EmailMessage is a rendered email ready for a Mailer
type EmailMessage struct {
	To      string
	From    string
	ReplyTo string
	Subject string
	HTML    string
	Text    string
	Headers map[string]string
	// Tags help to find the email in the provider (template name, outbox id). Never personal data.
	Tags map[string]string
}

// RenderedEmail is the output of a template: subject and bodies
type RenderedEmail struct {
	Subject string
	HTML    string
	Text    string
}

// OutboxEmail is a row of email_outbox
type OutboxEmail struct {
	ID         int64
	UserID     *string
	To         string
	Template   string
	Payload    json.RawMessage
	Priority   int16
	Status     string
	HasSecret  bool
	Attempts   int
	SendAfter  time.Time
	DedupeKey  *string
	ProviderID *string
	LastError  *string
	CreatedAt  time.Time
	SentAt     *time.Time
	// RecipientStatus is users.email_status of UserID (ok when there is no user)
	RecipientStatus string
}

// ConnectionAlertCooldown: at most one "reconnect your email" alert per connection in this window
const ConnectionAlertCooldown = 7 * 24 * time.Hour

// ConnectionAlert is who to tell that a mail connection stopped working
type ConnectionAlert struct {
	UserID          string
	UserEmail       string
	ConnectionEmail string
	Provider        string
}

// ProviderLabel is the name shown to the user
func ProviderLabel(provider string) string {
	switch strings.ToLower(provider) {
	case "gmail":
		return "Gmail"
	case "outlook":
		return "Outlook"
	}
	return provider
}
