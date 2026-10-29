package domain

import (
	"regexp"
	"time"

	"github.com/shopspring/decimal"
)

// DefaultCurrency is the currency of accounts and users that do not choose one
const DefaultCurrency = "COP"

var currencyCodeRe = regexp.MustCompile(`^[A-Z]{3}$`)

// IsCurrencyCode reports whether code looks like an ISO 4217 code (it may still not be supported)
func IsCurrencyCode(code string) bool {
	return currencyCodeRe.MatchString(code)
}

// Currency is a supported ISO 4217 currency (table currencies)
type Currency struct {
	Code       string
	Name       string
	Symbol     string
	MinorUnits int
}

// FxQuote is the rate 1 From = Rate To on Date (the last rate on or before Date).
// Rate and Source are nil when there is no rate for that pair.
type FxQuote struct {
	From   string
	To     string
	Date   time.Time
	Rate   *decimal.Decimal
	Source *string
}

// NetWorthAccount is the value of one account today: its native balance, the same balance in
// the user's base currency at today's rate, what it cost in base currency (initial balance at
// the rate of its creation day plus the amount_base of every transaction) and the difference.
// Rate, BaseValue, Cost and UnrealizedGain are nil when a rate is missing.
type NetWorthAccount struct {
	AccountID      uint64
	Name           string
	Bank           string
	LastFourDigits string
	TypeID         uint64
	Currency       string
	Balance        decimal.Decimal
	Rate           *decimal.Decimal
	BaseValue      *decimal.Decimal
	Cost           *decimal.Decimal
	UnrealizedGain *decimal.Decimal
	// MarketGain: investments only, value − contributions in the account currency (valuations)
	MarketGain *decimal.Decimal
	// FxGain: the part of UnrealizedGain due to exchange rates (UnrealizedGain − MarketGain × Rate),
	// in the base currency; set by Summarize
	FxGain *decimal.Decimal
}

// NetWorth is the user's net worth today in their base currency
type NetWorth struct {
	BaseCurrency   string
	Date           time.Time
	Accounts       []NetWorthAccount
	Total          decimal.Decimal // sum of the BaseValue that are known
	UnrealizedGain decimal.Decimal // sum of the UnrealizedGain that are known
	// UnrealizedGain split: MarketGain (valuations of investments, at today's rate) and FxGain
	// (exchange rate movements: the rest)
	MarketGain decimal.Decimal
	FxGain     decimal.Decimal
	// Total split by account class (BaseValue that are known): deposits (cash in accounts),
	// investments and credit (cards: usually negative)
	CashTotal        decimal.Decimal
	InvestmentsTotal decimal.Decimal
	CreditTotal      decimal.Decimal
	MissingRates     bool // some account could not be valued
}

// Summarize fills Total, UnrealizedGain and MissingRates from Accounts
func (n *NetWorth) Summarize() {
	n.Total, n.UnrealizedGain, n.MissingRates = decimal.Zero, decimal.Zero, false
	n.MarketGain = decimal.Zero
	n.CashTotal, n.InvestmentsTotal, n.CreditTotal = decimal.Zero, decimal.Zero, decimal.Zero
	for i := range n.Accounts {
		a := &n.Accounts[i]
		if a.UnrealizedGain != nil {
			fxGain := *a.UnrealizedGain
			if a.MarketGain != nil && a.Rate != nil {
				market := a.MarketGain.Mul(*a.Rate).Round(4)
				n.MarketGain = n.MarketGain.Add(market)
				fxGain = fxGain.Sub(market)
			}
			a.FxGain = &fxGain
		}
		if a.BaseValue == nil {
			n.MissingRates = true
		} else {
			n.Total = n.Total.Add(*a.BaseValue)
			switch AccountClassOf(a.TypeID) {
			case AccountClassInvestment:
				n.InvestmentsTotal = n.InvestmentsTotal.Add(*a.BaseValue)
			case AccountClassCredit:
				n.CreditTotal = n.CreditTotal.Add(*a.BaseValue)
			default:
				n.CashTotal = n.CashTotal.Add(*a.BaseValue)
			}
		}
		if a.UnrealizedGain != nil {
			n.UnrealizedGain = n.UnrealizedGain.Add(*a.UnrealizedGain)
		}
	}
	n.FxGain = n.UnrealizedGain.Sub(n.MarketGain)
}

// Transfer moves money between two accounts of the same user: an expense of AmountSent in the
// origin account and an income of AmountReceived in the destination, linked by the same
// transfer_group_id. When both accounts share a currency both amounts must be equal.
type Transfer struct {
	UserID         string
	FromAccountID  uint64
	ToAccountID    uint64
	AmountSent     decimal.Decimal
	AmountReceived decimal.Decimal
	Date           time.Time
	Description    string
	CategoryID     uint64

	// filled when created
	GroupID      string
	Out          Transaction // expense in the origin account
	In           Transaction // income in the destination account
	FromCurrency string
	ToCurrency   string
	// MarketRate is the market rate 1 FromCurrency = MarketRate ToCurrency that day (nil if unknown)
	MarketRate *decimal.Decimal
}

// Validate checks the amounts and accounts that do not need the database
func (t *Transfer) Validate() error {
	if t.FromAccountID == 0 || t.ToAccountID == 0 || t.FromAccountID == t.ToAccountID {
		return ErrInvalidTransfer
	}
	if !t.AmountSent.IsPositive() || !t.AmountReceived.IsPositive() {
		return ErrInvalidTransfer
	}
	return nil
}

// EffectiveRate is how many destination units each origin unit bought (AmountReceived / AmountSent)
func (t *Transfer) EffectiveRate() decimal.Decimal {
	return t.AmountReceived.DivRound(t.AmountSent, 12)
}
