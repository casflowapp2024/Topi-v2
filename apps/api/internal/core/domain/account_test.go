package domain

import (
	"testing"
	"time"

	"cash-flow/internal/enums"

	"github.com/stretchr/testify/assert"
)

// Minimal stub for EmailToken used in tests

func TestAccount_SplitByBankEmails(t *testing.T) {
	email1 := "a@example.com"
	email2 := "b@example.com"
	email3 := "c@example.com"
	empty := ""
	spaceEmails := "  a@example.com , b@example.com  ,c@example.com "
	onlySpaces := "   "
	nilEmail := (*string)(nil)

	tests := []struct {
		name      string
		bankEmail *string
		expected  []Account
	}{
		{
			name:      "should return single account when Bank.Email is nil",
			bankEmail: nilEmail,
			expected: []Account{
				{Bank: Bank{Email: nilEmail}},
			},
		},
		{
			name:      "should return single account when Bank.Email is empty string",
			bankEmail: &empty,
			expected: []Account{
				{Bank: Bank{Email: &empty}},
			},
		},
		{
			name:      "should return single account when Bank.Email has one email",
			bankEmail: &email1,
			expected: []Account{
				{Bank: Bank{Email: &email1}},
			},
		},
		{
			name:      "should split into two accounts when Bank.Email has two emails",
			bankEmail: func() *string { s := email1 + "," + email2; return &s }(),
			expected: []Account{
				{Bank: Bank{Email: &email1}},
				{Bank: Bank{Email: &email2}},
			},
		},
		{
			name:      "should split and trim spaces when Bank.Email has spaces",
			bankEmail: &spaceEmails,
			expected: []Account{
				{Bank: Bank{Email: &email1}},
				{Bank: Bank{Email: &email2}},
				{Bank: Bank{Email: &email3}},
			},
		},
		{
			name:      "should return single account with empty email when Bank.Email is only spaces",
			bankEmail: &onlySpaces,
			expected: []Account{
				{Bank: Bank{Email: func() *string { s := "   "; return &s }()}},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			account := Account{Bank: Bank{Email: tc.bankEmail}}
			result := account.SplitByBankEmails()

			// Compare length
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestAccount_UpdateCreditInitialBalance(t *testing.T) {
	creditType := enums.CreditTypes[0]
	notCreditType := uint64(99999)
	tests := []struct {
		name           string
		initialBalance float64
		accountTypeID  uint64
		expected       float64
	}{
		{"should negate initial balance when credit type and positive", 100, creditType, -100},
		{"should not change initial balance when not credit type", 100, notCreditType, 100},
		{"should not change initial balance when already negative", -100, creditType, -100},
		{"should not change initial balance when zero", 0, creditType, 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			acc := Account{InitialBalance: tc.initialBalance, Type: AccountType{ID: tc.accountTypeID}}
			acc.UpdateCreditInitialBalance()
			assert.Equal(t, tc.expected, acc.InitialBalance)
		})
	}
}

func TestAccount_IsCreditType(t *testing.T) {
	creditType := enums.CreditTypes[0]
	notCreditType := uint64(99999)
	accCredit := Account{Type: AccountType{ID: creditType}}
	accNotCredit := Account{Type: AccountType{ID: notCreditType}}

	tests := []struct {
		name     string
		account  Account
		expected bool
	}{
		{"should return true when type is credit", accCredit, true},
		{"should return false when type is not credit", accNotCredit, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.account.IsCreditType())
		})
	}
}

func TestGetTypesToFilter(t *testing.T) {
	tests := []struct {
		name     string
		filter   string
		expected []uint64
	}{
		{"should return saving types when filter is savings", enums.Savings, enums.SavingTypes},
		{"should return nil when filter is not savings", "other", nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, GetTypesToFilter(tc.filter))
		})
	}
}

func TestAccount_IsSame(t *testing.T) {
	emailID := uint64(1)
	emailID2 := uint64(2)
	email := Email{ID: &emailID}
	email2 := Email{ID: &emailID2}
	bank := Bank{ID: 1}
	bank2 := Bank{ID: 2}
	acc1 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 100, Email: email}
	acc2 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 100, Email: email}
	acc3 := Account{Bank: bank2, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 100, Email: email}
	acc4 := Account{Bank: bank, Name: "B", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 100, Email: email}
	acc5 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 2}, LastFourDigits: "1234", InitialBalance: 100, Email: email}
	acc6 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "4321", InitialBalance: 100, Email: email}
	acc7 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 200, Email: email}
	acc8 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 100, Email: email2}
	acc9 := Account{Bank: bank, Name: "A", Type: AccountType{ID: 1}, LastFourDigits: "1234", InitialBalance: 100, Email: Email{ID: nil}}

	tests := []struct {
		name     string
		a        *Account
		b        *Account
		expected bool
	}{
		{"should return true when all fields are same", &acc1, &acc2, true},
		{"should return false when bank is different", &acc1, &acc3, false},
		{"should return false when name is different", &acc1, &acc4, false},
		{"should return false when type is different", &acc1, &acc5, false},
		{"should return false when last four digits are different", &acc1, &acc6, false},
		{"should return false when initial balance is different", &acc1, &acc7, false},
		{"should return false when email id is different", &acc1, &acc8, false},
		{"should return true when both email ids are nil", &acc9, &acc9, true},
		{"should return false when one account is nil", nil, &acc1, false},
		{"should return false when both accounts are nil", nil, nil, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.a.IsSame(tc.b))
		})
	}
}

