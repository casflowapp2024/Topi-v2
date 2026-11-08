package service

import (
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeNotificationRepo struct {
	prefs      map[string]domain.NotificationPrefs
	recipients []domain.MailRecipient
	currency   string
	months     []string
}

func (f *fakeNotificationRepo) GetPrefs(_ context.Context, userID string) (domain.NotificationPrefs, error) {
	if p, ok := f.prefs[userID]; ok {
		return p, nil
	}
	return domain.DefaultNotificationPrefs(), nil
}

func (f *fakeNotificationRepo) SavePrefs(_ context.Context, userID string, prefs domain.NotificationPrefs) error {
	f.prefs[userID] = prefs
	return nil
}

func (f *fakeNotificationRepo) SetPref(_ context.Context, userID, kind string, value bool) error {
	p, _ := f.GetPrefs(context.Background(), userID)
	switch kind {
	case domain.UnsubMonthlySummary:
		p.MonthlySummary = value
	case domain.UnsubConnectionAlerts:
		p.ConnectionAlerts = value
	}
	f.prefs[userID] = p
	return nil
}

func (f *fakeNotificationRepo) MonthlySummaryRecipients(_ context.Context, month string) ([]domain.MailRecipient, error) {
	f.months = append(f.months, month)
	return f.recipients, nil
}

func (f *fakeNotificationRepo) BaseCurrency(context.Context, string) (string, error) {
	if f.currency == "" {
		return "COP", nil
	}
	return f.currency, nil
}

type fakeReports struct {
	filters []time.Time
}

func (r *fakeReports) GetFinancialReport(_ context.Context, _ string, filter time.Time) (domain.FinancialReport, error) {
	r.filters = append(r.filters, filter)
	var report domain.FinancialReport
	report.Income.Value = 5200000
	report.Expenses.Value = -3950500
	return report, nil
}

func (r *fakeReports) GetCategoriesReport(context.Context, string, time.Time, *string) (domain.CategoriesReport, error) {
	var report domain.CategoriesReport
	report.Expenses.Report = []domain.CategoryMetric{
		{Name: "transporte", MonthlyMetrics: domain.MonthlyMetrics{Value: -300000}},
		{Name: "mercado", MonthlyMetrics: domain.MonthlyMetrics{Value: -1120000}},
	}
	return report, nil
}

func newNotificationEnv() (*NotificationPrefsService, *fakeNotificationRepo, *fakeMailService, *fakeReports) {
	repo := &fakeNotificationRepo{prefs: map[string]domain.NotificationPrefs{}}
	mail := &fakeMailService{}
	reports := &fakeReports{}
	svc := NewNotificationService(repo, mail, reports, NotificationSettings{
		UnsubscribeSecret: []byte("0123456789abcdef0123456789abcdef"),
		APIBaseURL:        "https://api.topi.test",
	})
	return svc, repo, mail, reports
}

func tokenOf(t *testing.T, link string) string {
	t.Helper()
	u, err := url.Parse(link)
	require.NoError(t, err)
	return u.Query().Get("t")
}

func TestNotification_DefaultsAndUpdate(t *testing.T) {
	svc, _, _, _ := newNotificationEnv()
	ctx := context.Background()

	prefs, err := svc.GetPrefs(ctx, "u1")
	require.NoError(t, err)
	assert.False(t, prefs.MonthlySummary, "the summary is opt-in")
	assert.True(t, prefs.ConnectionAlerts)

	saved, err := svc.UpdatePrefs(ctx, "u1", domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: false, ProductNews: true})
	require.NoError(t, err)
	assert.Equal(t, domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: false, ProductNews: false}, saved,
		"product news stays off")
}

func TestNotification_UnsubscribeLink(t *testing.T) {
	svc, repo, _, _ := newNotificationEnv()
	ctx := context.Background()
	repo.prefs["u1"] = domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: true}

	link := svc.UnsubscribeURL("u1", domain.TemplateMonthlySummary)
	assert.True(t, strings.HasPrefix(link, "https://api.topi.test/mail/unsubscribe?t="))
	assert.Empty(t, svc.UnsubscribeURL("u1", domain.TemplatePasswordCode), "transactional emails have no link")

	token := tokenOf(t, link)
	kind, err := svc.CheckUnsubscribe(token)
	require.NoError(t, err)
	assert.Equal(t, domain.UnsubMonthlySummary, kind)
	assert.True(t, repo.prefs["u1"].MonthlySummary, "checking does not change anything")

	kind, err = svc.Unsubscribe(ctx, token)
	require.NoError(t, err)
	assert.Equal(t, domain.UnsubMonthlySummary, kind)
	assert.False(t, repo.prefs["u1"].MonthlySummary)
	assert.True(t, repo.prefs["u1"].ConnectionAlerts, "only that stream")

	// connection alerts have their own link
	kind, err = svc.Unsubscribe(ctx, tokenOf(t, svc.UnsubscribeURL("u1", domain.TemplateConnectionDown)))
	require.NoError(t, err)
	assert.Equal(t, domain.UnsubConnectionAlerts, kind)
	assert.False(t, repo.prefs["u1"].ConnectionAlerts)
}

