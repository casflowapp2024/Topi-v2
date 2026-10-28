package domain

import (
	"time"

	"github.com/shopspring/decimal"
)

// TransferLink marks an existing transaction as one leg of a transfer between accounts of the
// same user. The other leg is either another existing transaction (CounterpartTransactionID) or a
// new one created in CounterpartAccountID. Linked legs leave income and expenses but keep their
// category, so budgets still see them.
type TransferLink struct {
	UserID        string
	TransactionID uint64

	// link with an existing transaction of the opposite direction...
	CounterpartTransactionID uint64
	// ...or create the other leg in this account
	CounterpartAccountID uint64
	// CounterpartAmount is the amount of the new leg in its account currency. Nil = the same amount
	// (same currency) or the amount at the market rate of the day (different currency).
	CounterpartAmount *decimal.Decimal

	// filled when linked
	GroupID     string
	Transaction Transaction
	Counterpart Transaction
}

// Validate checks the request without the database: exactly one kind of counterpart and a
// positive amount when one is given
func (l *TransferLink) Validate() error {
	if l.TransactionID == 0 {
		return ErrInvalidTransfer
	}
	byTransaction, byAccount := l.CounterpartTransactionID != 0, l.CounterpartAccountID != 0
	if byTransaction == byAccount || l.CounterpartTransactionID == l.TransactionID {
		return ErrInvalidTransfer
	}
	if l.CounterpartAmount != nil && (byTransaction || !l.CounterpartAmount.IsPositive()) {
		return ErrInvalidTransfer
	}
	return nil
}

// TransferCandidate is a pair of transactions that looks like a transfer between accounts of the
// user (view transfer_link_candidates): an expense in one account and an income in another
type TransferCandidate struct {
	OutTransactionID uint64
	InTransactionID  uint64
	OutAccountID     uint64
	InAccountID      uint64
	OutAmount        decimal.Decimal
	InAmount         decimal.Decimal
	OutCurrency      string
	InCurrency       string
	OutDescription   string
	InDescription    string
	OutDate          time.Time
	InDate           time.Time
	DayGap           int
	// Confidence is high (same amount and currency, ≤1 day), medium (same amount, 2–3 days) or
	// low (different currencies, similar value in the base currency)
	Confidence string
}
