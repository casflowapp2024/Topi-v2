package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// AdminMetricsRepository implements port.AdminMetricsRepository. Heavy numbers come from metrics_daily and
// the admin_* views (refresh_admin_metrics, migration 000043); the rest are small live tables.
// Nothing here returns amounts, descriptions or names used by fewer than minUsers users.
type AdminMetricsRepository struct {
	db *postgres.DB
}

// NewAdminMetricsRepository creates a new AdminMetricsRepository instance
func NewAdminMetricsRepository(db *postgres.DB) *AdminMetricsRepository {
	return &AdminMetricsRepository{db: db}
}

const tz = domain.MetricsTimeZone

// Series returns the values of the keys between from and to
func (r *AdminMetricsRepository) Series(ctx context.Context, keys []string, from, to string) (domain.MetricSeries, error) {
	rows, err := r.db.Query(ctx, `SELECT key, day::text, value::float8 FROM metrics_daily
WHERE key = ANY($1) AND day BETWEEN $2::date AND $3::date ORDER BY day`, keys, from, to)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	series := domain.MetricSeries{}
	for _, key := range keys {
		series[key] = []domain.DayValue{}
	}
	for rows.Next() {
		var key string
		var point domain.DayValue
		if err = rows.Scan(&key, &point.Day, &point.Value); err != nil {
			return nil, err
		}
		series[key] = append(series[key], point)
	}
	return series, rows.Err()
}

// ComputedAt is the refresh time of admin_user_stats
func (r *AdminMetricsRepository) ComputedAt(ctx context.Context) (*time.Time, error) {
	var at *time.Time
	if err := r.db.QueryRow(ctx, `SELECT max(computed_at) FROM admin_user_stats`).Scan(&at); err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	return at, nil
}

// TotalUsers counts the registered users
func (r *AdminMetricsRepository) TotalUsers(ctx context.Context) (int64, error) {
	var total int64
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&total)
	return total, mappers.MapPostgresErrorCode(err)
}

// Activation of the users registered since from: connection in 24 h, first automatic transaction in 48 h,
// budget in 7 days
func (r *AdminMetricsRepository) Activation(ctx context.Context, from time.Time) (domain.ActivationRates, error) {
	rates := domain.ActivationRates{Cohort: from.In(domain.MetricsLocation()).Format(time.DateOnly)}
	err := r.db.QueryRow(ctx, `SELECT count(*),
  count(*) FILTER (WHERE first_connection_at <= signup_at + interval '24 hours'),
  count(*) FILTER (WHERE first_auto_tx_at <= signup_at + interval '48 hours'),
  count(*) FILTER (WHERE first_budget_at <= signup_at + interval '7 days')
FROM admin_user_stats WHERE signup_at >= $1`, from).
		Scan(&rates.Signups, &rates.Connection24h, &rates.FirstAuto48h, &rates.Budget7d)
	if err != nil {
		return rates, mappers.MapPostgresErrorCode(err)
	}
	total := float64(rates.Signups)
	rates.Connection24hPct = domain.Pct(float64(rates.Connection24h), total)
	rates.FirstAuto48hPct = domain.Pct(float64(rates.FirstAuto48h), total)
	rates.Budget7dPct = domain.Pct(float64(rates.Budget7d), total)
	return rates, nil
}

// Cohorts of the last weeks (newest first)
func (r *AdminMetricsRepository) Cohorts(ctx context.Context, weeks int) ([]domain.Cohort, error) {
	rows, err := r.db.Query(ctx, `SELECT cohort_week::text, count(*),
  count(w1), count(*) FILTER (WHERE w1),
  count(w4), count(*) FILTER (WHERE w4),
  count(w12), count(*) FILTER (WHERE w12)
FROM admin_user_cohort
WHERE cohort_week >= date_trunc('week', (now() AT TIME ZONE '`+tz+`')::date - 7 * $1)::date
GROUP BY cohort_week ORDER BY cohort_week DESC`, weeks)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	cohorts := []domain.Cohort{}
	for rows.Next() {
		var c domain.Cohort
		if err = rows.Scan(&c.Week, &c.Size, &c.W1Eligible, &c.W1, &c.W4Eligible, &c.W4, &c.W12Eligible, &c.W12); err != nil {
			return nil, err
		}
		cohorts = append(cohorts, c)
	}
	return cohorts, rows.Err()
}

