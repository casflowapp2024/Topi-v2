package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// PaymentRepository implements port.PaymentRepository on payments
type PaymentRepository struct {
	db *postgres.DB
}

// NewPaymentRepository creates a new PaymentRepository instance
func NewPaymentRepository(db *postgres.DB) *PaymentRepository {
	return &PaymentRepository{db: db}
}

const paymentColumns = `id::text, user_id, provider, provider_ref, checkout_ref, kind, amount::text, currency, status,
raw_status, approved_at, receipt_enqueued_at, created_at, updated_at`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanPayment(row rowScanner) (*domain.Payment, error) {
	var p domain.Payment
	var amount *decimal.Decimal
	if err := row.Scan(&p.ID, &p.UserID, &p.Provider, &p.ProviderRef, &p.CheckoutRef, &p.Kind, scanDecimal(&amount),
		&p.Currency, &p.Status, &p.RawStatus, &p.ApprovedAt, &p.ReceiptEnqueuedAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	if amount != nil {
		p.Amount = *amount
	}
	return &p, nil
}

// validPaymentID: a malformed id is simply not found (and never reaches the uuid cast)
func validPaymentID(id string) bool {
	_, err := uuid.Parse(id)
	return err == nil
}

// Create inserts a payment and returns it with its id
func (r *PaymentRepository) Create(ctx context.Context, p domain.Payment) (*domain.Payment, error) {
	return scanPayment(r.db.QueryRow(ctx, `INSERT INTO payments (user_id, provider, kind, amount, currency, status)
VALUES ($1, $2, $3, $4::numeric, $5, $6) RETURNING `+paymentColumns,
		p.UserID, p.Provider, p.Kind, p.Amount.String(), p.Currency, p.Status))
}

// SetCheckoutRef stores the provider checkout (preference) of the payment
func (r *PaymentRepository) SetCheckoutRef(ctx context.Context, id, checkoutRef string) error {
	if !validPaymentID(id) {
		return domain.ErrDataNotFound
	}
	_, err := r.db.Exec(ctx, `UPDATE payments SET checkout_ref = $2, updated_at = now() WHERE id = $1::uuid`, id, checkoutRef)
	return mappers.MapPostgresErrorCode(err)
}

// Get returns a payment by id
func (r *PaymentRepository) Get(ctx context.Context, id string) (*domain.Payment, error) {
	if !validPaymentID(id) {
		return nil, domain.ErrDataNotFound
	}
	return scanPayment(r.db.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE id = $1::uuid`, id))
}

// GetForUser returns a payment only if it belongs to the user
func (r *PaymentRepository) GetForUser(ctx context.Context, userID, id string) (*domain.Payment, error) {
	if !validPaymentID(id) {
		return nil, domain.ErrDataNotFound
	}
	return scanPayment(r.db.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE id = $1::uuid AND user_id = $2`,
		id, userID))
}

