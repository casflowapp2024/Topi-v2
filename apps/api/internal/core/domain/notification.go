package domain

import (
	"errors"
	"math"
	"strconv"
	"strings"
)

// NotificationPrefs are the email preferences of a user (notification_prefs; no row = defaults)
type NotificationPrefs struct {
	MonthlySummary   bool `json:"email_monthly_summary"`
	ConnectionAlerts bool `json:"email_connection_alerts"`
	ProductNews      bool `json:"email_product_news"`
}

// DefaultNotificationPrefs: the monthly summary is opt-in; connection alerts are on
func DefaultNotificationPrefs() NotificationPrefs {
	return NotificationPrefs{MonthlySummary: false, ConnectionAlerts: true, ProductNews: false}
}

// Unsubscribe kinds (one per stream of non transactional emails)
const (
	UnsubMonthlySummary   = "monthly_summary"
	UnsubConnectionAlerts = "connection_alerts"
)

// UnsubscribeKind returns the preference a template belongs to ("" for transactional ones)
func UnsubscribeKind(template string) string {
	switch template {
	case TemplateMonthlySummary:
		return UnsubMonthlySummary
	case TemplateConnectionDown:
		return UnsubConnectionAlerts
	}
	return ""
}

// ErrInvalidUnsubscribeToken is returned for a tampered or malformed unsubscribe link
var ErrInvalidUnsubscribeToken = errors.New("invalid unsubscribe link")

// ErrMailCancelled means the email must not be sent anymore (e.g. the user turned the preference off)
var ErrMailCancelled = errors.New("email cancelled")

// MailRecipient is a user that gets an email
type MailRecipient struct {
	UserID string
	Email  string
}

// FormatMoney formats an amount for an email, es-CO style: "$1.234.567" in COP (no decimals) and
// "$1.234,56 USD" in other currencies. Negative amounts get a leading "-".
func FormatMoney(value float64, currency string) string {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		currency = "COP"
	}

	decimals := 2
	if currency == "COP" {
		decimals = 0
	}

	sign := ""
	if value < 0 {
		sign = "-"
		value = -value
	}

	scaled := math.Round(value * math.Pow10(decimals))
	integer := int64(scaled) / int64(math.Pow10(decimals))
	fraction := int64(scaled) % int64(math.Pow10(decimals))

	digits := strconv.FormatInt(integer, 10)
	var grouped strings.Builder
	for i, r := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			grouped.WriteByte('.')
		}
		grouped.WriteRune(r)
	}

	out := sign + "$" + grouped.String()
	if decimals > 0 {
		out += "," + leftPad(strconv.FormatInt(fraction, 10), decimals)
	}
	if currency != "COP" {
		out += " " + currency
	}
	return out
}

func leftPad(value string, size int) string {
	for len(value) < size {
		value = "0" + value
	}
	return value
}
