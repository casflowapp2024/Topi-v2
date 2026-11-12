package domain

import (
	"time"

	"github.com/shopspring/decimal"
)

// MinGroupUsers is the k of the k-anonymity of the admin panel: a category, bank or merchant name is only
// shown when at least this many users use it (custom names may carry personal data).
const MinGroupUsers = 5

// Keys of metrics_daily (one value per day in MetricsTimeZone)
const (
	MetricSignups           = "signups"
	MetricDAU               = "dau"
	MetricWAU               = "wau"
	MetricMAU               = "mau"
	MetricNorthStar7d       = "north_star_7d"
	MetricAutoUsers7d       = "auto_users_7d"
	MetricEmailsProcessed   = "emails_processed"
	MetricEmailsTransaction = "emails_transaction"
	MetricEmailsNoTx        = "emails_no_transaction"
	MetricEmailsError       = "emails_error"
	MetricTxAuto            = "tx_auto"
	MetricTxManual          = "tx_manual"
	MetricTxShouldVerify    = "tx_auto_should_verify"
	MetricCorrectionsCat    = "corrections_category"
	MetricCorrectionsAmount = "corrections_amount"
	MetricReviewResolved    = "review_resolved"
	MetricBudgetsCreated    = "budgets_created"
	MetricLLMCalls          = "llm_calls"
	MetricLLMTokensIn       = "llm_tokens_in"
	MetricLLMTokensOut      = "llm_tokens_out"
	MetricMailsSent         = "mails_sent"
)

// Admin audit actions (admin_audit.action)
const (
	AdminActionView                 = "view"
	AdminActionMetricsRefresh       = "metrics_refresh"
	AdminActionFounderConfirm       = "founder_confirm"
	AdminActionFounderUnconfirm     = "founder_unconfirm"
	AdminActionFounderConfirmActive = "founder_confirm_active"
)

// AdminAudit is one row of admin_audit: who looked at or changed what in the panel
type AdminAudit struct {
	AdminID string
	Action  string
	Target  string
	Detail  map[string]any
}

// DayValue is the value of a metric in a day
type DayValue struct {
	Day   string  `json:"day"`
	Value float64 `json:"value"`
}

// MetricSeries are the daily values of several metrics, by key (days without a row are 0)
type MetricSeries map[string][]DayValue

// Sum adds the values of a key between from and to (YYYY-MM-DD, both included)
func (s MetricSeries) Sum(key, from, to string) float64 {
	var total float64
	for _, point := range s[key] {
		if point.Day >= from && point.Day <= to {
			total += point.Value
		}
	}
	return total
}

// At returns the value of a key in a day (0 when missing)
func (s MetricSeries) At(key, day string) float64 {
	for _, point := range s[key] {
		if point.Day == day {
			return point.Value
		}
	}
	return 0
}

// AdminSummary is the first section of the panel
type AdminSummary struct {
	AsOf            string     `json:"as_of"`
	ComputedAt      *time.Time `json:"computed_at"`
	NorthStar       float64    `json:"north_star"`
	NorthStarBefore float64    `json:"north_star_before"`
	// NorthStarTrend: one point every 7 days (12 weeks), each one the last 7 days up to that day
	NorthStarTrend []DayValue     `json:"north_star_trend"`
	AutoUsers7d    float64        `json:"auto_users_7d"`
	DAU            float64        `json:"dau"`
	WAU            float64        `json:"wau"`
	MAU            float64        `json:"mau"`
	ActiveTrend    MetricSeries   `json:"active_trend"`
	Signups7d      float64        `json:"signups_7d"`
	Signups30d     float64        `json:"signups_30d"`
	TotalUsers     int64          `json:"total_users"`
	Tree           MetricTree     `json:"tree"`
	Control        ControlMetrics `json:"control"`
}

// MetricTree are the inputs that move the North Star (plan/25 § árbol)
type MetricTree struct {
	Activation         ActivationRates `json:"activation"`
	HealthyConnPct     float64         `json:"healthy_connections_pct"`
	AutomationPct30d   float64         `json:"automation_pct_30d"`
	CorrectionPct30d   float64         `json:"correction_pct_30d"`
	ShouldVerifyPct30d float64         `json:"should_verify_pct_30d"`
	ReviewResolved30d  float64         `json:"review_resolved_30d"`
	ReviewPending      int64           `json:"review_pending"`
	RetentionW1Pct     *float64        `json:"retention_w1_pct"`
	RetentionW4Pct     *float64        `json:"retention_w4_pct"`
}