// Apply locks the payment (FOR UPDATE: the webhook and the thanks page can arrive together) and applies the
// provider payment with domain.DecidePayment. A provider reference already stored in another row is ignored.
func (r *PaymentRepository) Apply(ctx context.Context, paymentID string, pp domain.ProviderPayment) (*port.PaymentApplied, error) {
	if !validPaymentID(paymentID) {
		return nil, domain.ErrDataNotFound
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := scanPayment(tx.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE id = $1::uuid FOR UPDATE`,
		paymentID))
	if err != nil {
		return nil, err
	}

	// the same provider payment already stored in another row (a second payment of the checkout)
	var other string
	err = tx.QueryRow(ctx, `SELECT id::text FROM payments WHERE provider = $1 AND provider_ref = $2 AND id <> $3::uuid`,
		current.Provider, pp.Ref, current.ID).Scan(&other)
	switch {
	case err == nil:
		applied, err := r.applyTo(ctx, tx, other, pp)
		if err != nil {
			return nil, err
		}
		if err = tx.Commit(ctx); err != nil {
			return nil, err
		}
		return applied, nil
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, mappers.MapPostgresErrorCode(err)
	}

	result := &port.PaymentApplied{Payment: *current}
	switch domain.DecidePayment(*current, pp) {
	case domain.PaymentIgnore:
		return result, nil
	case domain.PaymentInsert:
		inserted, err := scanPayment(tx.QueryRow(ctx, `INSERT INTO payments
  (user_id, provider, provider_ref, checkout_ref, kind, amount, currency, status, raw_status, approved_at)
VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, $8::text, $9, CASE WHEN $8::text = 'approved' THEN now() END)
RETURNING `+paymentColumns,
			current.UserID, current.Provider, pp.Ref, current.CheckoutRef, current.Kind, pp.Amount.String(),
			pp.Currency, pp.Status, pp.RawStatus))
		if err != nil {
			return nil, err
		}
		result = &port.PaymentApplied{Payment: *inserted, Approved: inserted.Status == domain.PaymentApproved}
	case domain.PaymentUpdate:
		updated, err := updatePayment(ctx, tx, current.ID, pp)
		if err != nil {
			return nil, err
		}
		result = &port.PaymentApplied{Payment: *updated,
			Approved: current.Status != domain.PaymentApproved && updated.Status == domain.PaymentApproved}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

// applyTo applies the provider payment to the row that already holds its reference (inside the transaction)
func (r *PaymentRepository) applyTo(ctx context.Context, tx pgx.Tx, id string, pp domain.ProviderPayment) (*port.PaymentApplied, error) {
	current, err := scanPayment(tx.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE id = $1::uuid FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}
	// the row is the payment of that reference: DecidePayment compares against it as its own
	pp.ExternalReference = current.ID
	if domain.DecidePayment(*current, pp) != domain.PaymentUpdate {
		return &port.PaymentApplied{Payment: *current}, nil
	}
	updated, err := updatePayment(ctx, tx, current.ID, pp)
	if err != nil {
		return nil, err
	}
	return &port.PaymentApplied{Payment: *updated,
		Approved: current.Status != domain.PaymentApproved && updated.Status == domain.PaymentApproved}, nil
}

func updatePayment(ctx context.Context, tx pgx.Tx, id string, pp domain.ProviderPayment) (*domain.Payment, error) {
	return scanPayment(tx.QueryRow(ctx, `UPDATE payments SET provider_ref = $2, status = $3::text, raw_status = $4,
  approved_at = CASE WHEN $3::text = 'approved' THEN COALESCE(approved_at, now()) ELSE approved_at END,
  updated_at = now()
WHERE id = $1::uuid RETURNING `+paymentColumns, id, pp.Ref, pp.Status, pp.RawStatus))
}

// MarkReceiptEnqueued records that the receipt is in email_outbox
func (r *PaymentRepository) MarkReceiptEnqueued(ctx context.Context, id string) error {
	if !validPaymentID(id) {
		return domain.ErrDataNotFound
	}
	_, err := r.db.Exec(ctx, `UPDATE payments SET receipt_enqueued_at = COALESCE(receipt_enqueued_at, now())
WHERE id = $1::uuid`, id)
	return mappers.MapPostgresErrorCode(err)
}

// Money: approved support payments by month (America/Bogota) since from, totals and the latest payments
// (short user id, no emails)
func (r *PaymentRepository) Money(ctx context.Context, from time.Time, recent int) (*domain.MoneyReport, error) {
	report := &domain.MoneyReport{Months: []domain.MoneyMonth{}, Recent: []domain.MoneyPayment{}, Total: "0"}

	if err := r.db.QueryRow(ctx, `SELECT COALESCE(sum(amount), 0)::text, count(*), count(DISTINCT user_id),
  (SELECT count(*) FROM payments WHERE status IN ('created', 'pending') AND kind = 'support'
     AND created_at >= now() - interval '7 days')
FROM payments WHERE status = 'approved' AND kind = 'support'`).Scan(
		&report.Total, &report.Payments, &report.Supporters, &report.Pending); err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	rows, err := r.db.Query(ctx, `SELECT to_char(date_trunc('month', approved_at AT TIME ZONE 'America/Bogota'), 'YYYY-MM'),
  count(*), count(DISTINCT user_id), sum(amount)::text
FROM payments WHERE status = 'approved' AND kind = 'support' AND approved_at >= $1
GROUP BY 1 ORDER BY 1 DESC`, from)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	for rows.Next() {
		var m domain.MoneyMonth
		if err = rows.Scan(&m.Month, &m.Payments, &m.Supporters, &m.Amount); err != nil {
			rows.Close()
			return nil, err
		}
		report.Months = append(report.Months, m)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}

	rows, err = r.db.Query(ctx, `SELECT id::text, left(user_id, 8), kind, amount::text, currency, status, created_at
FROM payments WHERE status <> 'created' OR created_at >= now() - interval '1 day'
ORDER BY created_at DESC LIMIT $1`, recent)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.MoneyPayment
		if err = rows.Scan(&p.ID, &p.UserShort, &p.Kind, &p.Amount, &p.Currency, &p.Status, &p.CreatedAt); err != nil {
			return nil, err
		}
		report.Recent = append(report.Recent, p)
	}
	return report, rows.Err()
}
