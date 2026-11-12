package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminService_CatalogAppliesK5(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAdminMetricsRepository(ctrl)
	svc := NewAdminMetricsService(repo, domain.MetricPrices{})

	// even if a query returned a name with fewer users, the service drops it
	repo.EXPECT().Catalog(gomock.Any(), domain.MinGroupUsers).Return(domain.Catalog{
		Categories: []domain.CategoryUsage{
			{Name: "Otros", Users: 60, Tx: 900},
			{Name: "Comida", Users: 5, Tx: 40},
			{Name: "Clínica Dr. Pérez", Users: 4, Tx: 2},
		},
		CustomCandidates: []domain.CategoryUsage{{Name: "Comida", Users: 5}, {Name: "Arriendo Calle 5", Users: 1}},
		AccountsByBank:   []domain.CategoryUsage{{Name: "Bancolombia", Users: 30}, {Name: "Cooperativa X", Users: 2}},
		UsersTotal:       100, UsersWithBudget: 20, UsersOverBudget: 5,
	}, nil)

	catalog, err := svc.Catalog(context.Background())
	require.NoError(t, err)

	names := func(rows []domain.CategoryUsage) []string {
		out := []string{}
		for _, r := range rows {
			out = append(out, r.Name)
		}
		return out
	}
	assert.Equal(t, []string{"Otros", "Comida"}, names(catalog.Categories))
	assert.Equal(t, []string{"Comida"}, names(catalog.CustomCandidates))
	assert.Equal(t, []string{"Bancolombia"}, names(catalog.AccountsByBank))
	assert.Equal(t, 20.0, catalog.BudgetPct)
	assert.Equal(t, 25.0, catalog.OverBudgetPct)
}

func TestAdminService_QualityAppliesK5ToBanks(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAdminMetricsRepository(ctrl)
	svc := NewAdminMetricsService(repo, domain.MetricPrices{})
	svc.now = func() time.Time { return time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC) }

	repo.EXPECT().Series(gomock.Any(), gomock.Any(), "2026-08-14", "2026-11-11").Return(domain.MetricSeries{
		domain.MetricTxAuto:         {{Day: "2026-11-10", Value: 90}, {Day: "2026-10-01", Value: 1000}},
		domain.MetricTxManual:       {{Day: "2026-11-10", Value: 10}},
		domain.MetricTxShouldVerify: {{Day: "2026-11-10", Value: 9}},
	}, nil)
	repo.EXPECT().CorrectedTx(gomock.Any(), gomock.Any()).Return(int64(18), nil)
	repo.EXPECT().Banks(gomock.Any(), gomock.Any(), domain.MinGroupUsers).Return([]domain.BankQuality{
		{Bank: "Bancolombia", Users: 7}, {Bank: "Banco pequeño", Users: 3},
	}, nil)
	repo.EXPECT().Review(gomock.Any(), gomock.Any()).Return(domain.ReviewCycle{}, nil)

	report, err := svc.Quality(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "2026-10-13", report.From, "30 days including today")
	assert.Equal(t, 90.0, report.AutoTx, "only the last 30 days")
	assert.Equal(t, 90.0, report.AutomationPct)
	assert.Equal(t, 20.0, report.CorrectionPct)
	assert.Equal(t, 10.0, report.ShouldVerifyPct)
	require.Len(t, report.Banks, 1)
	assert.Equal(t, "Bancolombia", report.Banks[0].Bank)
}

