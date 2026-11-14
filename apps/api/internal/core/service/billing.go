package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

// supportTitle is the item of the checkout (what the buyer sees in the provider)
const supportTitle = "Aporte voluntario a Topi"

// moneyMonths and moneyRecent bound the "Dinero" section of the admin panel
const (
	moneyMonths = 12
	moneyRecent = 20
)

// BillingSettings contains the URLs of the checkout return
type BillingSettings struct {
	// AppBaseURL is the web app; the buyer returns to <AppBaseURL>/apoyar/gracias?payment=<id>
	AppBaseURL string
}

// BillingUsers is what billing needs from the users (the email of the receipt)
type BillingUsers interface {
	GetUserByID(ctx context.Context, id string) (*domain.User, error)
}

// BillingAppService implements port.BillingService and the send-time data of the receipt (MailEnricher)
type BillingAppService struct {
	provider port.Billing // nil = payments disabled
	repo     port.PaymentRepository
	users    BillingUsers
	mail     port.MailService
	events   port.ProductEventRecorder
	limiter  port.RateLimiter
	settings BillingSettings
	now      func() time.Time
}

// NewBillingService creates the billing service. provider nil = "Apoyar a Topi" hidden.
func NewBillingService(provider port.Billing, repo port.PaymentRepository, users BillingUsers, mail port.MailService,
	events port.ProductEventRecorder, limiter port.RateLimiter, settings BillingSettings) *BillingAppService {
	return &BillingAppService{provider: provider, repo: repo, users: users, mail: mail, events: events,
		limiter: limiter, settings: settings, now: time.Now}
}

// Config tells the front whether to show "Apoyar a Topi" and the amounts
func (s *BillingAppService) Config() domain.BillingConfig {
	return domain.BillingConfig{
		Enabled:  s.provider != nil,
		Currency: domain.SupportCurrency,
		Presets:  domain.SupportPresets,
		Min:      domain.MinSupportAmount.String(),
		Max:      domain.MaxSupportAmount.String(),
	}
}

// StartSupport creates the payment (created) and opens the provider checkout
func (s *BillingAppService) StartSupport(ctx context.Context, userID, amountText string) (*domain.CheckoutSession, error) {
	if s.provider == nil {
		return nil, domain.ErrBillingDisabled
	}
	amount, err := domain.ParseSupportAmount(amountText)
	if err != nil {
		return nil, err
	}
	if s.limiter != nil && !s.limiter.Allow("support:"+userID) {
		return nil, domain.ErrLimitExceededException
	}

	payment, err := s.repo.Create(ctx, domain.Payment{
		UserID: userID, Provider: s.provider.Name(), Kind: domain.PaymentKindSupport,
		Amount: amount, Currency: domain.SupportCurrency, Status: domain.PaymentCreated,
	})
	if err != nil {
		return nil, err
	}

	session, err := s.provider.CreateCheckout(ctx, domain.CheckoutRequest{
		PaymentID: payment.ID, Title: supportTitle, Amount: amount, Currency: domain.SupportCurrency,
		ReturnURL: s.settings.AppBaseURL + "/apoyar/gracias",
	})
	if err != nil {
		slog.Error("billing: could not open the checkout", "payment_id", payment.ID, "error", err)
		return nil, domain.ErrBillingProvider
	}
	if err = s.repo.SetCheckoutRef(ctx, payment.ID, session.CheckoutRef); err != nil {
		return nil, err
	}
	s.emit(ctx, userID, domain.ProductEventSupportStarted)

	session.PaymentID = payment.ID
	return session, nil
}

