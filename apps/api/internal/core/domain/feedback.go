package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// "¿Qué le falta a Topi?" (plan/27 §E)
const (
	FeedbackMaxLength     = 500
	FeedbackDailyLimit    = 3
	feedbackMaxAppVersion = 40
	// FeedbackNoticeEvery: at most one "hay N opiniones nuevas" email to the team per hour
	FeedbackNoticeEvery = time.Hour
)

var (
	// ErrInvalidFeedback: empty or longer than FeedbackMaxLength
	ErrInvalidFeedback = errors.New("feedback must have between 1 and 500 characters")
)

// Feedback is one opinion. Text is free text written by the user: shown only in the admin panel.
type Feedback struct {
	ID         uint64     `json:"id"`
	UserID     string     `json:"-"`
	ShortUser  string     `json:"user"`
	Text       string     `json:"text"`
	ContactOK  bool       `json:"contact_ok"`
	AppVersion string     `json:"app_version,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	ReadAt     *time.Time `json:"read_at"`
}

// Normalize trims the fields and checks the limits
func (f *Feedback) Normalize() error {
	f.Text = strings.TrimSpace(f.Text)
	if f.Text == "" || utf8.RuneCountInString(f.Text) > FeedbackMaxLength {
		return ErrInvalidFeedback
	}
	f.AppVersion = strings.TrimSpace(f.AppVersion)
	if utf8.RuneCountInString(f.AppVersion) > feedbackMaxAppVersion {
		f.AppVersion = string([]rune(f.AppVersion)[:feedbackMaxAppVersion])
	}
	return nil
}

// ShortUserID is what the panel shows instead of a name or email
func ShortUserID(userID string) string {
	if len(userID) <= 8 {
		return userID
	}
	return userID[:8]
}

// FeedbackPage is GET /admin/feedback
type FeedbackPage struct {
	Items  []Feedback `json:"items"`
	Unread int64      `json:"unread"`
}
