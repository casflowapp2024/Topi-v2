package domain

import (
	"cash-flow/internal/enums"
	"sort"
	"time"
)

type Bank struct {
	ID        uint64    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Email     *string   `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OfficialBanks struct {
	Banks []string `json:"banks"`
}

func IsSameBank(actual, expected *Bank) bool {
	sameName := actual.Name == expected.Name
	sameEmail := actual.Email == expected.Email
	sameUserID := actual.UserID == expected.UserID
	return sameName && sameEmail && sameUserID
}

func (b *Bank) ValidBankEmail() bool {
	return b.Email != nil && *b.Email != ""
}

func (b *Bank) SetOfficialBank() {
	email, ok := enums.OfficialBanks[b.Name]
	if ok {
		b.Email = &email
	}
}

func NewOfficialBanks(officialBanksMap map[string]string) OfficialBanks {
	banks := make([]string, 0, len(officialBanksMap))

	for name := range officialBanksMap {
		banks = append(banks, name)
	}
	// orden estable: el front preselecciona el primero de la lista
	sort.Strings(banks)

	return OfficialBanks{
		Banks: banks,
	}
}
