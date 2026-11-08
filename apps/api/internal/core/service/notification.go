package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/url"
	"strings"
	"time"
)

// monthlySummaryDays: the summary of the previous month is queued during the first days of the month
// (the daily quota spreads the sending over those days)
const monthlySummaryDays = 3

// NotificationSettings contains the secret of the unsubscribe links and the public API URL
type NotificationSettings struct {
	// UnsubscribeSecret signs the unsubscribe links (derived from JWT_SECRET in the injector)
	UnsubscribeSecret []byte
	APIBaseURL        string
}

// MonthlyReports is what the summary needs from the analysis service (the same numbers as the app)
type MonthlyReports interface {
	GetFinancialReport(ctx context.Context, userID string, filter time.Time) (domain.FinancialReport, error)
	GetCategoriesReport(ctx context.Context, userID string, filter time.Time, sortBy *string) (domain.CategoriesReport, error)
}

// NotificationPrefsService implements port.NotificationService
type NotificationPrefsService struct {
	repo     port.NotificationRepository
	mail     port.MailService
	reports  MonthlyReports
	settings NotificationSettings
	now      func() time.Time
}

// NewNotificationService creates the notification service
func NewNotificationService(repo port.NotificationRepository, mail port.MailService, reports MonthlyReports, settings NotificationSettings) *NotificationPrefsService {
	return &NotificationPrefsService{repo: repo, mail: mail, reports: reports, settings: settings, now: time.Now}
}

// GetPrefs returns the email preferences of the user
func (s *NotificationPrefsService) GetPrefs(ctx context.Context, userID string) (domain.NotificationPrefs, error) {
	return s.repo.GetPrefs(ctx, userID)
}

// UpdatePrefs saves the preferences. Product news stays off: there are no such emails yet.
func (s *NotificationPrefsService) UpdatePrefs(ctx context.Context, userID string, prefs domain.NotificationPrefs) (domain.NotificationPrefs, error) {
	prefs.ProductNews = false
	if err := s.repo.SavePrefs(ctx, userID, prefs); err != nil {
		return domain.NotificationPrefs{}, err
	}
	return prefs, nil
}

// UnsubscribeURL builds the signed link (no login) of the stream the template belongs to
func (s *NotificationPrefsService) UnsubscribeURL(userID, template string) string {
	kind := domain.UnsubscribeKind(template)
	if kind == "" {
		return ""
	}
	return s.settings.APIBaseURL + "/mail/unsubscribe?t=" + url.QueryEscape(s.sign(userID, kind))
}

// Unsubscribe verifies the link and turns the stream off
func (s *NotificationPrefsService) Unsubscribe(ctx context.Context, token string) (string, error) {
	userID, kind, err := s.verify(token)
	if err != nil {
		return "", err
	}
	if err = s.repo.SetPref(ctx, userID, kind, false); err != nil {
		return "", err
	}
	slog.Info("unsubscribed", "user_id", userID, "kind", kind)
	return kind, nil
}

// CheckUnsubscribe validates a link without applying it
func (s *NotificationPrefsService) CheckUnsubscribe(token string) (string, error) {
	_, kind, err := s.verify(token)
	return kind, err
}

// sign returns base64url(userID|kind).base64url(hmac)
func (s *NotificationPrefsService) sign(userID, kind string) string {
	body := userID + "|" + kind
	mac := hmac.New(sha256.New, s.settings.UnsubscribeSecret)
	mac.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString([]byte(body)) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *NotificationPrefsService) verify(token string) (userID, kind string, err error) {
	if len(s.settings.UnsubscribeSecret) == 0 {
		return "", "", domain.ErrInvalidUnsubscribeToken
	}
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 2 {
		return "", "", domain.ErrInvalidUnsubscribeToken
	}
	body, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", "", domain.ErrInvalidUnsubscribeToken
	}
	given, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", "", domain.ErrInvalidUnsubscribeToken
	}

	mac := hmac.New(sha256.New, s.settings.UnsubscribeSecret)
	mac.Write(body)
	if !hmac.Equal(given, mac.Sum(nil)) {
		return "", "", domain.ErrInvalidUnsubscribeToken
	}

	userID, kind, ok := strings.Cut(string(body), "|")
	if !ok || userID == "" || (kind != domain.UnsubMonthlySummary && kind != domain.UnsubConnectionAlerts) {
		return "", "", domain.ErrInvalidUnsubscribeToken
	}
	return userID, kind, nil
}

