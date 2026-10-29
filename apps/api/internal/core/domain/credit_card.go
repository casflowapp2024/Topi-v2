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
	Debt                 decimal.Decimal  // debt today (0 with a balance in favor)
	Available            *decimal.Decimal // credit limit − debt
	LastStatement        *time.Time
	NextStatement        *time.Time
	DueDate              *time.Time
	StatementDebt        *decimal.Decimal // debt at the last statement
	PaidSinceStatement   *decimal.Decimal
	PendingStatement     *decimal.Decimal // what is left to pay of the last statement
	PurchasesSince       *decimal.Decimal
	InstallmentPurchases int // purchases in installments still running: the bank bills only the installment
}
