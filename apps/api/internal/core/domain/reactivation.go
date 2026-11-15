package domain

import (
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// Personal reactivation (plan/27 §G): JuanMa writes, one person at a time, from the admin panel, with a preview.
// Never bulk. The outbox keeps only the text the team wrote (with {nombre}); the name is filled when sending.

const (
	// TemplateReactivation is the personal email
	TemplateReactivation = "reactivation_personal"
	// ReactivationCooldown: never twice to the same person within this window
	ReactivationCooldown = 90 * 24 * time.Hour
	// ReactivationNamePlaceholder is replaced by the first name when sending
	ReactivationNamePlaceholder = "{nombre}"

	reactivationMaxSubject = 120
	reactivationMaxBody    = 3000
)

// DefaultReactivationSubject and DefaultReactivationBody are the starting text (editable before sending)
const DefaultReactivationSubject = "Rehicimos Topi: ¿qué te hizo dejarla?"

const DefaultReactivationBody = `Hola {nombre},

Soy JuanMa, de Topi. Te escribo porque estuviste con nosotros desde el principio y quería contarte que rehicimos Topi desde cero: ahora lee las notificaciones de tus bancos y arma tus finanzas sin que digites nada, y si deja de leer tu correo te avisa para reconectarlo en un toque.

Me ayudaría mucho saber: ¿qué te hizo dejar de usarla? Puedes responder este correo, lo leo yo.

Gracias por haber confiado en Topi tan temprano.

JuanMa`

// Reasons why the panel cannot write to someone (the button is disabled with this reason)
const (
	ReactivationOK             = ""
	ReactivationSuppressed     = "suppressed"      // bounced or complained
	ReactivationUnsubscribed   = "unsubscribed"    // used the unsubscribe link of a personal email
	ReactivationRecent         = "recent"          // already written in the last 90 days
	ReactivationConnectionDown = "connection_down" // would land in an app that does not work for them (until §D is live)
	ReactivationDailyLimit     = "daily_limit"     // REACTIVATION_DAILY_LIMIT reached today
)

var (
	// ErrReactivationNotAllowed: the person cannot be written to now (the reason is in the draft)
	ErrReactivationNotAllowed = errors.New("reactivation not allowed for this user now")
	// ErrInvalidReactivation: empty, too long, or with the person's name/email typed in (use {nombre})
	ErrInvalidReactivation = errors.New("reactivation text is invalid: use {nombre} instead of the name")
)

// ReactivationTarget is what decides whether and how to write to one user
type ReactivationTarget struct {
	UserID          string
	Email           string
	Name            string
	EmailStatus     string
	PersonalAllowed bool
	Founder         bool
	ConnectionDown  bool
	LastSentAt      *time.Time
}

// ReactivationRules are the launch settings
type ReactivationRules struct {
	DailyLimit  int
	AllowBroken bool
}

// Reason returns why this person cannot be written to now ("" = allowed)
func (t ReactivationTarget) Reason(now time.Time, sentToday int, rules ReactivationRules) string {
	switch {
	case t.EmailStatus == EmailStatusBounced || t.EmailStatus == EmailStatusComplained:
		return ReactivationSuppressed
	case !t.PersonalAllowed:
		return ReactivationUnsubscribed
	case t.LastSentAt != nil && now.Sub(*t.LastSentAt) < ReactivationCooldown:
		return ReactivationRecent
	case t.ConnectionDown && !rules.AllowBroken:
		return ReactivationConnectionDown
	case sentToday >= rules.DailyLimit:
		return ReactivationDailyLimit
	}
	return ReactivationOK
}

// FirstName is how the email greets the person ("" = "Hola," without a name)
func (t ReactivationTarget) FirstName() string {
	fields := strings.Fields(t.Name)
	if len(fields) == 0 {
		return ""
	}
	r := []rune(strings.ToLower(fields[0]))
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

// ReactivationDraft is the text the team writes (stored in the outbox as is)
type ReactivationDraft struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// Validate checks the limits and that the person's name or email was not typed in (the outbox must not hold them)
func (d *ReactivationDraft) Validate(t ReactivationTarget) error {
	d.Subject = strings.TrimSpace(d.Subject)
	d.Body = strings.TrimSpace(strings.ReplaceAll(d.Body, "\r\n", "\n"))
	if d.Subject == "" || d.Body == "" || utf8.RuneCountInString(d.Subject) > reactivationMaxSubject ||
		utf8.RuneCountInString(d.Body) > reactivationMaxBody {
		return ErrInvalidReactivation
	}
	if strings.Contains(d.Subject, ReactivationNamePlaceholder) {
		return ErrInvalidReactivation // the subject stays generic: no name in subjects
	}
	text := strings.ToLower(d.Subject + "\n" + d.Body)
	if t.Email != "" && strings.Contains(text, strings.ToLower(t.Email)) {
		return ErrInvalidReactivation
	}
	if name := strings.ToLower(t.FirstName()); utf8.RuneCountInString(name) >= 3 {
		if regexp.MustCompile(`(^|[^\p{L}])` + regexp.QuoteMeta(name) + `($|[^\p{L}])`).MatchString(text) {
			return ErrInvalidReactivation
		}
	}
	return nil
}

// Paragraphs turns the text into the paragraphs of the email, with {nombre} replaced
func (d ReactivationDraft) Paragraphs(firstName string) []string {
	body := strings.ReplaceAll(d.Body, "\r\n", "\n")
	if firstName == "" {
		body = strings.ReplaceAll(body, " "+ReactivationNamePlaceholder, "")
	}
	body = strings.ReplaceAll(body, ReactivationNamePlaceholder, firstName)
	var out []string
	for _, p := range strings.Split(body, "\n\n") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// ReactivationView is GET /admin/users/:id/reactivation
type ReactivationView struct {
	Allowed    bool              `json:"allowed"`
	Reason     string            `json:"reason"`
	Draft      ReactivationDraft `json:"draft"`
	Founder    bool              `json:"founder"`
	LastSentAt *time.Time        `json:"last_sent_at"`
	SentToday  int               `json:"sent_today"`
	DailyLimit int               `json:"daily_limit"`
}

// ReactivationPreview is the final email exactly as it will be sent (to the admin only, never stored)
type ReactivationPreview struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
	Text    string `json:"text"`
}
