package domain

import (
	"cash-flow/internal/enums"
	"fmt"
	"sort"
	"strings"
	"time"
)

type Account struct {
	ID     uint64
	UserID string
	Name   string
	// LastFourDigits: the number the user typed for the account ("" = none). Optional since plan/32: the
	// worker matches by Identifiers, which also holds the numbers learned from the user's corrections.
	LastFourDigits string
	// ClearLastFourDigits: the update removes the typed number (an empty LastFourDigits alone keeps it)
	ClearLastFourDigits bool
	// Identifiers are the digits that recognise the account in bank emails (loaded only for the reads)
	Identifiers    []string
	InitialBalance float64
	// Currency is the ISO 4217 code of the account; every transaction of the account is in it.
	// It cannot change once the account has transactions (HasTransactions).
	Currency        string
	HasTransactions bool
	// ClosedAt: closed accounts keep their history but take no new movements (nil = open)
	ClosedAt  *time.Time
	Bank      Bank
	Type      AccountType
	Email     Email
	Total     uint64
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (a *Account) UpdateCreditInitialBalance() {
	if a.InitialBalance > 0 && a.IsCreditType() {
		a.InitialBalance = -a.InitialBalance
	}
}

func (a *Account) IsCreditType() bool {
	for _, t := range enums.CreditTypes {
		if t == a.Type.ID {
			return true
		}
	}

	return false
}

func GetTypesToFilter(filter string) []uint64 {
	if filter == enums.Savings {
		return enums.SavingTypes
	}

	return nil
}

func (a *Account) IsSame(expected *Account) bool {
	if a == nil || expected == nil {
		return false
	}

	var sameEmailID bool

	if a.Email.ID != nil && expected.Email.ID != nil {
		sameEmailID = *a.Email.ID == *expected.Email.ID
	} else if a.Email.ID == nil && expected.Email.ID == nil {
		sameEmailID = true
	}

	sameBankID := a.Bank.ID == expected.Bank.ID
	sameName := a.Name == expected.Name
	sameType := a.Type.ID == expected.Type.ID
	sameLastFourDigits := a.LastFourDigits == expected.LastFourDigits && !(a.ClearLastFourDigits && expected.LastFourDigits != "")
	sameInitialBalance := a.InitialBalance == expected.InitialBalance
	sameCurrency := a.Currency == "" || a.Currency == expected.Currency

	return sameBankID &&
		sameCurrency &&
		sameName &&
		sameType &&
		sameLastFourDigits &&
		sameInitialBalance &&
		sameEmailID
}

// ChangesReading: the update links the account to another connection, bank or card number, so what the worker
// reads for it changes and a new read is worth asking for
func (a *Account) ChangesReading(before *Account) bool {
	if a == nil || before == nil || a.Email.ID == nil {
		return false
	}
	newEmail := before.Email.ID == nil || *before.Email.ID != *a.Email.ID
	newBank := a.Bank.ID != 0 && a.Bank.ID != before.Bank.ID
	newDigits := a.LastFourDigits != "" && a.LastFourDigits != before.LastFourDigits
	return newEmail || newBank || newDigits
}

func (a *Account) IsEmpty() bool {
	emptyName := a.Name == ""
	emptyLastFourDigits := a.LastFourDigits == "" && !a.ClearLastFourDigits
	return emptyName && emptyLastFourDigits
}

func (a *Account) GetConfiguredState() bool {
	return a.Email.ID != nil &&
		*a.Email.ID != 0 &&
		a.Email.Active != false &&
		a.Email.Email != "" &&
		a.Email.Token.Access != "" &&
		a.Email.Token.Refresh != "" &&
		a.Bank.Email != nil && *a.Bank.Email != ""
}

func (a *Account) SplitByBankEmails() []Account {
	if a.Bank.Email == nil {
		return []Account{*a}
	}

	emails := strings.Split(*a.Bank.Email, ",")

	if len(emails) <= 1 {
		return []Account{*a}
	}

	var splitAccounts = make([]Account, 0)

	for _, email := range emails {
		newAccount := *a

		// Clean up email spaces
		email = strings.TrimSpace(email)

		// Assign new email to the new account
		newAccount.Bank.Email = &email

		// Append the new account to the slice
		splitAccounts = append(splitAccounts, newAccount)
	}

	return splitAccounts
}

func (a *Account) CalculateInitialBalance(transactions Transactions) {
	if transactions == nil {
		return
	}

	netFlow := transactions.CalculateNetFlow()
	a.InitialBalance += netFlow
}

type AccountFilters struct {
	Skip  uint64
	Limit uint64
	IDs   []uint64
}

type AccountTypes []uint64

func (at *AccountTypes) IsCredit() bool {
	for _, id := range *at {
		if AccountClassOf(id) != AccountClassCredit {
			return false
		}
	}
	return len(*at) > 0
}

func (at *AccountTypes) IsSaving() bool {
	savings := make([]uint64, 0)

	for _, t := range *at {
		for _, st := range enums.SavingTypes {
			if t == st {
				savings = append(savings, t)
			}
		}
	}

	return len(savings) == len(*at)
}

type Accounts []Account

func (a Accounts) ValidateUserAccounts(accountIDs []uint64) error {
	userAccountMap := make(map[uint64]bool)
	for _, acc := range a {
		userAccountMap[acc.ID] = true
	}

	for _, id := range accountIDs {
		if !userAccountMap[id] {
			return ErrAccountsNotFound
		}
	}

	return nil
}

func (a Accounts) FindByID(id uint64) *Account {
	for i := range a {
		if a[i].ID == id {
			return &a[i]
		}
	}
	return nil
}

// SameReadAs: the requested accounts plus the others of the same connection and bank, which the same read job
// covers (sorted ids)
func (a Accounts) SameReadAs(accountIDs []uint64) []uint64 {
	type readKey struct{ emailID, bankID uint64 }
	keys := make(map[readKey]bool, len(accountIDs))
	selected := make(map[uint64]bool, len(accountIDs))
	for _, id := range accountIDs {
		selected[id] = true
		if account := a.FindByID(id); account != nil && account.Email.ID != nil {
			keys[readKey{*account.Email.ID, account.Bank.ID}] = true
		}
	}
	for _, account := range a {
		if account.Email.ID != nil && keys[readKey{*account.Email.ID, account.Bank.ID}] {
			selected[account.ID] = true
		}
	}
	ids := make([]uint64, 0, len(selected))
	for id := range selected {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

// BuildReadEmailRequests groups accounts by sender email and creates ReadEmailBodyRequest for each group
// This deduplicates email reading requests when multiple accounts share the same bank email
// accountGroupKey represents a unique combination of sender email, user email, and email ID
type accountGroupKey struct {
	senderEmail string
	userEmail   string
	emailID     uint64
}

// hasValidEmailConfiguration checks if an account has the required email configuration
func (a *Account) hasValidEmailConfiguration() bool {
	return a.Email.ID != nil && a.Bank.Email != nil
}

// BuildReadEmailRequests groups accounts by sender email and creates ReadEmailBodyRequest for each group
// This deduplicates email reading requests when multiple accounts share the same bank email
func (a Accounts) BuildReadEmailRequests() []ReadEmailBodyRequest {
	if len(a) == 0 {
		return []ReadEmailBodyRequest{}
	}

	accountGroups := a.groupAccountsByEmail()
	requests := make([]ReadEmailBodyRequest, 0, len(accountGroups))

	for _, accounts := range accountGroups {
		if len(accounts) == 0 {
			continue
		}

		// each request carries the connection, sender and accounts of its own group
		firstAccount := accounts[0]

		request := ReadEmailBodyRequest{
			UserID:      firstAccount.UserID,
			Email:       firstAccount.Email.Email,
			EmailID:     *firstAccount.Email.ID,
			Provider:    firstAccount.Email.Provider,
			SenderEmail: *firstAccount.Bank.Email,
			Accounts:    Accounts(accounts).buildAccountsMap(),
			AccountIDs:  Accounts(accounts).candidateIDs(),
			Currencies:  Accounts(accounts).buildCurrenciesMap(),
			Classes:     Accounts(accounts).buildClassesMap(),
			Onboarding:  true,
			Verify:      !IsOfficialSender(firstAccount.Bank.Name, *firstAccount.Bank.Email),
		}

		requests = append(requests, request)
	}

	// deterministic order (map iteration is random)
	sort.Slice(requests, func(i, j int) bool {
		if requests[i].EmailID != requests[j].EmailID {
			return requests[i].EmailID < requests[j].EmailID
		}
		return requests[i].SenderEmail < requests[j].SenderEmail
	})

	return requests
}

// groupAccountsByEmail groups accounts by sender email, user email, and email ID
// This ensures we only send one request per unique combination
func (a Accounts) groupAccountsByEmail() map[accountGroupKey][]Account {
	accountGroups := make(map[accountGroupKey][]Account)

	for _, account := range a {
		if !account.hasValidEmailConfiguration() {
			continue
		}

		key := accountGroupKey{
			senderEmail: *account.Bank.Email,
			userEmail:   account.Email.Email,
			emailID:     *account.Email.ID,
		}

		accountGroups[key] = append(accountGroups[key], account)
	}

	return accountGroups
}

// buildAccountsMap maps every identifier (digits) of the group to its account id. Investment accounts are left
// out (their balance comes from valuations, not from what the emails say) and so are closed ones, which take no
// new movements (plan/32).
func (a Accounts) buildAccountsMap() map[string]string {
	accountsMap := make(map[string]string, len(a))
	for _, account := range a {
		if account.ClosedAt != nil || account.Type.ClassOrDefault() == AccountClassInvestment {
			continue
		}
		for _, digits := range account.identifiers() {
			accountsMap[digits] = fmt.Sprint(account.ID)
		}
	}

	return accountsMap
}

// identifiers are the loaded identifiers, or the typed number when they were not loaded
func (a *Account) identifiers() []string {
	if a.Identifiers != nil {
		return a.Identifiers
	}
	if IsAccountDigits(a.LastFourDigits) {
		return []string{a.LastFourDigits}
	}
	return nil
}

// candidateIDs are the accounts of the group an email without known digits can go to: open and not investments,
// oldest first. With exactly one, the worker assigns to it without asking (plan/32 bloque B).
func (a Accounts) candidateIDs() []string {
	sorted := make(Accounts, 0, len(a))
	for _, account := range a {
		if account.ClosedAt != nil || account.Type.ClassOrDefault() == AccountClassInvestment {
			continue
		}
		sorted = append(sorted, account)
	}
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].ID < sorted[j].ID })
	ids := make([]string, 0, len(sorted))
	for _, account := range sorted {
		ids = append(ids, fmt.Sprint(account.ID))
	}
	return ids
}

// buildClassesMap returns account_id: account class
func (a Accounts) buildClassesMap() map[string]string {
	classes := make(map[string]string, len(a))
	for _, account := range a {
		classes[fmt.Sprintf("%d", account.ID)] = account.Type.ClassOrDefault()
	}
	return classes
}

// buildCurrenciesMap returns account_id: currency (COP when the account has none loaded)
func (a Accounts) buildCurrenciesMap() map[string]string {
	currencies := make(map[string]string, len(a))
	for _, account := range a {
		currency := account.Currency
		if currency == "" {
			currency = DefaultCurrency
		}
		currencies[fmt.Sprintf("%d", account.ID)] = currency
	}
	return currencies
}
