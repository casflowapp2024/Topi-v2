package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/core/port/mock"
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testPaymentID = "6f1c1d3e-2a8b-4c5d-9e0f-1a2b3c4d5e6f"

type billingEvents struct{ names []string }

func (r *billingEvents) Emit(_ context.Context, e domain.ProductEvent) {
	if e.Validate() == nil {
		r.names = append(r.names, e.Name)
	}
}

type allowLimiter struct{ allow bool }

func (l allowLimiter) Allow(string) bool { return l.allow }

type billingFixture struct {
	svc      *BillingAppService
	provider *mock.MockBilling
	repo     *mock.MockPaymentRepository
	users    *mock.MockUserRepository
	mail     *mock.MockMailService
	events   *billingEvents
}

func newBillingFixture(t *testing.T, enabled bool) *billingFixture {
	ctrl := gomock.NewController(t)
	f := &billingFixture{
		provider: mock.NewMockBilling(ctrl),
		repo:     mock.NewMockPaymentRepository(ctrl),
		users:    mock.NewMockUserRepository(ctrl),
		mail:     mock.NewMockMailService(ctrl),
		events:   &billingEvents{},
	}
	f.provider.EXPECT().Name().Return(domain.ProviderMercadoPago).AnyTimes()
	var provider port.Billing
	if enabled {
		provider = f.provider
	}
	f.svc = NewBillingService(provider, f.repo, f.users, f.mail, f.events, allowLimiter{allow: true},
		BillingSettings{AppBaseURL: "https://app.topi.test"})
	return f
}

func payment(status string, providerRef *string) domain.Payment {
	return domain.Payment{ID: testPaymentID, UserID: "u1", Provider: domain.ProviderMercadoPago,
		ProviderRef: providerRef, Kind: domain.PaymentKindSupport, Amount: decimal.NewFromInt(20000), Currency: "COP",
		Status: status, CreatedAt: time.Date(2026, 11, 13, 15, 0, 0, 0, time.UTC)}
}

func approvedPP(amount int64) domain.ProviderPayment {
	return domain.ProviderPayment{Ref: "1234", ExternalReference: testPaymentID, Status: domain.PaymentApproved,
		RawStatus: "approved/accredited", Amount: decimal.NewFromInt(amount), Currency: "COP"}
}

func TestBillingConfig(t *testing.T) {
	assert.False(t, newBillingFixture(t, false).svc.Config().Enabled)
	cfg := newBillingFixture(t, true).svc.Config()
	assert.True(t, cfg.Enabled)
	assert.Equal(t, []string{"10000", "20000", "50000"}, cfg.Presets)
	assert.Equal(t, "5000", cfg.Min)
}

func TestStartSupport(t *testing.T) {
	ctx := context.Background()

	_, err := newBillingFixture(t, false).svc.StartSupport(ctx, "u1", "20000")
	assert.ErrorIs(t, err, domain.ErrBillingDisabled)

	f := newBillingFixture(t, true)
	_, err = f.svc.StartSupport(ctx, "u1", "100")
	assert.ErrorIs(t, err, domain.ErrInvalidSupportAmount)

	created := payment(domain.PaymentCreated, nil)
	f.repo.EXPECT().Create(ctx, gomock.Any()).DoAndReturn(func(_ context.Context, p domain.Payment) (*domain.Payment, error) {
		assert.Equal(t, "u1", p.UserID)
		assert.Equal(t, domain.PaymentKindSupport, p.Kind)
		assert.Equal(t, domain.PaymentCreated, p.Status)
		assert.True(t, p.Amount.Equal(decimal.NewFromInt(20000)))
		return &created, nil
	})
	f.provider.EXPECT().CreateCheckout(ctx, domain.CheckoutRequest{PaymentID: testPaymentID, Title: supportTitle,
		Amount: decimal.NewFromInt(20000), Currency: "COP", ReturnURL: "https://app.topi.test/apoyar/gracias"}).
		Return(&domain.CheckoutSession{CheckoutURL: "https://mp.test/checkout?pref=abc", CheckoutRef: "pref-abc"}, nil)
	f.repo.EXPECT().SetCheckoutRef(ctx, testPaymentID, "pref-abc").Return(nil)

	session, err := f.svc.StartSupport(ctx, "u1", "20000")
	require.NoError(t, err)
	assert.Equal(t, testPaymentID, session.PaymentID)
	assert.Equal(t, "https://mp.test/checkout?pref=abc", session.CheckoutURL)
	assert.Equal(t, []string{domain.ProductEventSupportStarted}, f.events.names)

	// the provider fails: no checkout, generic error
	f.repo.EXPECT().Create(ctx, gomock.Any()).Return(&created, nil)
	f.provider.EXPECT().CreateCheckout(ctx, gomock.Any()).Return(nil, errors.New("boom"))
	_, err = f.svc.StartSupport(ctx, "u1", "10000")
	assert.ErrorIs(t, err, domain.ErrBillingProvider)

	// rate limited
	limited := newBillingFixture(t, true)
	limited.svc.limiter = allowLimiter{allow: false}
	_, err = limited.svc.StartSupport(ctx, "u1", "10000")
	assert.ErrorIs(t, err, domain.ErrLimitExceededException)
}