// Reading: connections by provider and state, errors, freshness of the healthy ones and heartbeat
func (r *AdminMetricsRepository) Reading(ctx context.Context) (domain.ReadingHealth, error) {
	health := domain.ReadingHealth{Connections: []domain.ConnectionCount{}, Workers: []domain.WorkerBeat{}}

	rows, err := r.db.Query(ctx, `SELECT provider,
  CASE WHEN error IS NOT NULL THEN 'error' WHEN active THEN 'ok' ELSE 'inactive' END AS state, count(*)
FROM emails GROUP BY 1, 2 ORDER BY 1, 2`)
	if err != nil {
		return health, mappers.MapPostgresErrorCode(err)
	}
	for rows.Next() {
		var c domain.ConnectionCount
		if err = rows.Scan(&c.Provider, &c.State, &c.Count); err != nil {
			rows.Close()
			return health, err
		}
		health.Connections = append(health.Connections, c)
	}
	rows.Close()

	if health.Errors, err = r.nameCounts(ctx, `SELECT error, count(*) FROM emails WHERE error IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC`); err != nil {
		return health, err
	}

	if health.Freshness, err = r.nameCounts(ctx, `WITH last AS (
  SELECT e.id, (SELECT max(p.created_at) FROM processed_emails p WHERE p.email_id = e.id) AS at
  FROM emails e WHERE e.active AND e.error IS NULL
)
SELECT bucket, count(*) FROM (
  SELECT CASE WHEN at IS NULL THEN 'sin_lecturas'
              WHEN at >= now() - interval '24 hours' THEN 'menos_24h'
              WHEN at >= now() - interval '72 hours' THEN '24h_72h'
              ELSE 'mas_72h' END AS bucket
  FROM last
) b GROUP BY bucket ORDER BY bucket`); err != nil {
		return health, err
	}

	rows, err = r.db.Query(ctx, `SELECT worker_id, last_seen, COALESCE(version, '') FROM worker_heartbeat
ORDER BY last_seen DESC LIMIT 10`)
	if err != nil {
		return health, mappers.MapPostgresErrorCode(err)
	}
	for rows.Next() {
		var w domain.WorkerBeat
		if err = rows.Scan(&w.WorkerID, &w.LastSeen, &w.Version); err != nil {
			rows.Close()
			return health, err
		}
		health.Workers = append(health.Workers, w)
	}
	rows.Close()

	err = r.db.QueryRow(ctx, `SELECT
  count(*) FILTER (WHERE status = 'failed' AND updated_at >= now() - interval '7 days'),
  count(*) FILTER (WHERE status = 'pending')
FROM email_jobs`).Scan(&health.JobsFailed7d, &health.JobsPending)
	return health, mappers.MapPostgresErrorCode(err)
}

func (r *AdminMetricsRepository) nameCounts(ctx context.Context, query string, args ...any) ([]domain.NameCount, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	counts := []domain.NameCount{}
	for rows.Next() {
		var c domain.NameCount
		if err = rows.Scan(&c.Name, &c.Count); err != nil {
			return nil, err
		}
		counts = append(counts, c)
	}
	return counts, rows.Err()
}

// correctionEvents are the events of a user correcting an automatic transaction
const correctionEvents = `('tx_category_corrected', 'tx_amount_corrected')`