func TestAdminService_SummaryNorthStarTrend(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAdminMetricsRepository(ctrl)
	svc := NewAdminMetricsService(repo, domain.MetricPrices{MailDailyQuota: 100})
	svc.now = func() time.Time { return time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC) }

	repo.EXPECT().Series(gomock.Any(), gomock.Any(), "2026-08-19", "2026-11-11").Return(domain.MetricSeries{
		// computed up to yesterday (the nightly run): as_of is the last computed day
		domain.MetricNorthStar7d: {{Day: "2026-11-10", Value: 12}, {Day: "2026-11-03", Value: 9}, {Day: "2026-08-25", Value: 2}},
		domain.MetricMAU:         {{Day: "2026-11-10", Value: 30}},
		domain.MetricSignups:     {{Day: "2026-11-09", Value: 2}, {Day: "2026-10-20", Value: 3}, {Day: "2026-09-01", Value: 4}},
	}, nil)
	repo.EXPECT().ComputedAt(gomock.Any()).Return(nil, nil)
	repo.EXPECT().TotalUsers(gomock.Any()).Return(int64(56), nil)
	repo.EXPECT().Activation(gomock.Any(), gomock.Any()).Return(domain.ActivationRates{}, nil)
	repo.EXPECT().CorrectedTx(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	repo.EXPECT().Reading(gomock.Any()).Return(domain.ReadingHealth{Connections: []domain.ConnectionCount{
		{State: "ok", Count: 9}, {State: "error", Count: 1}, {State: "inactive", Count: 5},
	}}, nil)
	repo.EXPECT().Review(gomock.Any(), gomock.Any()).Return(domain.ReviewCycle{Pending: 4}, nil)
	repo.EXPECT().Cohorts(gomock.Any(), 26).Return([]domain.Cohort{{W1Eligible: 4, W1: 1}}, nil)
	repo.EXPECT().Control(gomock.Any()).Return(domain.ControlMetrics{}, nil)

	summary, err := svc.Summary(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "2026-11-10", summary.AsOf)
	assert.Equal(t, 12.0, summary.NorthStar)
	assert.Equal(t, 9.0, summary.NorthStarBefore)
	require.Len(t, summary.NorthStarTrend, 12)
	assert.Equal(t, "2026-08-25", summary.NorthStarTrend[0].Day)
	assert.Equal(t, 2.0, summary.NorthStarTrend[0].Value)
	assert.Equal(t, domain.DayValue{Day: "2026-11-10", Value: 12}, summary.NorthStarTrend[11])
	assert.Equal(t, 2.0, summary.Signups7d)
	assert.Equal(t, 5.0, summary.Signups30d)
	assert.Equal(t, 90.0, summary.Tree.HealthyConnPct, "inactive connections do not count")
	assert.Equal(t, int64(4), summary.Tree.ReviewPending)
	require.NotNil(t, summary.Tree.RetentionW1Pct)
	assert.Equal(t, 25.0, *summary.Tree.RetentionW1Pct)
	assert.Nil(t, summary.Tree.RetentionW4Pct, "no user reached week 4 yet")
	assert.Equal(t, 100, summary.Control.MailDailyQuota)
}

func TestAdminService_CostPerActiveUser(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAdminMetricsRepository(ctrl)
	svc := NewAdminMetricsService(repo, domain.MetricPrices{
		InPerMTok: decimal.RequireFromString("0.10"), OutPerMTok: decimal.RequireFromString("0.40"),
		ServerMonthly: decimal.RequireFromString("12"), MailDailyQuota: 100,
	})
	svc.now = func() time.Time { return time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC) }

	repo.EXPECT().Series(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Return(domain.MetricSeries{
		domain.MetricLLMTokensIn:  {{Day: "2026-11-01", Value: 20_000_000}},
		domain.MetricLLMTokensOut: {{Day: "2026-11-01", Value: 1_000_000}},
		domain.MetricMailsSent:    {{Day: "2026-11-02", Value: 40}, {Day: "2026-11-03", Value: 7}},
		domain.MetricMAU:          {{Day: "2026-11-10", Value: 20}},
	}, nil)

	report, err := svc.Costs(context.Background())
	require.NoError(t, err)

	// 20M × 0.10 + 1M × 0.40 = 2.4 USD; (2.4 + 12) / 20 users = 0.72
	assert.Equal(t, "2.4000", report.LLMCost30d)
	assert.Equal(t, "0.7200", report.CostPerActiveUser)
	assert.True(t, report.PricesConfigured)
	assert.Equal(t, 47.0, report.MailsSent30d)
	assert.Equal(t, 40.0, report.MaxMailsDay30d)
}

func TestAdminService_UsersRejectsUnknownSegment(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAdminMetricsRepository(ctrl)
	svc := NewAdminMetricsService(repo, domain.MetricPrices{})

	_, err := svc.Users(context.Background(), domain.AdminUserFilter{Segment: "1; DROP TABLE users"})
	assert.ErrorIs(t, err, domain.ErrInvalidAdminFilter)

	repo.EXPECT().Users(gomock.Any(), domain.AdminUserFilter{Segment: "broken", Limit: 50}).Return(domain.AdminUserPage{}, nil)
	_, err = svc.Users(context.Background(), domain.AdminUserFilter{Segment: "broken", Limit: 10_000})
	assert.NoError(t, err)
}

func TestAdminService_AuditNeedsAnAdmin(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAdminMetricsRepository(ctrl)
	svc := NewAdminMetricsService(repo, domain.MetricPrices{})

	assert.ErrorIs(t, svc.Audit(context.Background(), domain.AdminAudit{Action: domain.AdminActionView}), domain.ErrForbidden)
	repo.EXPECT().RecordAudit(gomock.Any(), domain.AdminAudit{AdminID: "a1", Action: domain.AdminActionView}).Return(nil)
	assert.NoError(t, svc.Audit(context.Background(), domain.AdminAudit{AdminID: "a1", Action: domain.AdminActionView}))
}
