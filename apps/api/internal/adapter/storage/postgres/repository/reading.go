package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ReadingRepository implements port.ReadingRepository (plan/27 §B and §C)
type ReadingRepository struct {
	db *postgres.DB
}

// NewReadingRepository creates a new ReadingRepository instance
func NewReadingRepository(db *postgres.DB) *ReadingRepository {
	return &ReadingRepository{db: db}
}

// ConnectionStatuses: per connection, counts of processed emails and automatic transactions of the accounts
// linked to it, and the banks of those accounts
func (r *ReadingRepository) ConnectionStatuses(ctx context.Context, userID string) ([]domain.ConnectionStatus, error) {
	rows, err := r.db.Query(ctx, `SELECT e.id, e.provider, e.active, coalesce(e.error, ''), e.error_at, e.created_at,
  (SELECT max(p.created_at) FROM processed_emails p WHERE p.email_id = e.id),
  (SELECT count(*) FROM processed_emails p WHERE p.email_id = e.id),
  (SELECT count(*) FROM accounts a WHERE a.email_id = e.id AND a.user_id = e.user_id),
  (SELECT count(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.email_id = e.id AND a.user_id = e.user_id AND t.automated),
  (SELECT max(t.created_at) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.email_id = e.id AND a.user_id = e.user_id AND t.automated)
FROM emails e WHERE e.user_id = $1 ORDER BY e.id`, userID)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	statuses := []domain.ConnectionStatus{}
	index := map[uint64]int{}
	for rows.Next() {
		var c domain.ConnectionStatus
		if err = rows.Scan(&c.ID, &c.Provider, &c.Active, &c.Error, &c.ErrorAt, &c.ConnectedAt, &c.LastReadAt,
			&c.EmailsProcessed, &c.LinkedAccounts, &c.TransactionsCreated, &c.LastTransactionAt); err != nil {
			rows.Close()
			return nil, err
		}
		c.Banks = []domain.ConnectionBank{}
		index[c.ID] = len(statuses)
		statuses = append(statuses, c)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// the last priority read of each connection (plan/31): its jobs, one per sender, started together
	jobs, err := r.db.Query(ctx, `WITH recent AS (
  SELECT (payload->>'email_id')::bigint AS email_id, status, progress, created_at, updated_at
  FROM email_jobs
  WHERE priority = 1 AND created_at > now() - interval '24 hours' AND payload->>'user_id' = $1
), last AS (SELECT email_id, max(created_at) AS at FROM recent GROUP BY email_id)
SELECT r.email_id, count(*),
  count(*) FILTER (WHERE r.status = 'running'), count(*) FILTER (WHERE r.status = 'pending'),
  count(*) FILTER (WHERE r.status = 'failed'),
  coalesce(sum((r.progress->>'listed')::bigint), 0), coalesce(sum((r.progress->>'processed')::bigint), 0),
  coalesce(sum((r.progress->>'created')::bigint), 0), max(r.updated_at)
FROM recent r JOIN last l ON l.email_id = r.email_id AND r.created_at >= l.at - interval '5 minutes'
GROUP BY r.email_id`, userID)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	for jobs.Next() {
		var emailID uint64
		var f domain.ReadingJobFacts
		if err = jobs.Scan(&emailID, &f.Jobs, &f.Running, &f.Pending, &f.Failed, &f.Listed, &f.Processed, &f.Created,
			&f.LastUpdate); err != nil {
			jobs.Close()
			return nil, err
		}
		if i, ok := index[emailID]; ok {
			statuses[i].Job = domain.NewReadingJob(f)
		}
	}
	jobs.Close()
	if err = jobs.Err(); err != nil {
		return nil, err
	}

	// per bank: its senders, what their first reads found and the automatic transactions of its accounts here
	banks, err := r.db.Query(ctx, `SELECT l.email_id, b.id, b.name, bank_effective_senders(b.catalog_id, b.email),
  coalesce(s.read_senders, 0), coalesce(s.legacy, 0), coalesce(s.found, 0),
  (SELECT count(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.email_id = l.email_id AND a.bank_id = b.id AND a.user_id = l.user_id AND t.automated),
  ARRAY(SELECT a.id FROM accounts a WHERE a.email_id = l.email_id AND a.bank_id = b.id AND a.user_id = l.user_id
        ORDER BY a.id)
FROM (SELECT DISTINCT email_id, bank_id, user_id FROM accounts WHERE user_id = $1 AND email_id IS NOT NULL) l
JOIN banks b ON b.id = l.bank_id
LEFT JOIN LATERAL (
  SELECT count(*) AS read_senders, count(*) FILTER (WHERE st.first_read_at IS NULL) AS legacy,
         sum(coalesce(st.first_found, 0)) AS found
  FROM email_sync_state st
  WHERE st.email_id = l.email_id
    AND lower(st.sender_email) = ANY (SELECT lower(trim(x)) FROM unnest(string_to_array(bank_effective_senders(b.catalog_id, b.email), ',')) AS x)
) s ON true
ORDER BY b.name`, userID)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer banks.Close()
	for banks.Next() {
		var emailID uint64
		var bank domain.ConnectionBank
		var facts domain.BankReadFacts
		var accountIDs []int64
		if err = banks.Scan(&emailID, &bank.ID, &bank.Name, &bank.Sender, &facts.ReadSenders, &facts.LegacySender,
			&facts.Found, &facts.Transactions, &accountIDs); err != nil {
			return nil, err
		}
		bank.AccountIDs = make([]uint64, 0, len(accountIDs))
		for _, accountID := range accountIDs {
			bank.AccountIDs = append(bank.AccountIDs, uint64(accountID))
		}
		if i, ok := index[emailID]; ok {
			facts.Senders = countSenders(bank.Sender)
			bank.Supported = domain.IsSupportedBank(bank.Name)
			bank.Found = facts.Found
			bank.Reading = domain.ComputeBankReading(facts)
			statuses[i].Banks = append(statuses[i].Banks, bank)
		}
	}
	return statuses, banks.Err()
}

// countSenders: non empty addresses of a comma separated banks.email
func countSenders(raw string) int {
	n := 0
	for _, part := range strings.Split(raw, ",") {
		if strings.Contains(part, "@") {
			n++
		}
	}
	return n
}

// OnboardingFacts: the real state of the four steps of the checklist
func (r *ReadingRepository) OnboardingFacts(ctx context.Context, userID string) (domain.OnboardingFacts, error) {
	var f domain.OnboardingFacts
	err := r.db.QueryRow(ctx, `SELECT
  EXISTS (SELECT 1 FROM emails WHERE user_id = $1),
  EXISTS (SELECT 1 FROM transactions WHERE user_id = $1 AND automated),
  EXISTS (SELECT 1 FROM product_events WHERE user_id = $1 AND name = 'review_resolved'),
  (SELECT count(*) FROM transactions WHERE user_id = $1 AND (should_verify OR needs_counterpart))
    + (SELECT count(*) FROM transactions t WHERE t.user_id = $1 AND `+domain.NeedsInstallmentsSQL("$2", "$3")+`),
  EXISTS (SELECT 1 FROM categories WHERE user_id = $1 AND budget > 0)
    OR EXISTS (SELECT 1 FROM product_events WHERE user_id = $1 AND name = 'budget_created')`,
		userID, domain.InstallmentsFrom, domain.InstallmentPromptMin).Scan(
		&f.HasConnection, &f.HasAutoTx, &f.ReviewResolved, &f.PendingReview, &f.HasBudget)
	return f, mappers.MapPostgresErrorCode(err)
}

// RecordOnboardingSteps inserts the steps not recorded yet (unique index product_events_onboarding_step)
func (r *ReadingRepository) RecordOnboardingSteps(ctx context.Context, userID string, steps []string) ([]string, error) {
	if len(steps) == 0 {
		return nil, nil
	}
	rows, err := r.db.Query(ctx, `INSERT INTO product_events (user_id, name, props)
SELECT $1, 'onboarding_step_completed', jsonb_build_object('step', step) FROM unnest($2::text[]) AS step
ON CONFLICT (user_id, (props ->> 'step')) WHERE name = 'onboarding_step_completed' DO NOTHING
RETURNING props ->> 'step'`, userID, steps)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	var recorded []string
	for rows.Next() {
		var step string
		if err = rows.Scan(&step); err != nil {
			return nil, err
		}
		recorded = append(recorded, step)
	}
	return recorded, rows.Err()
}

// healthyWithoutTransactions is a connection that reads (active, no error), has linked accounts and none of
// them got an automatic transaction
const healthyWithoutTransactions = `e.active AND coalesce(e.error, '') = ''
  AND EXISTS (SELECT 1 FROM accounts a WHERE a.email_id = e.id AND a.user_id = e.user_id)
  AND NOT EXISTS (SELECT 1 FROM transactions t JOIN accounts a ON a.id = t.account_id
                  WHERE a.email_id = e.id AND a.user_id = e.user_id AND t.automated)`

// ClaimUnsupportedAlerts marks and returns the connections that are due for the bank_unsupported email. since (optional)
// leaves out the connections created before it: the old ones get a personal email from the panel instead.
func (r *ReadingRepository) ClaimUnsupportedAlerts(ctx context.Context, after time.Duration, since *time.Time, limit int) ([]domain.UnsupportedAlert, error) {
	rows, err := r.db.Query(ctx, `WITH due AS (
  SELECT e.id FROM emails e JOIN users u ON u.id = e.user_id
  WHERE e.unsupported_alert_at IS NULL
    AND e.created_at <= now() - make_interval(secs => $1)
    AND ($3::timestamptz IS NULL OR e.created_at >= $3::timestamptz)
    AND `+healthyWithoutTransactions+`
    AND coalesce(u.email_status, 'ok') NOT IN ('bounced', 'complained')
    AND COALESCE((SELECT p.email_connection_alerts FROM notification_prefs p WHERE p.user_id = e.user_id), true)
  ORDER BY e.id LIMIT $2
  FOR UPDATE OF e SKIP LOCKED
)
UPDATE emails e SET unsupported_alert_at = now()
FROM due, users u
WHERE e.id = due.id AND u.id = e.user_id
RETURNING e.id, e.user_id, u.email`, after.Seconds(), limit, since)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	alerts := []domain.UnsupportedAlert{}
	for rows.Next() {
		var a domain.UnsupportedAlert
		if err = rows.Scan(&a.EmailID, &a.UserID, &a.UserEmail); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

// StillUnsupported: checked again when the email is sent (it may have started reading meanwhile)
func (r *ReadingRepository) StillUnsupported(ctx context.Context, userID string, emailID uint64) (bool, error) {
	var still bool
	err := r.db.QueryRow(ctx, `SELECT `+healthyWithoutTransactions+` FROM emails e WHERE e.id = $1 AND e.user_id = $2`,
		emailID, userID).Scan(&still)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return still, mappers.MapPostgresErrorCode(err)
}

// OwnsBank: the bank row belongs to the user
func (r *ReadingRepository) OwnsBank(ctx context.Context, userID string, bankID uint64) (bool, error) {
	var owns bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM banks WHERE id = $1 AND user_id = $2)`, bankID, userID).Scan(&owns)
	return owns, mappers.MapPostgresErrorCode(err)
}
