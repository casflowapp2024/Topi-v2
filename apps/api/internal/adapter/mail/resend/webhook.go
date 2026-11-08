package resend

import (
	"cash-flow/internal/core/domain"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

// webhookTolerance rejects old or future signed messages (replays)
const webhookTolerance = 5 * time.Minute

// ErrInvalidSignature is returned when the webhook signature does not verify
var ErrInvalidSignature = errors.New("invalid webhook signature")

// WebhookParser verifies and parses Resend webhooks. Resend signs them with Svix:
// HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<body>" with the base64 secret after "whsec_",
// sent in svix-signature as space separated "v1,<base64>" values.
type WebhookParser struct {
	secret []byte
	now    func() time.Time
}

// NewWebhookParser creates the parser with RESEND_WEBHOOK_SECRET ("whsec_..."). An empty or invalid
// secret makes every webhook fail (401): nothing is trusted without a signature.
func NewWebhookParser(secret string) *WebhookParser {
	key, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(strings.TrimSpace(secret), "whsec_"))
	if err != nil {
		key = nil
	}
	return &WebhookParser{secret: key, now: time.Now}
}

type webhookEvent struct {
	Type string `json:"type"`
	Data struct {
		EmailID string   `json:"email_id"`
		To      []string `json:"to"`
		Bounce  *struct {
			Type    string `json:"type"`
			SubType string `json:"subType"`
		} `json:"bounce"`
	} `json:"data"`
}

// Parse verifies the signature and returns the event
func (p *WebhookParser) Parse(id, timestamp, signature string, body []byte) (*domain.MailEvent, error) {
	if len(p.secret) == 0 || id == "" || timestamp == "" || signature == "" {
		return nil, ErrInvalidSignature
	}

	seconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return nil, ErrInvalidSignature
	}
	if sent := time.Unix(seconds, 0); p.now().Sub(sent).Abs() > webhookTolerance {
		return nil, ErrInvalidSignature
	}

	mac := hmac.New(sha256.New, p.secret)
	mac.Write([]byte(id + "." + timestamp + "."))
	mac.Write(body)
	expected := mac.Sum(nil)

	valid := false
	for _, candidate := range strings.Fields(signature) {
		version, value, ok := strings.Cut(candidate, ",")
		if !ok || version != "v1" {
			continue
		}
		given, err := base64.StdEncoding.DecodeString(value)
		if err == nil && hmac.Equal(given, expected) {
			valid = true
			break
		}
	}
	if !valid {
		return nil, ErrInvalidSignature
	}

	var event webhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return nil, err
	}

	out := &domain.MailEvent{Type: event.Type, ProviderID: event.Data.EmailID, To: event.Data.To}
	if event.Data.Bounce != nil {
		out.BounceType = event.Data.Bounce.Type
	}
	return out, nil
}
