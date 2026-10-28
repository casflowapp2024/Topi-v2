package domain

import (
	"cash-flow/internal/enums"
	"time"
)

// Account classes (account_types.class): what kind of product the account is
const (
	AccountClassDeposit    = "deposit"    // savings, checking, wallet: balance = initial + movements
	AccountClassInvestment = "investment" // balance anchored to the last valuation
	AccountClassCredit     = "credit"     // liability: a negative balance is debt
)

type AccountType struct {
	ID        uint64
	Name      string
	Class     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// IsAccountClass reports whether class is one of the account classes
func IsAccountClass(class string) bool {
	return class == AccountClassDeposit || class == AccountClassInvestment || class == AccountClassCredit
}

// AccountClassOf is the class of the global account types (same backfill as migration 000028):
// used where the type was not read from account_types
func AccountClassOf(typeID uint64) string {
	for _, id := range enums.InvestmentTypes {
		if id == typeID {
			return AccountClassInvestment
		}
	}
	for _, id := range enums.CreditTypes {
		if id == typeID {
			return AccountClassCredit
		}
	}
	return AccountClassDeposit
}

// ClassOrDefault is the class read from the database, or the one of its ID
func (t AccountType) ClassOrDefault() string {
	if t.Class != "" {
		return t.Class
	}
	return AccountClassOf(t.ID)
}

func IsSameAccountType(actual, expected *AccountType) bool {
	return actual.Name == expected.Name
}

func IsEmptyAccountType(account *AccountType) bool {
	return account.Name == ""
}