// GetPayment returns a payment of the user. While it is not final, the server asks the provider (the return
// from the checkout does not prove anything and the webhook can be late).
func (s *BillingAppService) GetPayment(ctx context.Context, userID, id string) (*domain.PaymentView, error) {
	payment, err := s.repo.GetForUser(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if s.provider != nil && payment.Provider == s.provider.Name() && !domain.IsFinalPaymentStatus(payment.Status) {
		if updated, err := s.reconcile(ctx, *payment); err != nil {
			slog.Warn("billing: could not ask the provider", "payment_id", payment.ID, "error", err)
		} else {
			payment = updated
		}
	}
	view := payment.View()
	return &view, nil
}

// reconcile reads the provider payment of our checkout (Mercado Pago: the order) and applies it
func (s *BillingAppService) reconcile(ctx context.Context, payment domain.Payment) (*domain.Payment, error) {
	ref := payment.ProviderRef
	if ref == nil {
		ref = payment.CheckoutRef
	}
	if ref == nil {
		return &payment, nil
	}
	pp, err := s.provider.GetPayment(ctx, *ref)
	if errors.Is(err, domain.ErrDataNotFound) {
		return &payment, nil
	}
	if err != nil {
		return nil, err
	}
	applied, err := s.apply(ctx, payment, *pp)
	if err != nil {
		return nil, err
	}
	if applied.Payment.ID != payment.ID {
		return &payment, nil
	}
	return &applied.Payment, nil
}

// HandleWebhook verifies the notification, reads the payment from the provider and applies it. Notifications
// of payments that are not ours (or that do not exist, like the provider simulator) are ignored.
func (s *BillingAppService) HandleWebhook(ctx context.Context, provider string, req domain.WebhookRequest) error {
	if s.provider == nil || provider != s.provider.Name() {
		return domain.ErrUnknownPaymentProvider
	}
	notice, err := s.provider.VerifyWebhook(req)
	if err != nil {
		return domain.ErrInvalidWebhookSignature
	}
	if notice.ProviderRef == "" {
		return nil
	}

	pp, err := s.provider.GetPayment(ctx, notice.ProviderRef)
	if errors.Is(err, domain.ErrDataNotFound) {
		slog.Info("billing: notified payment does not exist in the provider", "provider_ref", notice.ProviderRef)
		return nil
	}
	if err != nil {
		return fmt.Errorf("%w: %v", domain.ErrBillingProvider, err)
	}
	if pp.ExternalReference == "" {
		return nil
	}
	payment, err := s.repo.Get(ctx, pp.ExternalReference)
	if errors.Is(err, domain.ErrDataNotFound) {
		slog.Warn("billing: provider payment of an unknown payment", "provider_ref", pp.Ref)
		return nil
	}
	if err != nil {
		return err
	}
	_, err = s.apply(ctx, *payment, *pp)
	return err
}

// apply stores the provider payment and, when the payment is approved, queues the receipt (once)
func (s *BillingAppService) apply(ctx context.Context, payment domain.Payment, pp domain.ProviderPayment) (*port.PaymentApplied, error) {
	if pp.ExternalReference != payment.ID {
		return &port.PaymentApplied{Payment: payment}, nil
	}
	sameCheckoutAttempt := payment.ProviderRef == nil || *payment.ProviderRef == pp.Ref ||
		(payment.Status != domain.PaymentApproved && payment.Status != domain.PaymentRefunded)
	if pp.Status == domain.PaymentApproved && sameCheckoutAttempt && !payment.AmountMatches(pp) {
		// never approve something different from what was asked: it stays pending for the admin
		slog.Error("billing: approved amount differs from the payment", "payment_id", payment.ID, "provider_ref", pp.Ref)
		pp.Status = domain.PaymentPending
		pp.RawStatus = "amount_mismatch/" + pp.RawStatus
	}

	applied, err := s.repo.Apply(ctx, payment.ID, pp)
	if err != nil {
		return nil, err
	}
	if applied.Approved {
		s.emit(ctx, applied.Payment.UserID, domain.ProductEventSupportApproved)
	}
	if applied.Payment.Status == domain.PaymentApproved && applied.Payment.ReceiptEnqueuedAt == nil {
		if err = s.enqueueReceipt(ctx, applied.Payment); err != nil {
			// the provider retries the notification: the receipt is queued then
			return nil, err
		}
	}
	return applied, nil
}

// enqueueReceipt queues the receipt: only the payment id goes in the outbox, the amount is added when sending
func (s *BillingAppService) enqueueReceipt(ctx context.Context, payment domain.Payment) error {
	user, err := s.users.GetUserByID(ctx, payment.UserID)
	if err != nil {
		return err
	}
	dedupe := "payment-receipt:" + payment.ID
	userID := payment.UserID
	if _, err = s.mail.Enqueue(ctx, domain.OutboxEmail{
		UserID:    &userID,
		To:        user.Email,
		Template:  domain.TemplateBillingGeneric,
		Payload:   []byte(fmt.Sprintf(`{"payment_id":%q}`, payment.ID)),
		Priority:  domain.MailPriorityTransactional,
		DedupeKey: &dedupe,
	}); err != nil {
		return err
	}
	return s.repo.MarkReceiptEnqueued(ctx, payment.ID)
}

// Enrich fills the receipt when sending (implements MailEnricher for billing_generic)
func (s *BillingAppService) Enrich(ctx context.Context, email domain.OutboxEmail, data map[string]any) error {
	id, _ := data["payment_id"].(string)
	if id == "" {
		return domain.ErrMailCancelled
	}
	payment, err := s.repo.Get(ctx, id)
	if errors.Is(err, domain.ErrDataNotFound) {
		return domain.ErrMailCancelled
	}
	if err != nil {
		return err
	}
	if payment.Status != domain.PaymentApproved || email.UserID == nil || *email.UserID != payment.UserID {
		return domain.ErrMailCancelled
	}

	paidAt := payment.UpdatedAt
	if payment.ApprovedAt != nil {
		paidAt = *payment.ApprovedAt
	}
	local := paidAt.In(enums.BogotaLocation)
	reference := payment.ID[:8]
	if payment.ProviderRef != nil {
		reference = *payment.ProviderRef
	}

	data["subject"] = "Recibo de tu aporte a Topi"
	data["heading"] = "¡Gracias por apoyar a Topi!"
	data["intro"] = "Recibimos tu aporte. Con él ayudas a pagar el servidor, la inteligencia artificial y el " +
		"correo que hacen funcionar Topi."
	data["details"] = []map[string]any{
		{"label": "Aporte", "value": "Pago único"},
		{"label": "Valor", "value": domain.FormatMoney(payment.Amount.InexactFloat64(), payment.Currency)},
		{"label": "Fecha", "value": fmt.Sprintf("%d de %s", local.Day(), monthName(local))},
		{"label": "Medio", "value": "Mercado Pago"},
		{"label": "Referencia", "value": reference},
	}
	data["cta_label"] = "Abrir Topi"
	data["cta_url"] = s.settings.AppBaseURL + "/dashboard"
	data["note"] = "Es un aporte voluntario: no compraste ninguna función y todo en Topi sigue igual para ti. " +
		"Si tienes alguna duda, responde este correo."
	return nil
}

// Money is the "Dinero" section of the admin panel (last 12 months)
func (s *BillingAppService) Money(ctx context.Context) (*domain.MoneyReport, error) {
	local := s.now().In(enums.BogotaLocation)
	from := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, enums.BogotaLocation).AddDate(0, -(moneyMonths - 1), 0)
	report, err := s.repo.Money(ctx, from, moneyRecent)
	if err != nil {
		return nil, err
	}
	report.Enabled = s.provider != nil
	report.Currency = domain.SupportCurrency
	return report, nil
}

func (s *BillingAppService) emit(ctx context.Context, userID, name string) {
	if s.events != nil {
		s.events.Emit(ctx, domain.ProductEvent{UserID: userID, Name: name})
	}
}