func TestBillingWebhook(t *testing.T) {
	ctx := context.Background()
	req := domain.WebhookRequest{Query: map[string]string{"data.id": "1234"}}

	t.Run("unknown provider and invalid signature", func(t *testing.T) {
		f := newBillingFixture(t, true)
		assert.ErrorIs(t, f.svc.HandleWebhook(ctx, "wompi", req), domain.ErrUnknownPaymentProvider)
		assert.ErrorIs(t, newBillingFixture(t, false).svc.HandleWebhook(ctx, "mercadopago", req), domain.ErrUnknownPaymentProvider)

		f.provider.EXPECT().VerifyWebhook(req).Return(nil, domain.ErrInvalidWebhookSignature)
		assert.ErrorIs(t, f.svc.HandleWebhook(ctx, "mercadopago", req), domain.ErrInvalidWebhookSignature)
	})

	t.Run("approved: applies, records the event and queues the receipt once", func(t *testing.T) {
		f := newBillingFixture(t, true)
		current := payment(domain.PaymentCreated, nil)
		ref := "1234"
		approved := payment(domain.PaymentApproved, &ref)

		f.provider.EXPECT().VerifyWebhook(req).Return(&domain.WebhookNotice{ProviderRef: "1234"}, nil).Times(2)
		f.provider.EXPECT().GetPayment(ctx, "1234").Return(ptr(approvedPP(20000)), nil).Times(2)
		f.repo.EXPECT().Get(ctx, testPaymentID).Return(&current, nil)
		f.repo.EXPECT().Apply(ctx, testPaymentID, approvedPP(20000)).Return(&port.PaymentApplied{Payment: approved, Approved: true}, nil)
		f.users.EXPECT().GetUserByID(ctx, "u1").Return(&domain.User{ID: "u1", Email: "ana@topi.test"}, nil)
		f.mail.EXPECT().Enqueue(ctx, gomock.Any()).DoAndReturn(func(_ context.Context, e domain.OutboxEmail) (int64, error) {
			assert.Equal(t, domain.TemplateBillingGeneric, e.Template)
			assert.Equal(t, "ana@topi.test", e.To)
			assert.Equal(t, domain.MailPriorityTransactional, e.Priority)
			assert.Equal(t, "payment-receipt:"+testPaymentID, *e.DedupeKey)
			// only the id goes in the outbox: never the amount
			var payload map[string]any
			require.NoError(t, json.Unmarshal(e.Payload, &payload))
			assert.Equal(t, map[string]any{"payment_id": testPaymentID}, payload)
			return 7, nil
		})
		f.repo.EXPECT().MarkReceiptEnqueued(ctx, testPaymentID).Return(nil)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))

		// repeated notification: nothing new (no receipt, no event)
		now := time.Now()
		approved.ReceiptEnqueuedAt = &now
		f.repo.EXPECT().Get(ctx, testPaymentID).Return(&approved, nil)
		f.repo.EXPECT().Apply(ctx, testPaymentID, approvedPP(20000)).Return(&port.PaymentApplied{Payment: approved}, nil)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))
		assert.Equal(t, []string{domain.ProductEventSupportApproved}, f.events.names)
	})

	t.Run("receipt failed before: queued on the retry", func(t *testing.T) {
		f := newBillingFixture(t, true)
		ref := "1234"
		approved := payment(domain.PaymentApproved, &ref)
		f.provider.EXPECT().VerifyWebhook(req).Return(&domain.WebhookNotice{ProviderRef: "1234"}, nil)
		f.provider.EXPECT().GetPayment(ctx, "1234").Return(ptr(approvedPP(20000)), nil)
		f.repo.EXPECT().Get(ctx, testPaymentID).Return(&approved, nil)
		f.repo.EXPECT().Apply(ctx, testPaymentID, gomock.Any()).Return(&port.PaymentApplied{Payment: approved}, nil)
		f.users.EXPECT().GetUserByID(ctx, "u1").Return(&domain.User{ID: "u1", Email: "ana@topi.test"}, nil)
		f.mail.EXPECT().Enqueue(ctx, gomock.Any()).Return(int64(0), nil)
		f.repo.EXPECT().MarkReceiptEnqueued(ctx, testPaymentID).Return(nil)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))
	})

	t.Run("amount differs: never approved", func(t *testing.T) {
		f := newBillingFixture(t, true)
		current := payment(domain.PaymentCreated, nil)
		f.provider.EXPECT().VerifyWebhook(req).Return(&domain.WebhookNotice{ProviderRef: "1234"}, nil)
		f.provider.EXPECT().GetPayment(ctx, "1234").Return(ptr(approvedPP(2000)), nil)
		f.repo.EXPECT().Get(ctx, testPaymentID).Return(&current, nil)
		f.repo.EXPECT().Apply(ctx, testPaymentID, gomock.Any()).DoAndReturn(
			func(_ context.Context, _ string, pp domain.ProviderPayment) (*port.PaymentApplied, error) {
				assert.Equal(t, domain.PaymentPending, pp.Status)
				assert.Equal(t, "amount_mismatch/approved/accredited", pp.RawStatus)
				p := payment(domain.PaymentPending, &pp.Ref)
				return &port.PaymentApplied{Payment: p}, nil
			})
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))
		assert.Empty(t, f.events.names)
	})

	t.Run("payments that are not ours are ignored", func(t *testing.T) {
		f := newBillingFixture(t, true)
		f.provider.EXPECT().VerifyWebhook(req).Return(&domain.WebhookNotice{ProviderRef: "1234"}, nil).Times(3)
		f.provider.EXPECT().GetPayment(ctx, "1234").Return(nil, domain.ErrDataNotFound)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))

		f.provider.EXPECT().GetPayment(ctx, "1234").Return(&domain.ProviderPayment{Ref: "1234"}, nil)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))

		f.provider.EXPECT().GetPayment(ctx, "1234").Return(ptr(approvedPP(20000)), nil)
		f.repo.EXPECT().Get(ctx, testPaymentID).Return(nil, domain.ErrDataNotFound)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))
	})

	t.Run("provider down: error so the notification is retried", func(t *testing.T) {
		f := newBillingFixture(t, true)
		f.provider.EXPECT().VerifyWebhook(req).Return(&domain.WebhookNotice{ProviderRef: "1234"}, nil)
		f.provider.EXPECT().GetPayment(ctx, "1234").Return(nil, errors.New("timeout"))
		assert.ErrorIs(t, f.svc.HandleWebhook(ctx, "mercadopago", req), domain.ErrBillingProvider)
	})

	t.Run("notification without a payment", func(t *testing.T) {
		f := newBillingFixture(t, true)
		f.provider.EXPECT().VerifyWebhook(req).Return(&domain.WebhookNotice{}, nil)
		require.NoError(t, f.svc.HandleWebhook(ctx, "mercadopago", req))
	})
}