func TestAccount_IsEmpty(t *testing.T) {
	tests := []struct {
		name     string
		account  Account
		expected bool
	}{
		{"should return true when name and last four digits are empty", Account{Name: "", LastFourDigits: ""}, true},
		{"should return false when name is not empty", Account{Name: "A", LastFourDigits: ""}, false},
		{"should return false when last four digits is not empty", Account{Name: "", LastFourDigits: "1234"}, false},
		{"should return false when both are not empty", Account{Name: "A", LastFourDigits: "1234"}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.account.IsEmpty())
		})
	}
}

func TestAccount_GetConfiguredState(t *testing.T) {
	emailID := uint64(1)
	token := EmailToken{Access: "access", Refresh: "refresh"}
	bankEmail := "bank@example.com"
	tests := []struct {
		name     string
		account  Account
		expected bool
	}{
		{"should return true when all fields are configured", Account{Email: Email{ID: &emailID, Active: true, Email: "a@example.com", Token: token}, Bank: Bank{Email: &bankEmail}}, true},
		{"should return false when email ID is nil", Account{Email: Email{ID: nil, Active: true, Email: "a@example.com", Token: token}, Bank: Bank{Email: &bankEmail}}, false},
		{"should return false when email ID is zero", Account{Email: Email{ID: func() *uint64 { i := uint64(0); return &i }(), Active: true, Email: "a@example.com", Token: token}, Bank: Bank{Email: &bankEmail}}, false},
		{"should return false when email is not active", Account{Email: Email{ID: &emailID, Active: false, Email: "a@example.com", Token: token}, Bank: Bank{Email: &bankEmail}}, false},
		{"should return false when email is empty", Account{Email: Email{ID: &emailID, Active: true, Email: "", Token: token}, Bank: Bank{Email: &bankEmail}}, false},
		{"should return false when token access is empty", Account{Email: Email{ID: &emailID, Active: true, Email: "a@example.com", Token: EmailToken{Access: "", Refresh: "refresh"}}, Bank: Bank{Email: &bankEmail}}, false},
		{"should return false when token refresh is empty", Account{Email: Email{ID: &emailID, Active: true, Email: "a@example.com", Token: EmailToken{Access: "access", Refresh: ""}}, Bank: Bank{Email: &bankEmail}}, false},
		{"should return false when bank email is nil", Account{Email: Email{ID: &emailID, Active: true, Email: "a@example.com", Token: token}, Bank: Bank{Email: nil}}, false},
		{"should return false when bank email is empty", Account{Email: Email{ID: &emailID, Active: true, Email: "a@example.com", Token: token}, Bank: Bank{Email: func() *string { s := ""; return &s }()}}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.account.GetConfiguredState())
		})
	}
}

func TestAccounts_BuildReadEmailRequests_GroupsBySender(t *testing.T) {
	gmailID, outlookID := uint64(7), uint64(9)
	bancolombia := enums.OfficialBanks["Bancolombia"]
	nubank := "nu@nu.com.co"

	accounts := Accounts{
		{ID: 1, UserID: "u1", LastFourDigits: "1111", Bank: Bank{Name: "Bancolombia", Email: &bancolombia}, Email: Email{ID: &gmailID, Email: "u1@gmail.com", Provider: "gmail"}},
		{ID: 2, UserID: "u1", LastFourDigits: "2222", Bank: Bank{Name: "Bancolombia", Email: &bancolombia}, Email: Email{ID: &gmailID, Email: "u1@gmail.com", Provider: "gmail"}},
		{ID: 3, UserID: "u1", LastFourDigits: "3333", Bank: Bank{Name: "Banco Propio", Email: &nubank}, Email: Email{ID: &outlookID, Email: "u1@outlook.com", Provider: "outlook"}},
	}

	requests := accounts.BuildReadEmailRequests()

	if assert.Len(t, requests, 2) {
		assert.Equal(t, ReadEmailBodyRequest{
			UserID: "u1", Email: "u1@gmail.com", EmailID: 7, Provider: "gmail", SenderEmail: bancolombia,
			Accounts: map[string]string{"1111": "1", "2222": "2"}, AccountIDs: []string{"1", "2"}, Currencies: map[string]string{"1": "COP", "2": "COP"},
			Classes: map[string]string{"1": "deposit", "2": "deposit"}, Onboarding: true,
		}, requests[0])
		// before the fix the second group reused the first account's connection and all accounts
		assert.Equal(t, ReadEmailBodyRequest{
			UserID: "u1", Email: "u1@outlook.com", EmailID: 9, Provider: "outlook", SenderEmail: nubank,
			Accounts: map[string]string{"3333": "3"}, AccountIDs: []string{"3"}, Currencies: map[string]string{"3": "COP"},
			Classes: map[string]string{"3": "deposit"}, Onboarding: true,
			Verify: true, // plan/30: a bank the user typed goes to Por revisar
		}, requests[1])
		assert.Equal(t, "9:nu@nu.com.co", requests[1].DedupeKey())
	}
}

