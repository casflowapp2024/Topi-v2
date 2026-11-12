package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"log/slog"
	"time"

	"github.com/shopspring/decimal"
)

// adminTrendWeeks is how many weekly points the North Star trend has
const adminTrendWeeks = 12

// AdminMetricsService implements port.AdminService over the precomputed metrics
type AdminMetricsService struct {
	repo   port.AdminMetricsRepository
	prices domain.MetricPrices
	now    func() time.Time
}

// NewAdminMetricsService creates an AdminMetricsService
func NewAdminMetricsService(repo port.AdminMetricsRepository, prices domain.MetricPrices) *AdminMetricsService {
	return &AdminMetricsService{repo: repo, prices: prices, now: time.Now}
}

func (s *AdminMetricsService) today() time.Time { return domain.ActivityDay(s.now()) }

func day(t time.Time) string { return t.Format(time.DateOnly) }

// Summary: North Star (last 7 days) with its 12-week trend, active users, signups and the metric tree
func (s *AdminMetricsService) Summary(ctx context.Context) (*domain.AdminSummary, error) {
	today := s.today()
	from := today.AddDate(0, 0, -7*adminTrendWeeks)
	series, err := s.repo.Series(ctx, []string{
		domain.MetricNorthStar7d, domain.MetricAutoUsers7d, domain.MetricDAU, domain.MetricWAU, domain.MetricMAU,
		domain.MetricSignups, domain.MetricTxAuto, domain.MetricTxManual, domain.MetricTxShouldVerify,
		domain.MetricReviewResolved, domain.MetricMailsSent,
	}, day(from), day(today))
	if err != nil {
		return nil, err
	}

	// the last computed day (the worker recomputes at night; the API on demand)
	asOf := latestDay(series[domain.MetricNorthStar7d], day(today))
	asOfTime, _ := time.ParseInLocation(time.DateOnly, asOf, domain.MetricsLocation())

	trend := make([]domain.DayValue, 0, adminTrendWeeks)
	for w := adminTrendWeeks - 1; w >= 0; w-- {
		point := day(asOfTime.AddDate(0, 0, -7*w))
		trend = append(trend, domain.DayValue{Day: point, Value: series.At(domain.MetricNorthStar7d, point)})
	}

	summary := &domain.AdminSummary{
		AsOf:            asOf,
		NorthStar:       series.At(domain.MetricNorthStar7d, asOf),
		NorthStarBefore: series.At(domain.MetricNorthStar7d, day(asOfTime.AddDate(0, 0, -7))),
		NorthStarTrend:  trend,
		AutoUsers7d:     series.At(domain.MetricAutoUsers7d, asOf),
		DAU:             series.At(domain.MetricDAU, asOf),
		WAU:             series.At(domain.MetricWAU, asOf),
		MAU:             series.At(domain.MetricMAU, asOf),
		ActiveTrend: domain.MetricSeries{
			domain.MetricDAU: series[domain.MetricDAU],
			domain.MetricWAU: series[domain.MetricWAU],
			domain.MetricMAU: series[domain.MetricMAU],
		},
		Signups7d:  series.Sum(domain.MetricSignups, day(asOfTime.AddDate(0, 0, -6)), asOf),
		Signups30d: series.Sum(domain.MetricSignups, day(asOfTime.AddDate(0, 0, -29)), asOf),
	}

	if summary.ComputedAt, err = s.repo.ComputedAt(ctx); err != nil {
		return nil, err
	}
	if summary.TotalUsers, err = s.repo.TotalUsers(ctx); err != nil {
		return nil, err
	}

	from30 := day(asOfTime.AddDate(0, 0, -29))
	auto := series.Sum(domain.MetricTxAuto, from30, asOf)
	manual := series.Sum(domain.MetricTxManual, from30, asOf)
	tree := domain.MetricTree{
		AutomationPct30d:   domain.Pct(auto, auto+manual),
		ShouldVerifyPct30d: domain.Pct(series.Sum(domain.MetricTxShouldVerify, from30, asOf), auto),
		ReviewResolved30d:  series.Sum(domain.MetricReviewResolved, from30, asOf),
	}
	since30 := s.now().AddDate(0, 0, -30)
	if tree.Activation, err = s.repo.Activation(ctx, since30.AddDate(0, 0, -60)); err != nil {
		return nil, err
	}
	corrected, err := s.repo.CorrectedTx(ctx, since30)
	if err != nil {
		return nil, err
	}
	tree.CorrectionPct30d = domain.Pct(float64(corrected), auto)

	reading, err := s.repo.Reading(ctx)
	if err != nil {
		return nil, err
	}
	tree.HealthyConnPct = healthyPct(reading.Connections)

	review, err := s.repo.Review(ctx, since30)
	if err != nil {
		return nil, err
	}
	tree.ReviewPending = review.Pending

	cohorts, err := s.repo.Cohorts(ctx, 26)
	if err != nil {
		return nil, err
	}
	tree.RetentionW1Pct, tree.RetentionW4Pct = retention(cohorts)
	summary.Tree = tree

	if summary.Control, err = s.repo.Control(ctx); err != nil {
		return nil, err
	}
	summary.Control.MailsSentToday = series.At(domain.MetricMailsSent, day(today))
	summary.Control.MailDailyQuota = s.prices.MailDailyQuota

	return summary, nil
}

