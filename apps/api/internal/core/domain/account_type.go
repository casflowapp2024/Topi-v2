package domain

import "time"

type AccountType struct {
	ID        uint64
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func IsSameAccountType(actual, expected *AccountType) bool {
	return actual.Name == expected.Name
}

func IsEmptyAccountType(account *AccountType) bool {
	return account.Name == ""
}