func TestNotification_TamperedLinks(t *testing.T) {
	svc, _, _, _ := newNotificationEnv()
	token := tokenOf(t, svc.UnsubscribeURL("u1", domain.TemplateMonthlySummary))
	body, sig, _ := strings.Cut(token, ".")

	other, _, _ := strings.Cut(tokenOf(t, svc.UnsubscribeURL("u2", domain.TemplateMonthlySummary)), ".")

	for name, bad := range map[string]string{
		"empty":            "",
		"no signature":     body,
		"other user":       other + "." + sig,
		"bad signature":    body + ".AAAA",
		"garbage":          "%%%.%%%",
		"another key used": "",
	} {
		if name == "another key used" {
			otherSvc := NewNotificationService(nil, nil, nil, NotificationSettings{UnsubscribeSecret: []byte("another-secret-another-secret!!!")})
			bad = tokenOf(t, "https://x/?t="+url.QueryEscape(otherSvc.sign("u1", domain.UnsubMonthlySummary)))
		}
		_, err := svc.CheckUnsubscribe(bad)
		assert.ErrorIs(t, err, domain.ErrInvalidUnsubscribeToken, name)
	}
}

func TestNotification_ScheduleMonthlySummaries(t *testing.T) {
	svc, repo, mail, _ := newNotificationEnv()
	ctx := context.Background()
	repo.recipients = []domain.MailRecipient{{UserID: "u1", Email: "a@example.com"}, {UserID: "u2", Email: "b@example.com"}}

	// Nov 1 00:30 in Bogotá (05:30 UTC): the October summary
	n, err := svc.ScheduleMonthlySummaries(ctx, time.Date(2026, 11, 1, 5, 30, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Equal(t, 2, n)
	assert.Equal(t, []string{"2026-10"}, repo.months)
	require.Len(t, mail.queued, 2)
	email := mail.queued[0]
	assert.Equal(t, domain.TemplateMonthlySummary, email.Template)
	assert.Equal(t, domain.MailPriorityBulk, email.Priority)
	assert.Equal(t, "monthly_summary:u1:2026-10", *email.DedupeKey)
	assert.JSONEq(t, `{"month":"2026-10"}`, string(email.Payload), "no amounts in the outbox")

	// Nov 1 04:00 UTC is still Oct 31 23:00 in Bogotá (day 31): nothing yet
	repo.months = nil
	n, err = svc.ScheduleMonthlySummaries(ctx, time.Date(2026, 11, 1, 4, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Zero(t, n)
	assert.Empty(t, repo.months)

	// day 4: too late, nothing is queued
	n, err = svc.ScheduleMonthlySummaries(ctx, time.Date(2026, 11, 4, 15, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Zero(t, n)

	// January -> December of the previous year
	repo.months = nil
	_, err = svc.ScheduleMonthlySummaries(ctx, time.Date(2027, 1, 2, 15, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Equal(t, []string{"2026-12"}, repo.months)
}

func TestNotification_EnrichMonthlySummary(t *testing.T) {
	svc, repo, _, reports := newNotificationEnv()
	ctx := context.Background()
	userID := "u1"
	email := domain.OutboxEmail{UserID: &userID, Template: domain.TemplateMonthlySummary, Payload: json.RawMessage(`{"month":"2026-10"}`)}

	// the user turned it off after it was queued
	data := map[string]any{"month": "2026-10"}
	assert.ErrorIs(t, svc.Enrich(ctx, email, data), domain.ErrMailCancelled)

	repo.prefs[userID] = domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: true}
	data = map[string]any{"month": "2026-10"}
	require.NoError(t, svc.Enrich(ctx, email, data))

	assert.Equal(t, "octubre de 2026", data["month_name"])
	assert.Equal(t, "$5.200.000", data["income"])
	assert.Equal(t, "$3.950.500", data["expenses"])
	assert.Equal(t, "$1.249.500", data["savings"])
	assert.Equal(t, true, data["saved"])
	assert.Equal(t, "Mercado", data["top_category"])
	assert.Equal(t, "$1.120.000", data["top_category_amount"])
	require.Len(t, reports.filters, 1)
	assert.Equal(t, time.October, reports.filters[0].Month(), "the report of the summary month")

	// other base currency
	repo.currency = "USD"
	data = map[string]any{"month": "2026-10"}
	require.NoError(t, svc.Enrich(ctx, email, data))
	assert.Equal(t, "$5.200.000,00 USD", data["income"])

	// a broken payload is cancelled, not retried forever
	data = map[string]any{"month": "nope"}
	assert.ErrorIs(t, svc.Enrich(ctx, email, data), domain.ErrMailCancelled)
}

func TestFormatMoney(t *testing.T) {
	assert.Equal(t, "$0", domain.FormatMoney(0, "COP"))
	assert.Equal(t, "$999", domain.FormatMoney(999, ""))
	assert.Equal(t, "$1.000", domain.FormatMoney(1000, "cop"))
	assert.Equal(t, "$1.234.568", domain.FormatMoney(1234567.6, "COP"))
	assert.Equal(t, "-$50.000", domain.FormatMoney(-50000, "COP"))
	assert.Equal(t, "$12,50 USD", domain.FormatMoney(12.5, "USD"))
	assert.Equal(t, "$1.000,05 EUR", domain.FormatMoney(1000.049, "EUR"))
}
