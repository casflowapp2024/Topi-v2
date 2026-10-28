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

// valuationColumns are scanned by scanValuation, in this order
const valuationColumns = "id, user_id, account_id, valuation_date, value::text, source, note, created_at, updated_at"

// ValuationRepository implements port.ValuationRepository (tables account_valuations and the
// function investment_performance, migration 000029)
type ValuationRepository struct {
	db *postgres.DB
}

// NewValuationRepository creates a new valuation repository instance
func NewValuationRepository(db *postgres.DB) *ValuationRepository {
	return &ValuationRepository{db}
}

type valuationScanner interface {
	Scan(dest ...any) error
}

func scanValuation(row valuationScanner, v *domain.AccountValuation) error {
	var value *decimal.Decimal
	if err := row.Scan(&v.ID, &v.UserID, &v.AccountID, &v.Date, scanDecimal(&value), &v.Source, &v.Note,
		&v.CreatedAt, &v.UpdatedAt); err != nil {
		return err
	}
	if value != nil {
		v.Value = *value
	}
	return nil
}

// mapValuationError turns the checks of account_valuations_check into domain errors
func mapValuationError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.ConstraintName {
		case "account_valuations_investment":
			return domain.ErrNotInvestmentAccount
		case "account_valuations_after_creation":
			return domain.ErrValuationBeforeAccount
		}
	}
	return mappers.MapPostgresErrorCode(err)
}

func (vr *ValuationRepository) ListValuations(ctx context.Context, userID string, accountID uint64) ([]domain.AccountValuation, error) {
	valuations := make([]domain.AccountValuation, 0)
	rows, err := vr.db.Query(ctx, `
		SELECT `+valuationColumns+` FROM account_valuations
		WHERE user_id = $1 AND account_id = $2
		ORDER BY valuation_date DESC`, userID, accountID)
	if err != nil {
		return valuations, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var v domain.AccountValuation
		if err = scanValuation(rows, &v); err != nil {
			return valuations, err
		}
		valuations = append(valuations, v)
	}
	return valuations, mappers.MapPostgresErrorCode(rows.Err())
}

func (vr *ValuationRepository) UpsertValuation(ctx context.Context, v *domain.AccountValuation) error {
	err := scanValuation(vr.db.QueryRow(ctx, `
		INSERT INTO account_valuations (user_id, account_id, valuation_date, value, source, note)
		VALUES ($1, $2, $3::date, $4::numeric, $5, $6)
		ON CONFLICT (account_id, valuation_date) DO UPDATE
		  SET value = EXCLUDED.value, source = EXCLUDED.source, note = EXCLUDED.note
		  WHERE account_valuations.user_id = EXCLUDED.user_id
		RETURNING `+valuationColumns,
		v.UserID, v.AccountID, v.Date.Format(time.DateOnly), v.Value.String(), v.Source, v.Note), v)
	return mapValuationError(err)
}

func (vr *ValuationRepository) DeleteValuation(ctx context.Context, userID string, accountID, id uint64) error {
	tag, err := vr.db.Exec(ctx,
		"DELETE FROM account_valuations WHERE id = $1 AND account_id = $2 AND user_id = $3", id, accountID, userID)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}
	return nil
}

func (vr *ValuationRepository) GetInvestmentPerformance(
	ctx context.Context,
	userID string,
	start, end time.Time,
) ([]domain.InvestmentPerformance, error) {
	out := make([]domain.InvestmentPerformance, 0)
	rows, err := vr.db.Query(ctx, `
		SELECT account_id, account_name, currency, value_start::text, value_end::text, contributions::text,
		       gain::text, contributions_total::text, market_gain_total::text, last_valuation_date,
		       last_valuation_value::text, rate_end::text
		FROM investment_performance($1, $2::date, $3::date)`,
		userID, start.Format(time.DateOnly), end.Format(time.DateOnly))
	if err != nil {
		return out, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			p                                         domain.InvestmentPerformance
			valueStart, valueEnd, contributions, gain *decimal.Decimal
			contributionsTotal, marketGainTotal       *decimal.Decimal
		)
		if err = rows.Scan(&p.AccountID, &p.Name, &p.Currency, scanDecimal(&valueStart), scanDecimal(&valueEnd),
			scanDecimal(&contributions), scanDecimal(&gain), scanDecimal(&contributionsTotal),
			scanDecimal(&marketGainTotal), &p.LastValuationDate, scanDecimal(&p.LastValuationValue),
			scanDecimal(&p.RateEnd)); err != nil {
			return out, err
		}
		for dst, src := range map[*decimal.Decimal]*decimal.Decimal{
			&p.ValueStart: valueStart, &p.ValueEnd: valueEnd, &p.Contributions: contributions, &p.Gain: gain,
			&p.ContributionsTotal: contributionsTotal, &p.MarketGainTotal: marketGainTotal,
		} {
			if src != nil {
				*dst = *src
			}
		}
		out = append(out, p)
	}
	return out, mappers.MapPostgresErrorCode(rows.Err())
}
