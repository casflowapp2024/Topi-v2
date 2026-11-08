// Package resend implements port.Mailer with the Resend HTTP API (no SMTP: Hetzner blocks it).
package resend

import (
	"bytes"
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"time"
)

// DefaultBaseURL is the Resend API
const DefaultBaseURL = "https://api.resend.com"

// Mailer sends emails with Resend
type Mailer struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// New creates a Resend mailer. baseURL empty = DefaultBaseURL (tests use an httptest server).
func New(apiKey, baseURL string) *Mailer {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Mailer{
		apiKey:  apiKey,
		baseURL: baseURL,
		client:  &http.Client{Timeout: 15 * time.Second},
	}
}

type tag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type request struct {
	From    string            `json:"from"`
	To      []string          `json:"to"`
	Subject string            `json:"subject"`
	HTML    string            `json:"html,omitempty"`
	Text    string            `json:"text,omitempty"`
	ReplyTo string            `json:"reply_to,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Tags    []tag             `json:"tags,omitempty"`
}

type response struct {
	ID      string `json:"id"`
	Message string `json:"message"`
	Name    string `json:"name"`
}

// Resend only accepts ASCII letters, numbers, underscores and dashes in tags
var invalidTag = regexp.MustCompile(`[^A-Za-z0-9_-]`)

// Send posts the email. 4xx validation errors are domain.ErrMailRejected (not retried);
// 429, 5xx, auth errors and network errors are returned as is (the outbox retries them).
func (m *Mailer) Send(ctx context.Context, msg domain.EmailMessage) (string, error) {
	body := request{
		From:    msg.From,
		To:      []string{msg.To},
		Subject: msg.Subject,
		HTML:    msg.HTML,
		Text:    msg.Text,
		ReplyTo: msg.ReplyTo,
		Headers: msg.Headers,
	}

	names := make([]string, 0, len(msg.Tags))
	for name := range msg.Tags {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		body.Tags = append(body.Tags, tag{
			Name:  invalidTag.ReplaceAllString(name, "_"),
			Value: invalidTag.ReplaceAllString(msg.Tags[name], "_"),
		})
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.baseURL+"/emails", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")
	// a retry of the same outbox row is not sent twice
	if id := msg.Tags["outbox_id"]; id != "" && id != "0" {
		req.Header.Set("Idempotency-Key", "topi-outbox-"+id)
	}

	res, err := m.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("resend: %w", err)
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	var parsed response
	_ = json.Unmarshal(raw, &parsed)

	switch {
	case res.StatusCode >= 200 && res.StatusCode < 300:
		if parsed.ID == "" {
			return "", fmt.Errorf("resend: response without id")
		}
		return parsed.ID, nil
	case res.StatusCode == http.StatusBadRequest || res.StatusCode == http.StatusUnprocessableEntity:
		return "", fmt.Errorf("%w: resend %d %s %s", domain.ErrMailRejected, res.StatusCode, parsed.Name, parsed.Message)
	default:
		return "", fmt.Errorf("resend: HTTP %d %s %s", res.StatusCode, parsed.Name, parsed.Message)
	}
}