// Banks: automatic transactions since from by bank name; only names with >= minUsers users
func (r *AdminMetricsRepository) Banks(ctx context.Context, from time.Time, minUsers int) ([]domain.BankQuality, error) {
	rows, err := r.db.Query(ctx, `WITH auto AS (
  SELECT t.id, t.user_id, lower(trim(b.name)) AS bank_key, b.name,
    (t.should_verify OR EXISTS (SELECT 1 FROM product_events pe WHERE pe.name = 'review_resolved'
       AND pe.user_id = t.user_id AND pe.props->>'kind' = 'verify' AND (pe.props->>'transaction_id')::bigint = t.id)) AS verify,
    EXISTS (SELECT 1 FROM product_events pe WHERE pe.name IN `+correctionEvents+`
       AND pe.user_id = t.user_id AND (pe.props->>'transaction_id')::bigint = t.id) AS corrected
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN banks b ON b.id = a.bank_id
  WHERE t.automated AND t.created_at >= $1
)
SELECT min(name), count(DISTINCT user_id), count(*), count(*) FILTER (WHERE verify), count(*) FILTER (WHERE corrected)
FROM auto GROUP BY bank_key
HAVING count(DISTINCT user_id) >= $2
ORDER BY count(*) FILTER (WHERE corrected) DESC, count(*) DESC`, from, minUsers)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	banks := []domain.BankQuality{}
	for rows.Next() {
		var b domain.BankQuality
		if err = rows.Scan(&b.Bank, &b.Users, &b.AutoTx, &b.ShouldVerify, &b.Corrected); err != nil {
			return nil, err
		}
		b.CorrectionPct = domain.Pct(float64(b.Corrected), float64(b.AutoTx))
		banks = append(banks, b)
	}
	return banks, rows.Err()
}

// CorrectedTx counts the automatic transactions whose category or amount the user changed since from
func (r *AdminMetricsRepository) CorrectedTx(ctx context.Context, from time.Time) (int64, error) {
	var count int64
	err := r.db.QueryRow(ctx, `SELECT count(DISTINCT (user_id, props->>'transaction_id')) FROM product_events
WHERE name IN `+correctionEvents+` AND created_at >= $1`, from).Scan(&count)
	return count, mappers.MapPostgresErrorCode(err)
}

// pendingReview is what the inbox shows as Por revisar (the same filter of the transactions list)
const pendingReview = `(t.should_verify OR t.needs_counterpart)`

// Review: created = resolved + still pending among the transactions created since from; median hours to resolve
func (r *AdminMetricsRepository) Review(ctx context.Context, from time.Time) (domain.ReviewCycle, error) {
	review := domain.ReviewCycle{}
	err := r.db.QueryRow(ctx, `WITH resolved AS (
  SELECT pe.created_at, pe.props->>'kind' AS kind, t.created_at AS tx_created_at
  FROM product_events pe
  LEFT JOIN transactions t ON t.user_id = pe.user_id AND t.id = (pe.props->>'transaction_id')::bigint
  WHERE pe.name = 'review_resolved' AND pe.created_at >= $1
)
SELECT
  (SELECT count(*) FROM resolved),
  (SELECT count(*) FROM resolved WHERE tx_created_at >= $1)
    + (SELECT count(*) FROM transactions t WHERE `+pendingReview+` AND t.created_at >= $1),
  (SELECT count(*) FROM transactions t WHERE `+pendingReview+`),
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM created_at - tx_created_at) / 3600)
     FROM resolved WHERE tx_created_at IS NOT NULL)`, from).
		Scan(&review.Resolved, &review.Created, &review.Pending, &review.MedianHours)
	if err != nil {
		return review, mappers.MapPostgresErrorCode(err)
	}
	if review.MedianHours != nil {
		rounded := float64(int64(*review.MedianHours*10+0.5)) / 10
		review.MedianHours = &rounded
	}
	review.ResolvedByKind, err = r.nameCounts(ctx, `SELECT props->>'kind' ||
  CASE WHEN (props->>'dismissed')::boolean THEN '_descartado' ELSE '' END, count(*)
FROM product_events WHERE name = 'review_resolved' AND created_at >= $1 GROUP BY 1 ORDER BY 2 DESC`, from)
	return review, err
}