func TestBillingGetPayment(t *testing.T) {
	ctx := context.Background()
	f := newBillingFixture(t, true)

	// not final: the server asks the provider (by external reference) and applies what it finds
	current := payment(domain.PaymentCreated, nil)
	ref := "1234"
	approved := payment(domain.PaymentApproved, &ref)
	now := time.Now()
	approved.ReceiptEnqueuedAt = &now
	f.repo.EXPECT().GetForUser(ctx, "u1", testPaymentID).Return(&current, nil)
	f.provider.EXPECT().FindPayments(ctx, testPaymentID).Return([]domain.ProviderPayment{approvedPP(20000)}, nil)
	f.repo.EXPECT().Apply(ctx, testPaymentID, approvedPP(20000)).Return(&port.PaymentApplied{Payment: approved}, nil)
	view, err := f.svc.GetPayment(ctx, "u1", testPaymentID)
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentApproved, view.Status)
	assert.Equal(t, "20000", view.Amount)

	// final: no call to the provider
	f.repo.EXPECT().GetForUser(ctx, "u1", testPaymentID).Return(&approved, nil)
	view, err = f.svc.GetPayment(ctx, "u1", testPaymentID)
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentApproved, view.Status)

	// provider down: the stored status
	f.repo.EXPECT().GetForUser(ctx, "u1", testPaymentID).Return(&current, nil)
	f.provider.EXPECT().FindPayments(ctx, testPaymentID).Return(nil, errors.New("timeout"))
	view, err = f.svc.GetPayment(ctx, "u1", testPaymentID)
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentCreated, view.Status)

	// someone else's
	f.repo.EXPECT().GetForUser(ctx, "u2", testPaymentID).Return(nil, domain.ErrDataNotFound)
	_, err = f.svc.GetPayment(ctx, "u2", testPaymentID)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
}

