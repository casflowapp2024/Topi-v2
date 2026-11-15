package domain

import (
	"cash-flow/internal/enums"
	"sort"
	"strings"
	"time"
)

// Reading status of the user's connections and the welcome checklist (plan/27 §B and §C). Only counts,
// dates and the user's own bank names: never the content of an email.

// UnsupportedAfter is how long a healthy connection may go without its first transaction before Topi says
// "todavía no vemos movimientos de tu banco"
const UnsupportedAfter = 48 * time.Hour

// Reading states of a connection
const (
	ReadingDown          = "down"            // credential error: reconnect (banner of §D)
	ReadingInactive      = "inactive"        // turned off by the user
	ReadingNoAccounts    = "no_accounts"     // no account linked: nothing to assign the transactions to
	ReadingFirst         = "reading_first"   // connected < 48 h ago, still no transaction
	ReadingNoTransaction = "no_transactions" // 48 h or more without any transaction: bank not supported?
	ReadingOK            = "ok"
)

// ConnectionBank is a bank of an account linked to a connection
type ConnectionBank struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Supported bool   `json:"supported"`
}

// ConnectionStatus is what the app shows about one connection
type ConnectionStatus struct {
	ID                  uint64           `json:"id"`
	Provider            string           `json:"provider"`
	Active              bool             `json:"active"`
	Error               string           `json:"error,omitempty"`
	ErrorAt             *time.Time       `json:"error_at,omitempty"`
	ConnectedAt         time.Time        `json:"connected_at"`
	LastReadAt          *time.Time       `json:"last_read_at"`
	EmailsProcessed     int64            `json:"emails_processed"`
	LinkedAccounts      int64            `json:"linked_accounts"`
	TransactionsCreated int64            `json:"transactions_created"`
	LastTransactionAt   *time.Time       `json:"last_transaction_at"`
	Banks               []ConnectionBank `json:"banks"`
	Reading             string           `json:"reading"`
}

// ComputeReading sets Reading from the facts of the connection
func (c *ConnectionStatus) ComputeReading(now time.Time) {
	switch {
	case c.Error != "":
		c.Reading = ReadingDown
	case !c.Active:
		c.Reading = ReadingInactive
	case c.LinkedAccounts == 0:
		c.Reading = ReadingNoAccounts
	case c.TransactionsCreated > 0:
		c.Reading = ReadingOK
	case now.Sub(c.ConnectedAt) < UnsupportedAfter:
		c.Reading = ReadingFirst
	default:
		c.Reading = ReadingNoTransaction
	}
}

// ReadingStatus is GET /email/status
type ReadingStatus struct {
	Connections    []ConnectionStatus `json:"connections"`
	SupportedBanks []string           `json:"supported_banks"`
	// SamplesAddress is where to forward a bank notification ("" = the app does not ask for one)
	SamplesAddress string `json:"samples_address"`
}

// SupportedBanks are the banks Topi reads today (names only)
func SupportedBanks() []string {
	return NewOfficialBanks(enums.OfficialBanks).Banks
}

// IsSupportedBank: the bank is one of the official ones (case and spaces ignored)
func IsSupportedBank(name string) bool {
	key := normalizeBankName(name)
	for official := range enums.OfficialBanks {
		if normalizeBankName(official) == key {
			return true
		}
	}
	return false
}

// Onboarding steps (closed list: they go in the props of onboarding_step_completed)
const (
	StepConnectEmail = "connect_email"
	StepFirstAutoTx  = "first_auto_tx"
	StepReview       = "review"
	StepBudget       = "budget"
)

// OnboardingSteps in the order the checklist shows them
var OnboardingSteps = []string{StepConnectEmail, StepFirstAutoTx, StepReview, StepBudget}

// OnboardingFacts come from the database (never from the front)
type OnboardingFacts struct {
	HasConnection  bool
	HasAutoTx      bool
	ReviewResolved bool
	PendingReview  int64
	HasBudget      bool
}

// OnboardingStep is one item of the checklist
type OnboardingStep struct {
	ID   string `json:"id"`
	Done bool   `json:"done"`
}

// OnboardingStatus is GET /onboarding/status
type OnboardingStatus struct {
	Steps    []OnboardingStep `json:"steps"`
	Complete bool             `json:"complete"`
	// PendingReview is how many items wait in Por revisar (for the text of the step)
	PendingReview int64 `json:"pending_review"`
}

// NewOnboardingStatus: "review" is done once the user resolved something in Por revisar, or the first
// transactions arrived and nothing is waiting there.
func NewOnboardingStatus(f OnboardingFacts) OnboardingStatus {
	done := map[string]bool{
		StepConnectEmail: f.HasConnection,
		StepFirstAutoTx:  f.HasAutoTx,
		StepReview:       f.ReviewResolved || (f.HasAutoTx && f.PendingReview == 0),
		StepBudget:       f.HasBudget,
	}
	status := OnboardingStatus{Steps: make([]OnboardingStep, 0, len(OnboardingSteps)), Complete: true, PendingReview: f.PendingReview}
	for _, id := range OnboardingSteps {
		status.Steps = append(status.Steps, OnboardingStep{ID: id, Done: done[id]})
		if !done[id] {
			status.Complete = false
		}
	}
	return status
}

// DoneSteps lists the completed steps (sorted, for the events)
func (s OnboardingStatus) DoneSteps() []string {
	var steps []string
	for _, step := range s.Steps {
		if step.Done {
			steps = append(steps, step.ID)
		}
	}
	sort.Strings(steps)
	return steps
}

// UnsupportedAlert is a healthy connection with linked accounts and no transaction after UnsupportedAfter
type UnsupportedAlert struct {
	EmailID   uint64
	UserID    string
	UserEmail string
}

func normalizeBankName(name string) string {
	return strings.ToLower(strings.Join(strings.Fields(name), " "))
}
