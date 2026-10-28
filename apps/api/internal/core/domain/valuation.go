package domain

import (
	"time"

	"github.com/shopspring/decimal"
)

// AccountValuation is what an investment account was worth at the end of a day (local date of
// the user), in the account currency. The balance of the account on a date is the last valuation
// on or before it plus the movements after it. Valuations are not income or expenses.
type AccountValuation struct {
	ID        uint64
	UserID    string
	AccountID uint64
	Date      time.Time // date only
	Value     decimal.Decimal
	Source    string // manual | import
	Note      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// MaxValuationNoteLength is the size of account_valuations.note
const MaxValuationNoteLength = 255

// Validate checks the valuation without the database: a positive or zero value, a date that is
// not in the future (today in UTC+14 at most, so no timezone is ahead of it) and a short note
func (v *AccountValuation) Validate(now time.Time) error {
	if v.AccountID == 0 || v.Date.IsZero() || v.Value.IsNegative() || len(v.Note) > MaxValuationNoteLength {
		return ErrInvalidValuation
	}
	latest := now.UTC().Add(14 * time.Hour)
	if v.Date.After(time.Date(latest.Year(), latest.Month(), latest.Day(), 0, 0, 0, 0, time.UTC)) {
		return ErrInvalidValuation
	}
	return nil
}

// InvestmentPerformance is how an investment account did in a period (amounts in its currency):
// Gain = ValueEnd − ValueStart − Contributions
type InvestmentPerformance struct {
	AccountID          uint64
	Name               string
	Currency           string
	ValueStart         decimal.Decimal // at the end of the day before the period
	ValueEnd           decimal.Decimal // at the end of the period (today at most)
	Contributions      decimal.Decimal // net money put in during the period
	Gain               decimal.Decimal
	ContributionsTotal decimal.Decimal // initial balance + every movement until the end
	MarketGainTotal    decimal.Decimal // ValueEnd − ContributionsTotal
	LastValuationDate  *time.Time
	LastValuationValue *decimal.Decimal
	// RateEnd converts the amounts to the user's base currency (nil if unknown)
	RateEnd *decimal.Decimal
}

// ValueEndBase is ValueEnd in the user's base currency at RateEnd (nil without a rate)
func (p InvestmentPerformance) ValueEndBase() *decimal.Decimal {
	if p.RateEnd == nil {
		return nil
	}
	v := p.ValueEnd.Mul(*p.RateEnd).Round(4)
	return &v
}

// GainPercent is Gain over what was at stake in the period (ValueStart + Contributions); nil when
// that is not positive
func (p InvestmentPerformance) GainPercent() *decimal.Decimal {
	stake := p.ValueStart.Add(p.Contributions)
	if !stake.IsPositive() {
		return nil
	}
	pct := p.Gain.Div(stake).Mul(decimal.NewFromInt(100)).Round(2)
	return &pct
}
