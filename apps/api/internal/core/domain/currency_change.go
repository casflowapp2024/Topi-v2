package domain

import (
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// Modes to change the currency of an account that has transactions
const (
	// CurrencyChangeRelabel: the amounts were already in the new currency, only the label was
	// wrong. Rates and amount_base are recomputed (historical reports change).
	CurrencyChangeRelabel = "relabel"
	// CurrencyChangeConvert: the amounts were in the old currency. Each one is converted with the
	// rate of its date and amount_base stays (historical reports do not change).
	CurrencyChangeConvert = "convert"
)

// AccountCurrencyChange changes the currency of an account with transactions. With Apply false it
// is only a preview: the result fields say what would happen and nothing is stored.
type AccountCurrencyChange struct {
	ID          uint64 // set when applied
	UserID      string
	AccountID   uint64
	Mode        string
	OldCurrency string
	NewCurrency string
	Apply       bool
	CreatedAt   time.Time
	UndoneAt    *time.Time

	// result (in the preview, what applying would do)
	TxCount         int
	MissingRates    int // convert: rates not found (it cannot be applied); relabel: amounts left pending
	ReplacedRates   int // relabel: manual or transfer rates replaced by the market rate
	BalanceBefore   decimal.Decimal
	BalanceAfter    decimal.Decimal
	FlowsBaseBefore decimal.Decimal // signed sum of amount_base of the account
	FlowsBaseAfter  decimal.Decimal
}

// Normalize upper-cases the currency and validates what does not need the database
func (c *AccountCurrencyChange) Normalize() error {
	c.NewCurrency = strings.ToUpper(strings.TrimSpace(c.NewCurrency))
	if c.AccountID == 0 || !IsCurrencyCode(c.NewCurrency) {
		return ErrInvalidCurrency
	}
	if c.Mode != CurrencyChangeRelabel && c.Mode != CurrencyChangeConvert {
		return ErrInvalidCurrencyChangeMode
	}
	return nil
}

// BaseCurrencyChange changes the user's base currency: every amount_base is recomputed at the
// market rate of its date. With Apply false it is only a preview.
type BaseCurrencyChange struct {
	UserID      string
	NewCurrency string
	Apply       bool

	// result
	OldCurrency    string
	TxCount        int
	MissingRates   int // transactions left without amount_base until the rate arrives
	ReplacedRates  int // manual rates replaced by the market rate
	NetWorthBefore decimal.Decimal
	NetWorthAfter  decimal.Decimal
}
