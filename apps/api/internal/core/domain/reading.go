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

// Reading states of a bank inside a connection (plan/30 bloque 4): decided with the first read, not after 48 h
const (
	BankReading    = "reading"    // some sender not read yet
	BankOK         = "ok"         // it has automatic transactions
	BankNoEmails   = "no_emails"  // read and nothing from its sender: ask the user for the right sender
	BankUnreadable = "unreadable" // emails found but no transaction: Topi does not read that bank yet
)

// ConnectionBank is a bank of an account linked to a connection
type ConnectionBank struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Supported bool   `json:"supported"`
	// Sender is the address (or comma separated addresses) Topi reads for this bank
	Sender string `json:"sender"`
	// Reading is one of the Bank* states; "" for connections read before plan/30 (no first read recorded)
	Reading string `json:"reading"`
	// Found is how many emails of its senders the first read listed
	Found int64 `json:"found"`
	// AccountIDs are the accounts of this bank linked to the connection (to read them again after a fix)
	AccountIDs []uint64 `json:"account_ids"`
}

// BankReadFacts are the counts behind ConnectionBank.Reading
type BankReadFacts struct {
	Senders      int   // senders configured for the bank
	ReadSenders  int   // senders with a sync state
	LegacySender int   // senders read before the first read was recorded
	Found        int64 // emails listed by the first reads
	Transactions int64 // automatic transactions of the bank's accounts on this connection
}

// ComputeBankReading decides the state of a bank from its first reads
func ComputeBankReading(f BankReadFacts) string {
	switch {
	case f.Transactions > 0:
		return BankOK
	case f.Senders == 0:
		return BankNoEmails // a bank with no sender cannot be read: ask for it
	case f.ReadSenders < f.Senders:
		return BankReading
	case f.LegacySender > 0:
		return ""
	case f.Found == 0:
		return BankNoEmails
	default:
		return BankUnreadable
	}
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
	// Job is the last priority read ("leer ahora") of the last 24 h, nil if there is none (plan/31)
	Job *ReadingJob `json:"job"`
}

// States of the last priority read of a connection
const (
	JobQueued  = "queued"
	JobRunning = "running"
	JobDone    = "done"
	JobFailed  = "failed"
)

// ReadingJob is the progress of the last priority read: counts only
type ReadingJob struct {
	State      string     `json:"state"`
	Listed     int64      `json:"listed"`
	Processed  int64      `json:"processed"`
	Created    int64      `json:"created"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

// ReadingJobFacts are the counts of the jobs of that read (one per sender)
type ReadingJobFacts struct {
	Jobs, Running, Pending, Failed int64
	Listed, Processed, Created     int64
	LastUpdate                     time.Time
}

// NewReadingJob decides the state of a read from its jobs
func NewReadingJob(f ReadingJobFacts) *ReadingJob {
	if f.Jobs == 0 {
		return nil
	}
	job := &ReadingJob{Listed: f.Listed, Processed: f.Processed, Created: f.Created}
	switch {
	case f.Running > 0:
		job.State = JobRunning
	case f.Pending > 0:
		job.State = JobQueued
	case f.Failed == f.Jobs:
		job.State = JobFailed
	default:
		job.State = JobDone
		at := f.LastUpdate
		job.FinishedAt = &at
	}
	return job
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
	case c.allBanksSilent():
		// the first read already said it: no need to wait 48 h (plan/30 bloque 4)
		c.Reading = ReadingNoTransaction
	case now.Sub(c.ConnectedAt) < UnsupportedAfter:
		c.Reading = ReadingFirst
	default:
		c.Reading = ReadingNoTransaction
	}
}

// allBanksSilent: every bank was read and none of them gave a transaction
func (c *ConnectionStatus) allBanksSilent() bool {
	if len(c.Banks) == 0 {
		return false
	}
	for _, b := range c.Banks {
		if b.Reading != BankNoEmails && b.Reading != BankUnreadable {
			return false
		}
	}
	return true
}

// ReadingStatus is GET /email/status
type ReadingStatus struct {
	Connections    []ConnectionStatus `json:"connections"`
	SupportedBanks []string           `json:"supported_banks"`
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

// IsOfficialSender: the bank is official and the sender is one of its official addresses. A sender the user
// typed (custom bank, or an official bank with another sender) is not: its transactions go to Por revisar.
func IsOfficialSender(bankName, sender string) bool {
	key := normalizeBankName(bankName)
	for official, senders := range enums.OfficialBanks {
		if normalizeBankName(official) != key {
			continue
		}
		allowed := map[string]bool{}
		for _, s := range strings.Split(senders, ",") {
			allowed[strings.ToLower(strings.TrimSpace(s))] = true
		}
		// sender may be one address or the comma separated list of the bank: all of them must be official
		found := false
		for _, s := range strings.Split(sender, ",") {
			s = strings.ToLower(strings.TrimSpace(s))
			if s == "" {
				continue
			}
			if !allowed[s] {
				return false
			}
			found = true
		}
		return found
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

// OnboardingSteps in the order the checklist shows them. The budget goes before the review (plan/31): with a
// budget in mind, giving each movement its category makes sense
var OnboardingSteps = []string{StepConnectEmail, StepFirstAutoTx, StepBudget, StepReview}

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