// Catalog: categories and banks by users (names only with >= minUsers users), accounts by class and currency,
// budgets. The over-budget count compares this month's expenses (without transfers) with each budget; only the
// count of users leaves the query.
func (r *AdminMetricsRepository) Catalog(ctx context.Context, minUsers int) (domain.Catalog, error) {
	catalog := domain.Catalog{}
	var err error

	categoryQuery := `WITH names AS (
  SELECT min(c.name) AS name, count(DISTINCT c.user_id) AS users, array_agg(c.id) AS ids
  FROM categories c %s
  GROUP BY lower(trim(c.name))
  HAVING count(DISTINCT c.user_id) >= $1
)
SELECT n.name, n.users,
  (SELECT count(*) FROM transactions t WHERE t.category_id = ANY(n.ids) AND t.created_at >= now() - interval '90 days')
FROM names n
ORDER BY 2 DESC, 3 DESC LIMIT 30`
	if catalog.Categories, err = r.usages(ctx, fmt.Sprintf(categoryQuery, ""), minUsers); err != nil {
		return catalog, err
	}

	// system categories (created by the app, not named by the user) are not candidates
	defaults := []string{strings.ToLower(domain.CardChargesCategory)}
	for _, category := range domain.DefaultCategories("") {
		defaults = append(defaults, strings.ToLower(strings.TrimSpace(category.Name)))
	}
	if catalog.CustomCandidates, err = r.usages(ctx,
		fmt.Sprintf(categoryQuery, "WHERE lower(trim(c.name)) <> ALL($2)"), minUsers, defaults); err != nil {
		return catalog, err
	}

	if catalog.AccountsByClass, err = r.nameCounts(ctx, `SELECT at.class, count(*) FROM accounts a
JOIN account_types at ON at.id = a.type_id GROUP BY 1 ORDER BY 2 DESC`); err != nil {
		return catalog, err
	}
	if catalog.AccountsByCurrency, err = r.nameCounts(ctx, `SELECT currency, count(*) FROM accounts
GROUP BY 1 ORDER BY 2 DESC`); err != nil {
		return catalog, err
	}
	if catalog.AccountsByBank, err = r.usages(ctx, `SELECT min(b.name), count(DISTINCT a.user_id), count(*)
FROM accounts a JOIN banks b ON b.id = a.bank_id
GROUP BY lower(trim(b.name))
HAVING count(DISTINCT a.user_id) >= $1
ORDER BY 2 DESC, 3 DESC LIMIT 30`, minUsers); err != nil {
		return catalog, err
	}

	err = r.db.QueryRow(ctx, `WITH month_start AS (
  SELECT date_trunc('month', now() AT TIME ZONE '`+tz+`') AT TIME ZONE '`+tz+`' AS at
),
spent AS (
  SELECT t.user_id, t.category_id, sum(COALESCE(t.amount_base, t.amount)) AS total
  FROM transactions t, month_start m
  WHERE t.expense AND t.transfer_group_id IS NULL AND t.date >= m.at
  GROUP BY 1, 2
)
SELECT
  (SELECT count(*) FROM users),
  (SELECT count(DISTINCT user_id) FROM categories WHERE budget > 0),
  (SELECT count(DISTINCT c.user_id) FROM categories c JOIN spent s ON s.category_id = c.id AND s.user_id = c.user_id
   WHERE c.budget > 0 AND NOT c.income AND s.total > c.budget)`).
		Scan(&catalog.UsersTotal, &catalog.UsersWithBudget, &catalog.UsersOverBudget)
	return catalog, mappers.MapPostgresErrorCode(err)
}

func (r *AdminMetricsRepository) usages(ctx context.Context, query string, args ...any) ([]domain.CategoryUsage, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	usages := []domain.CategoryUsage{}
	for rows.Next() {
		var u domain.CategoryUsage
		if err = rows.Scan(&u.Name, &u.Users, &u.Tx); err != nil {
			return nil, err
		}
		usages = append(usages, u)
	}
	return usages, rows.Err()
}

// Control: annoyance signals (alerts off, bounces, complaints)
func (r *AdminMetricsRepository) Control(ctx context.Context) (domain.ControlMetrics, error) {
	control := domain.ControlMetrics{}
	err := r.db.QueryRow(ctx, `SELECT
  (SELECT count(*) FROM notification_prefs WHERE NOT email_connection_alerts),
  (SELECT count(*) FROM notification_prefs WHERE email_monthly_summary),
  (SELECT count(*) FROM users WHERE email_status = 'bounced'),
  (SELECT count(*) FROM users WHERE email_status = 'complained')`).
		Scan(&control.AlertsOff, &control.MonthlySummaryOn, &control.Bounced, &control.Complained)
	return control, mappers.MapPostgresErrorCode(err)
}