func TestAccount_ChangesReading(t *testing.T) {
	one, two := uint64(1), uint64(2)
	before := &Account{Bank: Bank{ID: 1}, LastFourDigits: "1558", Email: Email{ID: &one}}

	assert.False(t, (&Account{Bank: Bank{ID: 1}, LastFourDigits: "1558", Email: Email{ID: &one}}).ChangesReading(before))
	assert.True(t, (&Account{Bank: Bank{ID: 1}, LastFourDigits: "1558", Email: Email{ID: &two}}).ChangesReading(before))
	assert.True(t, (&Account{Bank: Bank{ID: 3}, LastFourDigits: "1558", Email: Email{ID: &one}}).ChangesReading(before))
	assert.True(t, (&Account{Bank: Bank{ID: 1}, LastFourDigits: "0000", Email: Email{ID: &one}}).ChangesReading(before))
	assert.True(t, (&Account{Bank: Bank{ID: 1}, Email: Email{ID: &one}}).ChangesReading(&Account{Bank: Bank{ID: 1}}))
	assert.False(t, (&Account{Bank: Bank{ID: 3}}).ChangesReading(before), "sin correo no hay qué leer")
}

func TestAccounts_BuildReadEmailRequests_Identifiers(t *testing.T) {
	emailID := uint64(7)
	sender := "alertas@banco.com"
	closed := time.Now()
	base := Account{UserID: "u1", Bank: Bank{ID: 4, Name: "Banco", Email: &sender}, Email: Email{ID: &emailID, Email: "u1@gmail.com"}}
	card, renewed, noDigits, investment, closedAccount := base, base, base, base, base
	card.ID, card.Type, card.LastFourDigits = 5, AccountType{Class: AccountClassCredit}, "1111"
	card.Identifiers = []string{"1111", "2222"}                           // an additional card learned
	renewed.ID, renewed.Type = 3, AccountType{Class: AccountClassDeposit} // no digits typed
	noDigits.ID, noDigits.Type, noDigits.Identifiers = 4, AccountType{Class: AccountClassDeposit}, []string{}
	investment.ID, investment.Type, investment.Identifiers = 6, AccountType{Class: AccountClassInvestment}, []string{"9999"}
	closedAccount.ID, closedAccount.Type, closedAccount.ClosedAt = 7, AccountType{Class: AccountClassDeposit}, &closed
	closedAccount.Identifiers = []string{"7777"}

	requests := Accounts{card, renewed, noDigits, investment, closedAccount}.BuildReadEmailRequests()

	if assert.Len(t, requests, 1) {
		// no "" key (an email without digits must not match an account without them), no investments, no closed
		assert.Equal(t, map[string]string{"1111": "5", "2222": "5"}, requests[0].Accounts)
		// open accounts that are not investments, oldest first
		assert.Equal(t, []string{"3", "4", "5"}, requests[0].AccountIDs)
		assert.Equal(t, []string{"3", "4", "5", "6", "7"}, requests[0].GetAccounts())
	}
}

func TestAccounts_SameReadAs(t *testing.T) {
	gmail, outlook := uint64(1), uint64(2)
	accounts := Accounts{
		{ID: 10, Bank: Bank{ID: 1}, Email: Email{ID: &gmail}},
		{ID: 11, Bank: Bank{ID: 1}, Email: Email{ID: &gmail}},
		{ID: 12, Bank: Bank{ID: 2}, Email: Email{ID: &gmail}},
		{ID: 13, Bank: Bank{ID: 1}, Email: Email{ID: &outlook}},
		{ID: 14, Bank: Bank{ID: 1}},
	}
	assert.Equal(t, []uint64{10, 11}, accounts.SameReadAs([]uint64{11}))
	assert.Equal(t, []uint64{14}, accounts.SameReadAs([]uint64{14}))
	assert.Equal(t, []uint64{10, 11, 12}, accounts.SameReadAs([]uint64{10, 12}))
}

func TestAccount_ClearLastFourDigits(t *testing.T) {
	clear := &Account{Name: "Visa", ClearLastFourDigits: true}
	assert.False(t, clear.IsEmpty())
	assert.False(t, clear.IsSame(&Account{Name: "Visa", LastFourDigits: "1234"}))
	assert.True(t, (&Account{ClearLastFourDigits: true}).IsSame(&Account{})) // nothing to clear
}