// latestDay is the last day with a row in the series (fallback when nothing is computed yet)
func latestDay(points []domain.DayValue, fallback string) string {
	latest := ""
	for _, point := range points {
		if point.Day > latest {
			latest = point.Day
		}
	}
	if latest == "" {
		return fallback
	}
	return latest
}

func healthyPct(connections []domain.ConnectionCount) float64 {
	var ok, total int64
	for _, c := range connections {
		if c.State == "inactive" {
			continue
		}
		total += c.Count
		if c.State == "ok" {
			ok += c.Count
		}
	}
	return domain.Pct(float64(ok), float64(total))
}

// retention: % of the users whose week 1 / week 4 already ended that were "al día" in it
func retention(cohorts []domain.Cohort) (*float64, *float64) {
	var w1, w1e, w4, w4e int64
	for _, c := range cohorts {
		w1, w1e, w4, w4e = w1+c.W1, w1e+c.W1Eligible, w4+c.W4, w4e+c.W4Eligible
	}
	pct := func(part, total int64) *float64 {
		if total == 0 {
			return nil
		}
		value := domain.Pct(float64(part), float64(total))
		return &value
	}
	return pct(w1, w1e), pct(w4, w4e)
}

// Activation: the last 30 and 90 days of signups
func (s *AdminMetricsService) Activation(ctx context.Context) ([]domain.ActivationRates, error) {
	result := []domain.ActivationRates{}
	for _, days := range []int{30, 90, 365} {
		rates, err := s.repo.Activation(ctx, s.now().AddDate(0, 0, -days))
		if err != nil {
			return nil, err
		}
		result = append(result, rates)
	}
	return result, nil
}

// Cohorts: the last 26 signup weeks
func (s *AdminMetricsService) Cohorts(ctx context.Context) ([]domain.Cohort, error) {
	return s.repo.Cohorts(ctx, 26)
}

// Reading: connections, errors, freshness, heartbeat and emails processed per day (90 days)
func (s *AdminMetricsService) Reading(ctx context.Context) (*domain.ReadingHealth, error) {
	reading, err := s.repo.Reading(ctx)
	if err != nil {
		return nil, err
	}
	today := s.today()
	reading.Daily, err = s.repo.Series(ctx, []string{
		domain.MetricEmailsProcessed, domain.MetricEmailsTransaction, domain.MetricEmailsNoTx, domain.MetricEmailsError,
		domain.MetricTxAuto, domain.MetricTxManual, domain.MetricTxShouldVerify,
	}, day(today.AddDate(0, 0, -89)), day(today))
	if err != nil {
		return nil, err
	}
	return &reading, nil
}

// Quality: last 30 days of corrections, verifications and Por revisar; banks with k >= MinGroupUsers
func (s *AdminMetricsService) Quality(ctx context.Context) (*domain.QualityReport, error) {
	today := s.today()
	from := today.AddDate(0, 0, -29)
	series, err := s.repo.Series(ctx, []string{
		domain.MetricTxAuto, domain.MetricTxManual, domain.MetricTxShouldVerify,
		domain.MetricCorrectionsCat, domain.MetricCorrectionsAmount, domain.MetricReviewResolved,
	}, day(today.AddDate(0, 0, -89)), day(today))
	if err != nil {
		return nil, err
	}
	f, t := day(from), day(today)
	report := &domain.QualityReport{
		From:           f,
		AutoTx:         series.Sum(domain.MetricTxAuto, f, t),
		ManualTx:       series.Sum(domain.MetricTxManual, f, t),
		ShouldVerify:   series.Sum(domain.MetricTxShouldVerify, f, t),
		CorrectionsCat: series.Sum(domain.MetricCorrectionsCat, f, t),
		CorrectionsAmt: series.Sum(domain.MetricCorrectionsAmount, f, t),
		Daily:          series,
	}
	if report.CorrectedTx, err = s.repo.CorrectedTx(ctx, from); err != nil {
		return nil, err
	}
	report.CorrectionPct = domain.Pct(float64(report.CorrectedTx), report.AutoTx)
	report.ShouldVerifyPct = domain.Pct(report.ShouldVerify, report.AutoTx)
	report.AutomationPct = domain.Pct(report.AutoTx, report.AutoTx+report.ManualTx)

	banks, err := s.repo.Banks(ctx, from, domain.MinGroupUsers)
	if err != nil {
		return nil, err
	}
	report.Banks = domain.KeepCommonBanks(banks)

	if report.Review, err = s.repo.Review(ctx, from); err != nil {
		return nil, err
	}
	return report, nil
}