// ScheduleMonthlySummaries queues, during the first days of the month, the summary of the previous
// month for every user that turned it on. The dedupe key makes it safe to call often.
func (s *NotificationPrefsService) ScheduleMonthlySummaries(ctx context.Context, now time.Time) (int, error) {
	local := now.In(enums.BogotaLocation)
	if local.Day() > monthlySummaryDays {
		return 0, nil
	}
	month := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, enums.BogotaLocation).AddDate(0, -1, 0).Format("2006-01")

	recipients, err := s.repo.MonthlySummaryRecipients(ctx, month)
	if err != nil {
		return 0, err
	}

	payload, _ := json.Marshal(map[string]string{"month": month})
	queued := 0
	for _, r := range recipients {
		userID := r.UserID
		key := monthlySummaryKey(userID, month)
		id, err := s.mail.Enqueue(ctx, domain.OutboxEmail{
			UserID:    &userID,
			To:        r.Email,
			Template:  domain.TemplateMonthlySummary,
			Payload:   payload,
			Priority:  domain.MailPriorityBulk,
			DedupeKey: &key,
		})
		if err != nil {
			return queued, err
		}
		if id != 0 {
			queued++
		}
	}
	return queued, nil
}

// RunScheduler checks every interval whether the monthly summaries must be queued
func (s *NotificationPrefsService) RunScheduler(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if n, err := s.ScheduleMonthlySummaries(ctx, s.now()); err != nil {
			slog.Error("monthly summary: could not schedule", "error", err)
		} else if n > 0 {
			slog.Info("monthly summary: queued", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Enrich computes the numbers of the monthly summary at send time (they are never stored in the outbox).
// If the user turned the summary off after it was queued, the email is cancelled.
func (s *NotificationPrefsService) Enrich(ctx context.Context, email domain.OutboxEmail, data map[string]any) error {
	if email.UserID == nil {
		return domain.ErrMailCancelled
	}
	userID := *email.UserID

	prefs, err := s.repo.GetPrefs(ctx, userID)
	if err != nil {
		return err
	}
	if !prefs.MonthlySummary {
		return domain.ErrMailCancelled
	}

	monthValue, _ := data["month"].(string)
	month, err := time.ParseInLocation("2006-01", monthValue, enums.BogotaLocation)
	if err != nil {
		return errors.Join(domain.ErrMailCancelled, err)
	}
	// any day inside the month: the reports take the month of the filter
	filter := month.AddDate(0, 0, 14)

	report, err := s.reports.GetFinancialReport(ctx, userID, filter)
	if err != nil {
		return err
	}
	categories, err := s.reports.GetCategoriesReport(ctx, userID, filter, nil)
	if err != nil {
		return err
	}
	currency, err := s.repo.BaseCurrency(ctx, userID)
	if err != nil {
		return err
	}

	income := report.Income.Value
	expenses := report.Expenses.Value
	if expenses < 0 {
		expenses = -expenses
	}
	savings := income - expenses

	data["month_name"] = monthName(month)
	data["income"] = domain.FormatMoney(income, currency)
	data["expenses"] = domain.FormatMoney(expenses, currency)
	data["savings"] = domain.FormatMoney(savings, currency)
	data["saved"] = savings >= 0
	data["has_activity"] = income != 0 || expenses != 0
	data["top_category"] = ""
	data["top_category_amount"] = ""

	// the category with the biggest expense (whatever the sign convention of the report)
	var top float64
	for _, c := range categories.Expenses.Report {
		if v := math.Abs(c.Value); v > top {
			top = v
			data["top_category"] = capitalize(c.Name)
			data["top_category_amount"] = domain.FormatMoney(v, currency)
		}
	}

	return nil
}

// capitalize writes the first letter in uppercase (categories are stored in lowercase)
func capitalize(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	r := []rune(value)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

func monthlySummaryKey(userID, month string) string {
	return domain.TemplateMonthlySummary + ":" + userID + ":" + month
}

var monthNames = [...]string{"enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
	"septiembre", "octubre", "noviembre", "diciembre"}

func monthName(month time.Time) string {
	return monthNames[month.Month()-1] + " de " + month.Format("2006")
}
