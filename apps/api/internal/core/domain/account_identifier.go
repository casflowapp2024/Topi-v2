package domain

import (
	"regexp"
	"time"
)

// Account identifiers (plan/32): the digits that recognise an account in bank emails. One account can have several
// (an additional or renewed card); the same digits belong to one account per user and bank.
const (
	IdentifierSourceUser    = "user"    // typed by the user
	IdentifierSourceLearned = "learned" // learned when the user moved an email transaction to the account
)

type AccountIdentifier struct {
	ID        uint64
	UserID    string
	BankID    uint64
	AccountID uint64
	Digits    string
	Source    string
	CreatedAt time.Time
}

var accountDigits = regexp.MustCompile(`^[0-9]{4}$`)

// IsAccountDigits: exactly four digits
func IsAccountDigits(digits string) bool {
	return accountDigits.MatchString(digits)
}

// LearnedIdentifiers is what learning from one correction did
type LearnedIdentifiers struct {
	// Learned: the digits are now an identifier of the account
	Learned bool
	// Digits learned ("" when nothing was learned)
	Digits string
	// Moved: other transactions waiting for review with the same digits that went to the account
	Moved int
}
