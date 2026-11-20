package domain

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

type Email struct {
	ID        *uint64    `json:"id"`
	UserID    string     `json:"user_id"`
	Email     string     `json:"email"`
	Code      string     `json:"code"`
	Token     EmailToken `json:"token"`
	Active    bool       `json:"active"`
	Total     uint64     `json:"total"`
	Provider  string     `json:"provider"`
	Verify    bool       `json:"verify"`
	Error     *string    `json:"error,omitempty"`
	ErrorAt   *time.Time `json:"error_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	// Reconnected: RegisterEmail authorized again a connection that was down (plan/27 §D)
	Reconnected bool `json:"-"`
}

type EmailToken struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
	Type    string `json:"token_type"`
}

func (e *Email) SetToken(token EmailToken) {
	e.Token.Access = token.Access
	e.Token.Refresh = token.Refresh
	e.Token.Type = token.Type
}

func (e *Email) IsValidRefreshToken(token EmailToken) bool {
	return token.Refresh != ""
}

func (e *Email) IsSameEmail(actual *Email) bool {
	if actual == nil || e == nil {
		return false
	}

	sameActive := e.Active == actual.Active
	noError := e.Verify && actual.Error == nil

	return sameActive && noError
}

type ReadEmailBodyRequest struct {
	UserID      string            `json:"user_id"`
	Email       string            `json:"user_mail"`
	EmailID     uint64            `json:"email_id"`
	Provider    string            `json:"user_provider"`
	SenderEmail string            `json:"sender_email"`
	Accounts    map[string]string `json:"accounts"` // account_number: account_id
	// AccountIDs: open accounts of the group that are not investments, oldest first. An email whose digits are
	// unknown goes to the only one without review, or to the first one for review (plan/32). Old jobs lack it.
	AccountIDs []string `json:"account_ids,omitempty"`
	// Currencies is account_id: ISO 4217 currency. The worker marks a transaction for review
	// (should_verify) when the email mentions another currency. Optional: old jobs do not have it.
	Currencies map[string]string `json:"currencies,omitempty"`
	// Classes is account_id: account class. A card payment is an income of a credit account.
	Classes    map[string]string `json:"classes,omitempty"`
	Onboarding bool              `json:"onboarding"`
	// Verify: the bank is not one Topi reads officially (the user typed its sender), so every transaction of
	// this read goes to Por revisar until the bank is made official (plan/30 bloque 4)
	Verify bool `json:"verify,omitempty"`
}

// DedupeKey identifies the (connection, sender) pair in email_jobs: at most one pending or
// running job per key. The worker builds the same key ("<email_id>:<sender_email>").
func (r *ReadEmailBodyRequest) DedupeKey() string {
	return fmt.Sprintf("%d:%s", r.EmailID, r.SenderEmail)
}

// GetAccounts: every account of the request, also the ones without digits (Classes has them all)
func (r *ReadEmailBodyRequest) GetAccounts() []string {
	seen := make(map[string]bool, len(r.Classes)+len(r.Accounts))
	accountIDs := make([]string, 0, len(r.Classes)+len(r.Accounts))
	add := func(id string) {
		if !seen[id] {
			seen[id] = true
			accountIDs = append(accountIDs, id)
		}
	}
	for _, accountID := range r.Accounts {
		add(accountID)
	}
	for accountID := range r.Classes {
		add(accountID)
	}
	sort.Strings(accountIDs)

	return accountIDs
}

type ReadEmailAPIResponse struct {
	Message string `json:"message"`
}

type ReadEmailResponse struct {
	Reads []Read `json:"reads"`
}

type Read struct {
	SenderEmail string   `json:"sender_email"`
	MessageID   *string  `json:"message_id,omitempty"`
	Error       string   `json:"error"`
	Accounts    []string `json:"accounts"`
}

type ReadEmailResolver struct {
	Accounts []Account
	WG       *sync.WaitGroup
	Mu       *sync.Mutex
	Reads    ReadEmailResponse
}

func NewReadEmailResolver(accounts []Account) *ReadEmailResolver {
	return &ReadEmailResolver{
		Accounts: accounts,
		WG:       &sync.WaitGroup{},
		Mu:       &sync.Mutex{},
		Reads:    ReadEmailResponse{Reads: []Read{}},
	}
}

func (r *ReadEmailResolver) AddRead(read Read) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	r.Reads.Reads = append(r.Reads.Reads, read)
}
