package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/shopspring/decimal"
)

// CurrencyChangeRepository implements port.CurrencyChangeRepository with the functions of
// migration 000030 (change_account_currency, undo_account_currency_change, change_base_currency)
type CurrencyChangeRepository struct {
	db *postgres.DB
}

// NewCurrencyChangeRepository creates a new currency change repository instance
func NewCurrencyChangeRepository(db *postgres.DB) *CurrencyChangeRepository {
	return &CurrencyChangeRepository{db}
}

// mapCurrencyChangeError turns the exceptions of the SQL functions into domain errors
func mapCurrencyChangeError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch {
		case pgErr.Code == "P0002": // no_data_found
			return domain.ErrDataNotFound
		case pgErr.ConstraintName == "currency_change_currency":
			return domain.ErrInvalidCurrency
		case pgErr.ConstraintName == "currency_change_mode":
			return domain.ErrInvalidCurrencyChangeMode
		case pgErr.ConstraintName == "currency_change_missing_rates":
			return domain.ErrMissingFxRates
		case pgErr.ConstraintName == "currency_change_not_undoable":
			return domain.ErrCurrencyChangeNotUndoable
		}
	}
	return mappers.MapPostgresErrorCode(err)
}

// setDecimals copies the scanned values that are not NULL
func setDecimals(pairs map[*decimal.Decimal]*decimal.Decimal) {
	for dst, src := range pairs {
		if src != nil {
			*dst = *src
		}
	}
}

func (cr *CurrencyChangeRepository) ChangeAccountCurrency(ctx context.Context, c *domain.AccountCurrencyChange) error {
	var (
		changeID                        *uint64
		balanceBefore, balanceAfter     *decimal.Decimal
		flowsBaseBefore, flowsBaseAfter *decimal.Decimal
	)
	err := cr.db.QueryRow(ctx, `
		SELECT change_id, old_currency, tx_count, missing_rates, replaced_rates, balance_before::text,
		       balance_after::text, flows_base_before::text, flows_base_after::text
		FROM change_account_currency($1, $2, $3, $4, $5)`,
		c.UserID, c.AccountID, c.NewCurrency, c.Mode, c.Apply).
		Scan(&changeID, &c.OldCurrency, &c.TxCount, &c.MissingRates, &c.ReplacedRates, scanDecimal(&balanceBefore),
			scanDecimal(&balanceAfter), scanDecimal(&flowsBaseBefore), scanDecimal(&flowsBaseAfter))
	if err != nil {
		return mapCurrencyChangeError(err)
	}
	if changeID != nil {
		c.ID = *changeID
	}
	setDecimals(map[*decimal.Decimal]*decimal.Decimal{
		&c.BalanceBefore: balanceBefore, &c.FlowsBaseBefore: flowsBaseBefore,
	})
	c.BalanceAfter, c.FlowsBaseAfter = balanceAfter, flowsBaseAfter

	// lo que vale hoy en la moneda base antes y después (tasa de hoy)
	var rateBefore, rateAfter *decimal.Decimal
	err = cr.db.QueryRow(ctx, `
		WITH t AS (SELECT user_base_currency($1) AS base, (now() AT TIME ZONE user_timezone($1))::date AS day)
		SELECT t.base, fx_rate_at($2, t.base, t.day)::text, fx_rate_at($3, t.base, t.day)::text FROM t`,
		c.UserID, c.OldCurrency, c.NewCurrency).Scan(&c.BaseCurrency, scanDecimal(&rateBefore), scanDecimal(&rateAfter))
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if rateBefore != nil {
		v := c.BalanceBefore.Mul(*rateBefore).Round(4)
		c.BalanceBeforeBase = &v
	}
	if rateAfter != nil && c.BalanceAfter != nil {
		v := c.BalanceAfter.Mul(*rateAfter).Round(4)
		c.BalanceAfterBase = &v
	}
	return nil
}

func (cr *CurrencyChangeRepository) ListAccountCurrencyChanges(
	ctx context.Context,
	userID string,
	accountID uint64,
) ([]domain.AccountCurrencyChange, error) {
	changes := make([]domain.AccountCurrencyChange, 0)
	rows, err := cr.db.Query(ctx, `
		SELECT id, user_id, account_id, mode, old_currency, new_currency, created_at, undone_at
		FROM account_currency_changes
		WHERE user_id = $1 AND account_id = $2
		ORDER BY created_at DESC, id DESC`, userID, accountID)
	if err != nil {
		return changes, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var c domain.AccountCurrencyChange
		if err = rows.Scan(&c.ID, &c.UserID, &c.AccountID, &c.Mode, &c.OldCurrency, &c.NewCurrency,
			&c.CreatedAt, &c.UndoneAt); err != nil {
			return changes, err
		}
		changes = append(changes, c)
	}
	return changes, mappers.MapPostgresErrorCode(rows.Err())
}

func (cr *CurrencyChangeRepository) UndoAccountCurrencyChange(ctx context.Context, userID string, accountID, changeID uint64) error {
	var found bool
	if err := cr.db.QueryRow(ctx,
		"SELECT EXISTS (SELECT 1 FROM account_currency_changes WHERE id = $1 AND account_id = $2 AND user_id = $3)",
		changeID, accountID, userID).Scan(&found); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if !found {
		return domain.ErrDataNotFound
	}
	_, err := cr.db.Exec(ctx, "SELECT undo_account_currency_change($1, $2)", userID, changeID)
	return mapCurrencyChangeError(err)
}

func (cr *CurrencyChangeRepository) ChangeBaseCurrency(ctx context.Context, c *domain.BaseCurrencyChange) error {
	var before, after *decimal.Decimal
	err := cr.db.QueryRow(ctx, `
		SELECT old_currency, tx_count, missing_rates, replaced_rates, net_worth_before::text, net_worth_after::text
		FROM change_base_currency($1, $2, $3)`, c.UserID, c.NewCurrency, c.Apply).
		Scan(&c.OldCurrency, &c.TxCount, &c.MissingRates, &c.ReplacedRates, scanDecimal(&before), scanDecimal(&after))
	if err != nil {
		return mapCurrencyChangeError(err)
	}
	setDecimals(map[*decimal.Decimal]*decimal.Decimal{&c.NetWorthBefore: before, &c.NetWorthAfter: after})
	return nil
}

func (cr *CurrencyChangeRepository) SetAccountClosed(
	ctx context.Context,
	userID string,
	accountID uint64,
	closed bool,
) (*time.Time, error) {
	var closedAt *time.Time
	err := cr.db.QueryRow(ctx, `
		UPDATE accounts SET closed_at = CASE WHEN $3 THEN COALESCE(closed_at, now()) END, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING closed_at`, accountID, userID, closed).Scan(&closedAt)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	return closedAt, nil
}