// adminSegments are the WHERE of each filter of the users table (over the columns of the inner query)
var adminSegments = map[string]string{
	"":              "true",
	"active7":       "last_day >= today - 6",
	"active30":      "last_day >= today - 29",
	"active90":      "last_day >= today - 89",
	"inactive90":    "(last_day IS NULL OR last_day < today - 89)",
	"no_connection": "connections_active = 0",
	"broken":        "connections_error > 0",
}

// Users is the table of the panel: identity, dates and counts (never amounts or transactions)
func (r *AdminMetricsRepository) Users(ctx context.Context, filter domain.AdminUserFilter) (domain.AdminUserPage, error) {
	page := domain.AdminUserPage{Rows: []domain.AdminUserRow{}}
	where, ok := adminSegments[filter.Segment]
	if !ok {
		return page, domain.ErrInvalidAdminFilter
	}

	rows, err := r.db.Query(ctx, `SELECT id, name, email, signup_at, last_day::text, connections_ok, connections_error,
  last_email_read_at, auto_tx_30d, founder_eligible, founder_confirmed_at, count(*) OVER ()
FROM (
  SELECT u.id, trim(u.name || ' ' || u.last_name) AS name, u.email, s.signup_at,
    (SELECT max(a.day) FROM user_activity_days a WHERE a.user_id = u.id) AS last_day,
    (SELECT count(*) FROM emails e WHERE e.user_id = u.id AND e.active AND e.error IS NULL) AS connections_ok,
    (SELECT count(*) FROM emails e WHERE e.user_id = u.id AND e.error IS NOT NULL) AS connections_error,
    (SELECT count(*) FROM emails e WHERE e.user_id = u.id AND e.active) AS connections_active,
    st.last_email_read_at, COALESCE(st.auto_tx_30d, 0) AS auto_tx_30d,
    u.founder_eligible, u.founder_confirmed_at,
    (now() AT TIME ZONE '`+tz+`')::date AS today
  FROM users u
  JOIN admin_user_signup s ON s.user_id = u.id
  LEFT JOIN admin_user_stats st ON st.user_id = u.id
  WHERE $1 = '' OR u.email ILIKE '%' || $1 || '%' OR (u.name || ' ' || u.last_name) ILIKE '%' || $1 || '%'
) x
WHERE `+where+`
ORDER BY last_day DESC NULLS LAST, signup_at DESC
LIMIT $2 OFFSET $3`, strings.TrimSpace(filter.Search), filter.Limit, filter.Offset)
	if err != nil {
		return page, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var row domain.AdminUserRow
		if err = rows.Scan(&row.ID, &row.Name, &row.Email, &row.SignupAt, &row.LastActiveDay, &row.ConnectionsOK,
			&row.ConnectionsError, &row.LastEmailReadAt, &row.AutoTx30d, &row.FounderEligible, &row.FounderConfirmedAt,
			&page.Total); err != nil {
			return page, err
		}
		page.Rows = append(page.Rows, row)
	}
	return page, rows.Err()
}

// Refresh calls refresh_admin_metrics
func (r *AdminMetricsRepository) Refresh(ctx context.Context, from *time.Time) (int, error) {
	var day *string
	if from != nil {
		value := from.Format(time.DateOnly)
		day = &value
	}
	var rows int
	err := r.db.QueryRow(ctx, `SELECT refresh_admin_metrics($1::date)`, day).Scan(&rows)
	return rows, mappers.MapPostgresErrorCode(err)
}

// RecordAudit inserts a row of admin_audit
func (r *AdminMetricsRepository) RecordAudit(ctx context.Context, audit domain.AdminAudit) error {
	detail := audit.Detail
	if detail == nil {
		detail = map[string]any{}
	}
	payload, err := json.Marshal(detail)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx, `INSERT INTO admin_audit (admin_id, action, target, detail) VALUES ($1, $2, $3, $4::jsonb)`,
		audit.AdminID, audit.Action, nullable(audit.Target), string(payload))
	return mappers.MapPostgresErrorCode(err)
}
