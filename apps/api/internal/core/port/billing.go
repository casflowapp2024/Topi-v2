package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=billing.go -destination=mock/billing.go -package=mock

// Billing is a payment provider (Mercado Pago today, plan/22-modelo-negocio.md). It never sees card data: the
// buyer pays in the provider checkout.
type Billing interface {
	// Name is payments.provider and the :provider of the webhook route
	Name() string
	// CreateCheckout opens a hosted checkout for one of our payments
	CreateCheckout(ctx context.Context, req domain.CheckoutRequest) (*domain.CheckoutSession, error)
	// VerifyWebhook checks the signature of a notification (domain.ErrInvalidWebhookSignature if it fails).
	// The notice only says which payment to look up: its status always comes from GetPayment.
	VerifyWebhook(req domain.WebhookRequest) (*domain.WebhookNotice, error)
	// GetPayment reads a provider payment (domain.ErrDataNotFound if it does not exist)
	GetPayment(ctx context.Context, providerRef string) (*domain.ProviderPayment, error)
	// FindPayments lists the provider payments of one of our payments (external reference)
	FindPayments(ctx context.Context, externalRef string) ([]domain.ProviderPayment, error)
}

// PaymentApplied is the result of applying a provider payment
type PaymentApplied struct {
	Payment domain.Payment
	// Approved is true only the first time the payment becomes approved (receipt and event)
	Approved bool
}

// PaymentRepository persists payments
type PaymentRepository interface {
	Create(ctx context.Context, payment domain.Payment) (*domain.Payment, error)
	SetCheckoutRef(ctx context.Context, id, checkoutRef string) error
	// Get returns a payment by id (domain.ErrDataNotFound)
	Get(ctx context.Context, id string) (*domain.Payment, error)
	// GetForUser returns a payment of that user (domain.ErrDataNotFound if it is someone else's)
	GetForUser(ctx context.Context, userID, id string) (*domain.Payment, error)
	// Apply locks the payment and applies the provider payment with domain.DecidePayment (idempotent)
	Apply(ctx context.Context, paymentID string, pp domain.ProviderPayment) (*PaymentApplied, error)
	MarkReceiptEnqueued(ctx context.Context, id string) error
	// Money returns the approved support payments by month since from and the latest payments
	Money(ctx context.Context, from time.Time, recent int) (*domain.MoneyReport, error)
}

// BillingService is "Apoyar a Topi": checkout, webhook and the payment status
type BillingService interface {
	Config() domain.BillingConfig
	// StartSupport creates the payment and opens the checkout of the amount (whole pesos, decimal string)
	StartSupport(ctx context.Context, userID, amount string) (*domain.CheckoutSession, error)
	// GetPayment returns a payment of the user; if it is not final it asks the provider first (server side)
	GetPayment(ctx context.Context, userID, id string) (*domain.PaymentView, error)
	// HandleWebhook verifies and applies a provider notification
	HandleWebhook(ctx context.Context, provider string, req domain.WebhookRequest) error
	// Money is the "Dinero" section of the admin panel
	Money(ctx context.Context) (*domain.MoneyReport, error)
}
