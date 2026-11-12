package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=admin.go -destination=mock/admin.go -package=mock

// AdminMetricsRepository reads the precomputed metrics (metrics_daily and the admin_* views) and the small live
// tables. Every query returns aggregates; only Users returns rows of users and never amounts.
type AdminMetricsRepository interface {
	// Series returns the daily values of the keys between from and to (YYYY-MM-DD)
	Series(ctx context.Context, keys []string, from, to string) (domain.MetricSeries, error)
	// ComputedAt is when the views were refreshed the last time (nil = never)
	ComputedAt(ctx context.Context) (*time.Time, error)
	TotalUsers(ctx context.Context) (int64, error)
	Activation(ctx context.Context, from time.Time) (domain.ActivationRates, error)
	Cohorts(ctx context.Context, weeks int) ([]domain.Cohort, error)
	Reading(ctx context.Context) (domain.ReadingHealth, error)
	// Banks returns the quality by bank since from, only banks with >= minUsers users
	Banks(ctx context.Context, from time.Time, minUsers int) ([]domain.BankQuality, error)
	CorrectedTx(ctx context.Context, from time.Time) (int64, error)
	Review(ctx context.Context, from time.Time) (domain.ReviewCycle, error)
	// Catalog: names only with >= minUsers users
	Catalog(ctx context.Context, minUsers int) (domain.Catalog, error)
	Control(ctx context.Context) (domain.ControlMetrics, error)
	Users(ctx context.Context, filter domain.AdminUserFilter) (domain.AdminUserPage, error)
	// Refresh recomputes metrics_daily from that day (nil = all history) and the views; returns the rows written
	Refresh(ctx context.Context, from *time.Time) (int, error)
	RecordAudit(ctx context.Context, audit domain.AdminAudit) error
}

// AdminService builds the sections of the admin panel (plan/25-admin-metricas.md)
type AdminService interface {
	Summary(ctx context.Context) (*domain.AdminSummary, error)
	Activation(ctx context.Context) ([]domain.ActivationRates, error)
	Cohorts(ctx context.Context) ([]domain.Cohort, error)
	Reading(ctx context.Context) (*domain.ReadingHealth, error)
	Quality(ctx context.Context) (*domain.QualityReport, error)
	Catalog(ctx context.Context) (*domain.Catalog, error)
	Costs(ctx context.Context) (*domain.CostReport, error)
	Users(ctx context.Context, filter domain.AdminUserFilter) (*domain.AdminUserPage, error)
	Refresh(ctx context.Context, adminID string, full bool) (int, error)
	// Audit records an access to the panel; without the audit row the access is refused
	Audit(ctx context.Context, audit domain.AdminAudit) error
}
