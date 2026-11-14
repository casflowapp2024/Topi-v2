package domain

import (
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// Payment providers (payments.provider)
const (
	ProviderMercadoPago = "mercadopago"
)

// Payment kinds (payments.kind). Only support exists today (plan/22, N1); subscription is for the stage 4.
const (
	PaymentKindSupport      = "support"
	PaymentKindSubscription = "subscription"
)

// Payment statuses (payments.status). created = checkout opened, nothing paid yet.
const (
	PaymentCreated   = "created"
	PaymentPending   = "pending"
	PaymentApproved  = "approved"
	PaymentRejected  = "rejected"
	PaymentCancelled = "cancelled"
	PaymentRefunded  = "refunded"
)

// SupportCurrency is the only currency of "Apoyar a Topi"
const SupportCurrency = "COP"

// Limits of a support payment, in whole pesos (plan/22, N1: 10.000 / 20.000 / 50.000 / libre)
var (
	MinSupportAmount = decimal.NewFromInt(5_000)
	MaxSupportAmount = decimal.NewFromInt(2_000_000)
)

// SupportPresets are the amounts offered in the sheet (the front shows the same list)
var SupportPresets = []string{"10000", "20000", "50000"}

// ProductEvent names of the support flow (no amounts in props)
const (
	ProductEventSupportStarted  = "support_started"
	ProductEventSupportApproved = "support_approved"
)

// Payment is a row of payments. Never card data: only the provider reference.
type Payment struct {
	ID          string
	UserID      string
	Provider    string
	ProviderRef *string
	CheckoutRef *string
	Kind        string
	Amount      decimal.Decimal
	Currency    string
	Status      string
	RawStatus   *string
	ApprovedAt  *time.Time
	// ReceiptEnqueuedAt: the receipt email is already in email_outbox
	ReceiptEnqueuedAt *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// IsFinalPaymentStatus reports whether the status no longer changes by itself (refunds aside)
func IsFinalPaymentStatus(status string) bool {
	switch status {
	case PaymentApproved, PaymentRejected, PaymentCancelled, PaymentRefunded:
		return true
	}
	return false
}

// ParseSupportAmount validates the amount typed or chosen by the user: whole pesos, within the limits
func ParseSupportAmount(value string) (decimal.Decimal, error) {
	value = strings.TrimSpace(value)
	amount, err := decimal.NewFromString(value)
	if err != nil || !amount.Equal(amount.Truncate(0)) ||
		amount.LessThan(MinSupportAmount) || amount.GreaterThan(MaxSupportAmount) {
		return decimal.Zero, ErrInvalidSupportAmount
	}
	return amount, nil
}

// CheckoutRequest is what a provider needs to open a checkout
type CheckoutRequest struct {
	// PaymentID is payments.id, sent as the external reference
	PaymentID string
	Title     string
	Amount    decimal.Decimal
	Currency  string
	// ReturnURL is the page of the app the buyer goes back to (?payment=<id> is added)
	ReturnURL string
}

// CheckoutSession is an open checkout of a provider
type CheckoutSession struct {
	PaymentID   string `json:"payment_id"`
	CheckoutURL string `json:"checkout_url"`
	// CheckoutRef is the provider id of the checkout (preference), not sent to the front
	CheckoutRef string `json:"-"`
}

// WebhookRequest is a raw provider notification: the adapter verifies it
type WebhookRequest struct {
	Headers map[string]string
	Query   map[string]string
	Body    []byte
}

// WebhookNotice is a verified notification: which provider payment to look up (empty = nothing to do)
type WebhookNotice struct {
	ProviderRef string
}

// ProviderPayment is a payment as the provider reports it (always read from the provider API)
type ProviderPayment struct {
	Ref string
	// ExternalReference is our payments.id
	ExternalReference string
	// Status is already mapped to the Payment* statuses
	Status    string
	RawStatus string
	Amount    decimal.Decimal
	Currency  string
	// LiveMode is false in the sandbox
	LiveMode bool
}

// PaymentAction is what to do with a provider payment for one of our payments
type PaymentAction int

const (
	// PaymentIgnore: nothing changes (repeated notification, older status, foreign payment)
	PaymentIgnore PaymentAction = iota
	// PaymentUpdate: the row takes the provider reference and status
	PaymentUpdate
	// PaymentInsert: another provider payment of an already paid checkout (paid twice): a new row
	PaymentInsert
)

// paymentRank orders the statuses: a notification never moves a payment back
var paymentRank = map[string]int{
	PaymentCreated: 0, PaymentPending: 1, PaymentRejected: 2, PaymentCancelled: 2, PaymentApproved: 3, PaymentRefunded: 4,
}

// DecidePayment applies a provider payment to our payment. It is idempotent: the same input twice changes
// nothing the second time. An approved payment only moves to refunded; a different provider payment of an
// already approved checkout becomes its own row.
func DecidePayment(current Payment, pp ProviderPayment) PaymentAction {
	if pp.ExternalReference != current.ID || pp.Ref == "" {
		return PaymentIgnore
	}
	if current.ProviderRef != nil && *current.ProviderRef != pp.Ref {
		// another attempt of the same checkout (the buyer retried after a rejection, or paid twice)
		if current.Status == PaymentApproved || current.Status == PaymentRefunded {
			if pp.Status == PaymentApproved {
				return PaymentInsert
			}
			return PaymentIgnore
		}
		return PaymentUpdate
	}
	if pp.Status == current.Status {
		if current.ProviderRef == nil || (current.RawStatus != nil && *current.RawStatus != pp.RawStatus) {
			return PaymentUpdate
		}
		return PaymentIgnore
	}
	if paymentRank[pp.Status] < paymentRank[current.Status] {
		return PaymentIgnore
	}
	return PaymentUpdate
}

// AmountMatches reports whether the provider charged exactly what we asked
func (p Payment) AmountMatches(pp ProviderPayment) bool {
	return p.Amount.Equal(pp.Amount) && strings.EqualFold(p.Currency, pp.Currency)
}

// PaymentView is a payment as its owner sees it (thanks page)
type PaymentView struct {
	ID         string     `json:"id"`
	Kind       string     `json:"kind"`
	Amount     string     `json:"amount"`
	Currency   string     `json:"currency"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"created_at"`
	ApprovedAt *time.Time `json:"approved_at"`
}

// View returns the payment for its owner (amount as a decimal string)
func (p Payment) View() PaymentView {
	return PaymentView{ID: p.ID, Kind: p.Kind, Amount: p.Amount.StringFixed(0), Currency: p.Currency,
		Status: p.Status, CreatedAt: p.CreatedAt, ApprovedAt: p.ApprovedAt}
}

// BillingConfig tells the front whether "Apoyar a Topi" is available and which amounts to offer
type BillingConfig struct {
	Enabled  bool     `json:"enabled"`
	Currency string   `json:"currency"`
	Presets  []string `json:"presets"`
	Min      string   `json:"min"`
	Max      string   `json:"max"`
}

// MoneyMonth is one month of approved support payments (admin panel, "Dinero")
type MoneyMonth struct {
	Month      string `json:"month"`
	Payments   int64  `json:"payments"`
	Supporters int64  `json:"supporters"`
	Amount     string `json:"amount"`
}

// MoneyPayment is one recent payment in the admin panel (short user id, no email)
type MoneyPayment struct {
	ID        string    `json:"id"`
	UserShort string    `json:"user"`
	Kind      string    `json:"kind"`
	Amount    string    `json:"amount"`
	Currency  string    `json:"currency"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// MoneyReport is the "Dinero" section of the admin panel
type MoneyReport struct {
	Enabled    bool           `json:"enabled"`
	Currency   string         `json:"currency"`
	Total      string         `json:"total"`
	Payments   int64          `json:"payments"`
	Supporters int64          `json:"supporters"`
	Pending    int64          `json:"pending"`
	Months     []MoneyMonth   `json:"months"`
	Recent     []MoneyPayment `json:"recent"`
}