// Catalog: names only with k >= MinGroupUsers (SQL and again here)
func (s *AdminMetricsService) Catalog(ctx context.Context) (*domain.Catalog, error) {
	catalog, err := s.repo.Catalog(ctx, domain.MinGroupUsers)
	if err != nil {
		return nil, err
	}
	catalog.Categories = domain.KeepCommonNames(catalog.Categories)
	catalog.CustomCandidates = domain.KeepCommonNames(catalog.CustomCandidates)
	catalog.AccountsByBank = domain.KeepCommonNames(catalog.AccountsByBank)
	catalog.BudgetPct = domain.Pct(float64(catalog.UsersWithBudget), float64(catalog.UsersTotal))
	catalog.OverBudgetPct = domain.Pct(float64(catalog.UsersOverBudget), float64(catalog.UsersWithBudget))
	return &catalog, nil
}

// Costs: tokens and cost of the model per day (90 days), per active user (30 days) and mail vs quota
func (s *AdminMetricsService) Costs(ctx context.Context) (*domain.CostReport, error) {
	today := s.today()
	series, err := s.repo.Series(ctx, []string{
		domain.MetricLLMCalls, domain.MetricLLMTokensIn, domain.MetricLLMTokensOut, domain.MetricMailsSent, domain.MetricMAU,
	}, day(today.AddDate(0, 0, -89)), day(today))
	if err != nil {
		return nil, err
	}
	f, t := day(today.AddDate(0, 0, -29)), day(today)
	report := &domain.CostReport{
		From:             f,
		Daily:            series,
		Calls30d:         series.Sum(domain.MetricLLMCalls, f, t),
		TokensIn30d:      series.Sum(domain.MetricLLMTokensIn, f, t),
		TokensOut30d:     series.Sum(domain.MetricLLMTokensOut, f, t),
		PriceIn:          s.prices.InPerMTok.String(),
		PriceOut:         s.prices.OutPerMTok.String(),
		PricesConfigured: s.prices.InPerMTok.IsPositive() || s.prices.OutPerMTok.IsPositive(),
		ServerMonthly:    s.prices.ServerMonthly.String(),
		MAU:              series.At(domain.MetricMAU, latestDay(series[domain.MetricMAU], t)),
		MailsSent30d:     series.Sum(domain.MetricMailsSent, f, t),
		MailDailyQuota:   s.prices.MailDailyQuota,
	}
	for _, point := range series[domain.MetricMailsSent] {
		if point.Day >= f && point.Value > report.MaxMailsDay30d {
			report.MaxMailsDay30d = point.Value
		}
	}

	llm := s.prices.LLMCost(report.TokensIn30d, report.TokensOut30d)
	report.LLMCost30d = llm.StringFixed(4)
	perUser := decimal.Zero
	if report.MAU > 0 {
		perUser = llm.Add(s.prices.ServerMonthly).Div(decimal.NewFromFloat(report.MAU))
	}
	report.CostPerActiveUser = perUser.StringFixed(4)
	return report, nil
}

// Users is the table of the panel (counts, never amounts)
func (s *AdminMetricsService) Users(ctx context.Context, filter domain.AdminUserFilter) (*domain.AdminUserPage, error) {
	if !domain.ValidSegment(filter.Segment) {
		return nil, domain.ErrInvalidAdminFilter
	}
	if filter.Limit == 0 || filter.Limit > 200 {
		filter.Limit = 50
	}
	page, err := s.repo.Users(ctx, filter)
	if err != nil {
		return nil, err
	}
	return &page, nil
}

// Refresh recomputes the last 7 days (full = all history) and audits who did it
func (s *AdminMetricsService) Refresh(ctx context.Context, adminID string, full bool) (int, error) {
	var from *time.Time
	if !full {
		start := s.today().AddDate(0, 0, -7)
		from = &start
	}
	rows, err := s.repo.Refresh(ctx, from)
	if err != nil {
		return 0, err
	}
	if err = s.Audit(ctx, domain.AdminAudit{AdminID: adminID, Action: domain.AdminActionMetricsRefresh,
		Detail: map[string]any{"full": full, "rows": rows}}); err != nil {
		slog.Warn("metrics refreshed but not audited", "error", err)
	}
	return rows, nil
}

// Audit records an access or an action of the panel
func (s *AdminMetricsService) Audit(ctx context.Context, audit domain.AdminAudit) error {
	if audit.AdminID == "" || audit.Action == "" {
		return domain.ErrForbidden
	}
	return s.repo.RecordAudit(ctx, audit)
}