func TestBillingReceiptEnrich(t *testing.T) {
	ctx := context.Background()
	f := newBillingFixture(t, true)
	ref := "1234"
	approved := payment(domain.PaymentApproved, &ref)
	at := time.Date(2026, 11, 13, 20, 0, 0, 0, time.UTC)
	approved.ApprovedAt = &at
	user := "u1"
	email := domain.OutboxEmail{UserID: &user, Template: domain.TemplateBillingGeneric}

	f.repo.EXPECT().Get(ctx, testPaymentID).Return(&approved, nil)
	data := map[string]any{"payment_id": testPaymentID}
	require.NoError(t, f.svc.Enrich(ctx, email, data))
	assert.Equal(t, "Recibo de tu aporte a Topi", data["subject"])
	details := data["details"].([]map[string]any)
	assert.Equal(t, "$20.000", details[1]["value"])
	assert.Equal(t, "13 de noviembre de 2026", details[2]["value"])
	assert.Equal(t, "1234", details[4]["value"])
	assert.Equal(t, "https://app.topi.test/dashboard", data["cta_url"])

	// not approved (or someone else's, or gone): the email is cancelled
	pending := payment(domain.PaymentPending, &ref)
	f.repo.EXPECT().Get(ctx, testPaymentID).Return(&pending, nil)
	assert.ErrorIs(t, f.svc.Enrich(ctx, email, map[string]any{"payment_id": testPaymentID}), domain.ErrMailCancelled)
	other := "u2"
	f.repo.EXPECT().Get(ctx, testPaymentID).Return(&approved, nil)
	assert.ErrorIs(t, f.svc.Enrich(ctx, domain.OutboxEmail{UserID: &other}, map[string]any{"payment_id": testPaymentID}), domain.ErrMailCancelled)
	f.repo.EXPECT().Get(ctx, testPaymentID).Return(nil, domain.ErrDataNotFound)
	assert.ErrorIs(t, f.svc.Enrich(ctx, email, map[string]any{"payment_id": testPaymentID}), domain.ErrMailCancelled)
	assert.ErrorIs(t, f.svc.Enrich(ctx, email, map[string]any{}), domain.ErrMailCancelled)
}

func TestBillingMoney(t *testing.T) {
	ctx := context.Background()
	f := newBillingFixture(t, true)
	f.svc.now = func() time.Time { return time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC) }
	f.repo.EXPECT().Money(ctx, gomock.Any(), moneyRecent).DoAndReturn(
		func(_ context.Context, from time.Time, _ int) (*domain.MoneyReport, error) {
			assert.Equal(t, "2025-12-01", from.Format(time.DateOnly))
			return &domain.MoneyReport{Total: "30000"}, nil
		})
	report, err := f.svc.Money(ctx)
	require.NoError(t, err)
	assert.True(t, report.Enabled)
	assert.Equal(t, "COP", report.Currency)
}

func ptr[T any](v T) *T { return &v }
