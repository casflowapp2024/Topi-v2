package domain

import (
	"time"

	"github.com/shopspring/decimal"
)

// CreditCardDetails are the terms of a credit card account (amounts in its currency). Every field
// is optional: without a statement day there is no billing period.
type CreditCardDetails struct {
	AccountID      uint64
	UserID         string
	CreditLimit    *decimal.Decimal
	StatementDay   *int16 // día de corte (1–31; 31 = last day of shorter months)
	DueDay         *int16 // día límite de pago (1–31)
	InterestRateEA *decimal.Decimal
}

// Validate checks the ranges without the database
func (d *CreditCardDetails) Validate() error {
	if d.AccountID == 0 {
		return ErrInvalidCreditCard
	}
	if d.CreditLimit != nil && d.CreditLimit.IsNegative() {
		return ErrInvalidCreditCard
	}
	if d.InterestRateEA != nil && d.InterestRateEA.IsNegative() {
		return ErrInvalidCreditCard
	}
	for _, day := range []*int16{d.StatementDay, d.DueDay} {
		if day != nil && (*day < 1 || *day > 31) {
			return ErrInvalidCreditCard
		}
	}
	return nil
}

// CreditCardStatus is a card today (function credit_card_status): debt, available credit and the
// last billing period. The period fields are nil without a statement day.
type CreditCardStatus struct {
	CreditCardDetails
	Name                 string
	Currency             string
	Debt                 decimal.Decimal  // estimated debt today (see credit_card_status)
	Available            *decimal.Decimal // credit limit − debt
	LastStatement        *time.Time
	NextStatement        *time.Time
	DueDate              *time.Time
	StatementDebt        *decimal.Decimal // purchases of the last statement (approximate bill)
	PaidSinceStatement   *decimal.Decimal
	PendingStatement     *decimal.Decimal // what is left of the last statement: 0 once it has a payment
	PurchasesSince       *decimal.Decimal
	InstallmentPurchases int // purchases in installments still running: the bank bills only the installment
}

// CreditCardCycle is one statement of a card (function credit_card_cycles): its purchases and what
// came in until the next statement, which is when that statement gets paid. Counted says whether
// it enters the comparison of payments and purchases.
type CreditCardCycle struct {
	StatementDate time.Time
	Purchases     decimal.Decimal
	Payments      decimal.Decimal
	Counted       bool
}

// OverpaidTotal is what the user paid above the purchases of the counted statements
func OverpaidTotal(cycles []CreditCardCycle) decimal.Decimal {
	total := decimal.Zero
	for _, c := range cycles {
		if c.Counted {
			total = total.Add(c.Payments.Sub(c.Purchases))
		}
	}
	return total
}
