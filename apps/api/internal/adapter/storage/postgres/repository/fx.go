package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"time"

	"github.com/shopspring/decimal"
)

// FxRepository implements port.FxRepository: currencies, exchange rates and net worth
// (functions of migrations 000023 and 000026).
type FxRepository struct {
	db *postgres.DB
}

func NewFxRepository(db *postgres.DB) *FxRepository {
	return &FxRepository{db}
}

// ListCurrencies returns the active currencies ordered by code
func (fr *FxRepository) ListCurrencies(ctx context.Context) ([]domain.Currency, error) {
	rows, err := fr.db.Query(ctx,
		"SELECT code, name, symbol, minor_units FROM currencies WHERE is_active ORDER BY code")
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	currencies := make([]domain.Currency, 0)
	for rows.Next() {
		var c domain.Currency
		if err = rows.Scan(&c.Code, &c.Name, &c.Symbol, &c.MinorUnits); err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}
		currencies = append(currencies, c)
	}
	return currencies, rows.Err()
}

// GetQuote returns 1 from = ? to on date (last rate on or before it); Rate is nil when unknown
func (fr *FxRepository) GetQuote(ctx context.Context, from, to string, date time.Time) (domain.FxQuote, error) {
	quote := domain.FxQuote{From: from, To: to, Date: date}
	err := fr.db.QueryRow(ctx,
		"SELECT fx_rate_at($1, $2, $3::date)::text, fx_rate_source_at($1, $2, $3::date)",
		from, to, date.Format("2006-01-02")).
		Scan(scanDecimal(&quote.Rate), &quote.Source)
	if err != nil {
		return quote, mappers.MapPostgresErrorCode(err)
	}
	return quote, nil
}

// GetNetWorth values every account of the user today in their base currency
func (fr *FxRepository) GetNetWorth(ctx context.Context, userID string) (domain.NetWorth, error) {
	netWorth := domain.NetWorth{Accounts: make([]domain.NetWorthAccount, 0)}
	err := fr.db.QueryRow(ctx,
		"SELECT user_base_currency($1), (now() at time zone user_timezone($1))::date", userID).
		Scan(&netWorth.BaseCurrency, &netWorth.Date)
	if err != nil {
		return netWorth, mappers.MapPostgresErrorCode(err)
	}

	rows, err := fr.db.Query(ctx, `
		SELECT account_id, account_name, coalesce(bank_name, ''), last_four_digits, type_id, currency,
		       balance::text, rate::text, base_value::text, cost::text, unrealized_gain::text
		FROM net_worth($1)`, userID)
	if err != nil {
		return netWorth, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			a       domain.NetWorthAccount
			balance *decimal.Decimal
		)
		if err = rows.Scan(&a.AccountID, &a.Name, &a.Bank, &a.LastFourDigits, &a.TypeID, &a.Currency,
			scanDecimal(&balance), scanDecimal(&a.Rate), scanDecimal(&a.BaseValue), scanDecimal(&a.Cost),
			scanDecimal(&a.UnrealizedGain)); err != nil {
			return netWorth, mappers.MapPostgresErrorCode(err)
		}
		if balance != nil {
			a.Balance = *balance
		}
		netWorth.Accounts = append(netWorth.Accounts, a)
	}
	if err = rows.Err(); err != nil {
		return netWorth, mappers.MapPostgresErrorCode(err)
	}

	netWorth.Summarize()
	return netWorth, nil
}