// ControlMetrics watch that growth does not hurt (annoyance, mail quota)
type ControlMetrics struct {
	AlertsOff        int64   `json:"connection_alerts_off"`
	MonthlySummaryOn int64   `json:"monthly_summary_on"`
	Bounced          int64   `json:"bounced"`
	Complained       int64   `json:"complained"`
	MailsSentToday   float64 `json:"mails_sent_today"`
	MailDailyQuota   int     `json:"mail_daily_quota"`
}

// ActivationRates: of the users registered in the period, how many reached each milestone in time
type ActivationRates struct {
	Cohort           string  `json:"cohort"`
	Signups          int64   `json:"signups"`
	Connection24h    int64   `json:"connection_24h"`
	FirstAuto48h     int64   `json:"first_auto_tx_48h"`
	Budget7d         int64   `json:"budget_7d"`
	Connection24hPct float64 `json:"connection_24h_pct"`
	FirstAuto48hPct  float64 `json:"first_auto_tx_48h_pct"`
	Budget7dPct      float64 `json:"budget_7d_pct"`
}

// Cohort is the weekly retention over "al día" (S1, S4, S12). Eligible = users whose week k already ended.
type Cohort struct {
	Week        string `json:"week"`
	Size        int64  `json:"size"`
	W1Eligible  int64  `json:"w1_eligible"`
	W1          int64  `json:"w1"`
	W4Eligible  int64  `json:"w4_eligible"`
	W4          int64  `json:"w4"`
	W12Eligible int64  `json:"w12_eligible"`
	W12         int64  `json:"w12"`
}

// ReadingHealth is the state of the email reader
type ReadingHealth struct {
	Connections  []ConnectionCount `json:"connections"`
	Errors       []NameCount       `json:"errors"`
	Freshness    []NameCount       `json:"freshness"`
	Workers      []WorkerBeat      `json:"workers"`
	JobsFailed7d int64             `json:"jobs_failed_7d"`
	JobsPending  int64             `json:"jobs_pending"`
	Daily        MetricSeries      `json:"daily"`
}

// ConnectionCount: connections by provider and state (ok | error | inactive)
type ConnectionCount struct {
	Provider string `json:"provider"`
	State    string `json:"state"`
	Count    int64  `json:"count"`
}

// NameCount is a generic (name, count) pair
type NameCount struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

// WorkerBeat is the last heartbeat of a worker process
type WorkerBeat struct {
	WorkerID string    `json:"worker_id"`
	LastSeen time.Time `json:"last_seen"`
	Version  string    `json:"version"`
}

// QualityReport: corrections and verifications of the automatic transactions
type QualityReport struct {
	From            string        `json:"from"`
	AutoTx          float64       `json:"auto_tx"`
	ManualTx        float64       `json:"manual_tx"`
	ShouldVerify    float64       `json:"should_verify"`
	CorrectionsCat  float64       `json:"corrections_category"`
	CorrectionsAmt  float64       `json:"corrections_amount"`
	CorrectedTx     int64         `json:"corrected_tx"`
	CorrectionPct   float64       `json:"correction_pct"`
	ShouldVerifyPct float64       `json:"should_verify_pct"`
	AutomationPct   float64       `json:"automation_pct"`
	Banks           []BankQuality `json:"banks"`
	Review          ReviewCycle   `json:"review"`
	Daily           MetricSeries  `json:"daily"`
}

// BankQuality: only banks used by at least MinGroupUsers users
type BankQuality struct {
	Bank          string  `json:"bank"`
	Users         int64   `json:"users"`
	AutoTx        int64   `json:"auto_tx"`
	ShouldVerify  int64   `json:"should_verify"`
	Corrected     int64   `json:"corrected"`
	CorrectionPct float64 `json:"correction_pct"`
}

// ReviewCycle: items of Por revisar created vs resolved and the time to resolve
type ReviewCycle struct {
	Created        int64       `json:"created"`
	Resolved       int64       `json:"resolved"`
	Pending        int64       `json:"pending"`
	MedianHours    *float64    `json:"median_hours"`
	ResolvedByKind []NameCount `json:"resolved_by_kind"`
}

// Catalog: what users configure (names only with k >= MinGroupUsers)
type Catalog struct {
	Categories         []CategoryUsage `json:"categories"`
	CustomCandidates   []CategoryUsage `json:"custom_candidates"`
	AccountsByClass    []NameCount     `json:"accounts_by_class"`
	AccountsByCurrency []NameCount     `json:"accounts_by_currency"`
	AccountsByBank     []CategoryUsage `json:"accounts_by_bank"`
	UsersTotal         int64           `json:"users_total"`
	UsersWithBudget    int64           `json:"users_with_budget"`
	UsersOverBudget    int64           `json:"users_over_budget"`
	BudgetPct          float64         `json:"budget_pct"`
	OverBudgetPct      float64         `json:"over_budget_pct"`
}

