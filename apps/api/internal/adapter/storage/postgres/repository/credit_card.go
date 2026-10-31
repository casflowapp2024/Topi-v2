package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/shopspring/decimal"
)

// cardChargeCategories are created for the user with the first card terms (if no category with
// that name exists): card interest and fees are expenses, not transfers. name → emoji (unified code).
var cardChargeCategories = []struct{ name, emoji string }{
	{"Intereses", "1f4b8"},
	{"Comisiones", "1f9fe"},
}

// CreditCardRepository implements port.CreditCardRepository (credit_card_details and the function
// credit_card_status, migration 000032)
type CreditCardRepository struct {
	db *postgres.DB
}

// NewCreditCardRepository creates a new credit card repository instance
func NewCreditCardRepository(db *postgres.DB) *CreditCardRepository {
	return &CreditCardRepository{db}
}

func (cr *CreditCardRepository) GetCreditCard(ctx context.Context, userID string, accountID uint64) (*domain.CreditCardDetails, error) {
	d := &domain.CreditCardDetails{AccountID: accountID, UserID: userID}
	var limit, rate *decimal.Decimal
	err := cr.db.QueryRow(ctx, `
		SELECT d.credit_limit::text, d.statement_day, d.due_day, d.interest_rate_ea::text
		FROM accounts a
		JOIN account_types t ON t.id = a.type_id AND t.class = 'credit'
		LEFT JOIN credit_card_details d ON d.account_id = a.id
		WHERE a.id = $1 AND a.user_id = $2`, accountID, userID).
		Scan(scanDecimal(&limit), &d.StatementDay, &d.DueDay, scanDecimal(&rate))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotCreditAccount
	}
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	d.CreditLimit, d.InterestRateEA = limit, rate
	return d, nil
}

func (cr *CreditCardRepository) SaveCreditCard(ctx context.Context, d *domain.CreditCardDetails) error {
	tx, err := cr.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(ctx, `
		INSERT INTO credit_card_details (account_id, user_id, credit_limit, statement_day, due_day, interest_rate_ea)
		VALUES ($1, $2, $3::numeric, $4, $5, $6::numeric)
		ON CONFLICT (account_id) DO UPDATE SET
		  credit_limit = EXCLUDED.credit_limit, statement_day = EXCLUDED.statement_day,
		  due_day = EXCLUDED.due_day, interest_rate_ea = EXCLUDED.interest_rate_ea
		WHERE credit_card_details.user_id = EXCLUDED.user_id`,
		d.AccountID, d.UserID, decimalText(d.CreditLimit), d.StatementDay, d.DueDay, decimalText(d.InterestRateEA))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "credit_card_details_credit" {
			return domain.ErrNotCreditAccount
		}
		return mappers.MapPostgresErrorCode(err)
	}
	for _, c := range cardChargeCategories {
		if _, err = tx.Exec(ctx, `
			INSERT INTO categories (user_id, name, budget, emoji, income)
			SELECT $1::varchar, $2::varchar, 0, $3::varchar, false
			WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id = $1 AND lower(name) = lower($2))`,
			d.UserID, c.name, c.emoji); err != nil {
			return mappers.MapPostgresErrorCode(err)
		}
	}
	return mappers.MapPostgresErrorCode(tx.Commit(ctx))
}

func (cr *CreditCardRepository) ListCreditCardStatus(ctx context.Context, userID string) ([]domain.CreditCardStatus, error) {
	out := make([]domain.CreditCardStatus, 0)
	rows, err := cr.db.Query(ctx, `
		SELECT account_id, account_name, currency, credit_limit::text, statement_day, due_day, interest_rate_ea::text,
		       debt::text, available::text, last_statement, next_statement, due_date, statement_debt::text,
		       paid_since_statement::text, pending_statement::text, purchases_since::text, installment_purchases
		FROM credit_card_status($1)`, userID)
	if err != nil {
		return out, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			s    domain.CreditCardStatus
			debt *decimal.Decimal
		)
		var last, next, due *time.Time
		if err = rows.Scan(&s.AccountID, &s.Name, &s.Currency, scanDecimal(&s.CreditLimit), &s.StatementDay, &s.DueDay,
			scanDecimal(&s.InterestRateEA), scanDecimal(&debt), scanDecimal(&s.Available), &last, &next, &due,
			scanDecimal(&s.StatementDebt), scanDecimal(&s.PaidSinceStatement), scanDecimal(&s.PendingStatement),
			scanDecimal(&s.PurchasesSince), &s.InstallmentPurchases); err != nil {
			return out, err
		}
		s.UserID = userID
		if debt != nil {
			s.Debt = *debt
		}
		s.LastStatement, s.NextStatement, s.DueDate = last, next, due
		out = append(out, s)
	}
	return out, mappers.MapPostgresErrorCode(rows.Err())
}

// ListCreditCardCycles returns the last statements of a card, oldest first
func (cr *CreditCardRepository) ListCreditCardCycles(ctx context.Context, userID string, accountID uint64) ([]domain.CreditCardCycle, error) {
	out := make([]domain.CreditCardCycle, 0)
	rows, err := cr.db.Query(ctx, `
		SELECT statement_date, purchases::text, payments::text, counted
		FROM credit_card_cycles($1, $2)`, userID, accountID)
	if err != nil {
		return out, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			c                   domain.CreditCardCycle
			purchases, payments *decimal.Decimal
		)
		if err = rows.Scan(&c.StatementDate, scanDecimal(&purchases), scanDecimal(&payments), &c.Counted); err != nil {
			return out, err
		}
		c.Purchases, c.Payments = *purchases, *payments
		out = append(out, c)
	}
	return out, mappers.MapPostgresErrorCode(rows.Err())
}
