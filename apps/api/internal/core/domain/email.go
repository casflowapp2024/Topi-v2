package domain

import (
	"fmt"
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
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
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
	// Currencies is account_id: ISO 4217 currency. The worker marks a transaction for review
	// (should_verify) when the email mentions another currency. Optional: old jobs do not have it.
	Currencies map[string]string `json:"currencies,omitempty"`
	Onboarding bool              `json:"onboarding"`
}

// DedupeKey identifies the (connection, sender) pair in email_jobs: at most one pending or
// running job per key. The worker builds the same key ("<email_id>:<sender_email>").
func (r *ReadEmailBodyRequest) DedupeKey() string {
	return fmt.Sprintf("%d:%s", r.EmailID, r.SenderEmail)
}

func (r *ReadEmailBodyRequest) GetAccounts() []string {
	accountIDs := make([]string, 0, len(r.Accounts))

	for _, accountID := range r.Accounts {
		accountIDs = append(accountIDs, accountID)
	}

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