// CategoryUsage is a name used by Users users (and Tx transactions in 90 days)
type CategoryUsage struct {
	Name  string `json:"name"`
	Users int64  `json:"users"`
	Tx    int64  `json:"tx"`
}

// CostReport: tokens and cost of the model, mail and server per active user
type CostReport struct {
	From              string       `json:"from"`
	Daily             MetricSeries `json:"daily"`
	Calls30d          float64      `json:"calls_30d"`
	TokensIn30d       float64      `json:"tokens_in_30d"`
	TokensOut30d      float64      `json:"tokens_out_30d"`
	PriceIn           string       `json:"price_in_usd_per_mtok"`
	PriceOut          string       `json:"price_out_usd_per_mtok"`
	PricesConfigured  bool         `json:"prices_configured"`
	LLMCost30d        string       `json:"llm_cost_usd_30d"`
	ServerMonthly     string       `json:"server_monthly_usd"`
	MAU               float64      `json:"mau"`
	CostPerActiveUser string       `json:"cost_per_active_user_usd"`
	MailsSent30d      float64      `json:"mails_sent_30d"`
	MailDailyQuota    int          `json:"mail_daily_quota"`
	MaxMailsDay30d    float64      `json:"max_mails_day_30d"`
}

// AdminUserFilter selects rows of the users table of the panel
type AdminUserFilter struct {
	// Segment: "", active7, active30, active90, inactive90, no_connection, broken
	Segment string
	Search  string
	Limit   uint64
	Offset  uint64
}

// Valid user segments
var adminSegments = map[string]bool{"": true, "active7": true, "active30": true, "active90": true,
	"inactive90": true, "no_connection": true, "broken": true}

// ValidSegment tells if the segment is known
func ValidSegment(segment string) bool { return adminSegments[segment] }

// AdminUserRow is a row of the users table: no amounts and no transactions, only counts
type AdminUserRow struct {
	ID                 string     `json:"id"`
	Name               string     `json:"name"`
	Email              string     `json:"email"`
	SignupAt           time.Time  `json:"signup_at"`
	LastActiveDay      *string    `json:"last_active_day"`
	ConnectionsOK      int64      `json:"connections_ok"`
	ConnectionsError   int64      `json:"connections_error"`
	LastEmailReadAt    *time.Time `json:"last_email_read_at"`
	AutoTx30d          int64      `json:"auto_tx_30d"`
	FounderEligible    bool       `json:"founder_eligible"`
	FounderConfirmedAt *time.Time `json:"founder_confirmed_at"`
}

// AdminUserPage is a page of the users table
type AdminUserPage struct {
	Total int64          `json:"total"`
	Rows  []AdminUserRow `json:"rows"`
}

// MetricPrices are the prices used to turn tokens into money (USD)
type MetricPrices struct {
	InPerMTok      decimal.Decimal
	OutPerMTok     decimal.Decimal
	ServerMonthly  decimal.Decimal
	MailDailyQuota int
}

// LLMCost is the cost of the tokens with the prices per million
func (p MetricPrices) LLMCost(tokensIn, tokensOut float64) decimal.Decimal {
	million := decimal.NewFromInt(1_000_000)
	in := decimal.NewFromFloat(tokensIn).Mul(p.InPerMTok).Div(million)
	out := decimal.NewFromFloat(tokensOut).Mul(p.OutPerMTok).Div(million)
	return in.Add(out)
}

// KeepCommonNames drops the names used by fewer than MinGroupUsers users (defense in depth over the SQL)
func KeepCommonNames(rows []CategoryUsage) []CategoryUsage {
	kept := make([]CategoryUsage, 0, len(rows))
	for _, row := range rows {
		if row.Users >= MinGroupUsers {
			kept = append(kept, row)
		}
	}
	return kept
}

// KeepCommonBanks is KeepCommonNames for the quality by bank
func KeepCommonBanks(rows []BankQuality) []BankQuality {
	kept := make([]BankQuality, 0, len(rows))
	for _, row := range rows {
		if row.Users >= MinGroupUsers {
			kept = append(kept, row)
		}
	}
	return kept
}

// Pct is 100·part/total rounded to one decimal (0 when total is 0)
func Pct(part, total float64) float64 {
	if total <= 0 {
		return 0
	}
	return float64(int64(part/total*1000+0.5)) / 10
}
