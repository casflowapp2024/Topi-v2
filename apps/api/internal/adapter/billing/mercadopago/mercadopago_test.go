package mercadopago

import (
	"cash-flow/internal/core/domain"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const secret = "test-webhook-secret"

func newTestClient(t *testing.T, handler http.HandlerFunc, allowLive bool) *Client {
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return New(Settings{AccessToken: "TEST-token", WebhookSecret: secret, BaseURL: srv.URL,
		NotificationURL: "https://api.topi.test/billing/webhook/mercadopago", AllowLive: allowLive})
}

func TestCreateCheckout(t *testing.T) {
	var got map[string]any
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/checkout/preferences", r.URL.Path)
		assert.Equal(t, "Bearer TEST-token", r.Header.Get("Authorization"))
		body, _ := io.ReadAll(r.Body)
		got = nil
		require.NoError(t, json.Unmarshal(body, &got))
		_, _ = w.Write([]byte(`{"id":"123-pref","init_point":"https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=123-pref","sandbox_init_point":"https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=123-pref"}`))
	}, false)

	session, err := c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "pay-1", Title: "Aporte",
		Amount: decimal.NewFromInt(20000), Currency: "COP", ReturnURL: "https://app.topi.test/apoyar/gracias"})
	require.NoError(t, err)
	assert.Equal(t, "123-pref", session.CheckoutRef)
	assert.Contains(t, session.CheckoutURL, "www.mercadopago.com.co")

	items := got["items"].([]any)
	first := items[0].(map[string]any)
	assert.Equal(t, float64(20000), first["unit_price"], "unit_price is a JSON number")
	assert.Equal(t, "COP", first["currency_id"])
	assert.Equal(t, float64(1), first["quantity"])
	assert.Equal(t, "pay-1", got["external_reference"])
	assert.Equal(t, "approved", got["auto_return"])
	assert.Equal(t, []any{map[string]any{"type": "IVA", "value": float64(0)}}, got["taxes"])
	assert.Equal(t, "https://api.topi.test/billing/webhook/mercadopago", got["notification_url"])
	back := got["back_urls"].(map[string]any)
	assert.Equal(t, "https://app.topi.test/apoyar/gracias?payment=pay-1", back["success"])
	assert.NotContains(t, string(mustJSON(got)), "card", "no card data ever")

	// localhost: no auto_return (Mercado Pago rejects it)
	_, err = c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "pay-2", Title: "Aporte",
		Amount: decimal.NewFromInt(10000), Currency: "COP", ReturnURL: "http://localhost:3000/apoyar/gracias"})
	require.NoError(t, err)
	_, hasAuto := got["auto_return"]
	assert.False(t, hasAuto)

	// sandbox URL on demand
	c.settings.UseSandboxURL = true
	session, err = c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "pay-3", Title: "Aporte",
		Amount: decimal.NewFromInt(10000), Currency: "COP"})
	require.NoError(t, err)
	assert.Contains(t, session.CheckoutURL, "sandbox.mercadopago.com.co")
}

func TestCreateCheckoutErrors(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"invalid items","error":"bad_request"}`))
	}, false)
	_, err := c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "p", Amount: decimal.NewFromInt(1), Currency: "COP"})
	assert.ErrorIs(t, err, domain.ErrBillingProvider)

	empty := newTestClient(t, func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`{}`)) }, false)
	_, err = empty.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "p", Amount: decimal.NewFromInt(1), Currency: "COP"})
	assert.ErrorIs(t, err, domain.ErrBillingProvider)
}

func TestGetAndFindPayments(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/payments/1234":
			_, _ = w.Write([]byte(`{"id":1234,"status":"approved","status_detail":"accredited","external_reference":"pay-1","transaction_amount":20000,"currency_id":"COP","live_mode":false}`))
		case "/v1/payments/999":
			_, _ = w.Write([]byte(`{"id":999,"status":"approved","external_reference":"pay-1","transaction_amount":20000,"currency_id":"COP","live_mode":true}`))
		case "/v1/payments/search":
			assert.Equal(t, "pay-1", r.URL.Query().Get("external_reference"))
			_, _ = w.Write([]byte(`{"results":[{"id":1233,"status":"rejected","status_detail":"cc_rejected_other_reason","external_reference":"pay-1","transaction_amount":20000.00,"currency_id":"COP"},{"id":1234,"status":"in_process","external_reference":"pay-1","transaction_amount":20000,"currency_id":"COP"},{"id":5,"status":"approved","external_reference":"other","transaction_amount":1,"currency_id":"COP"}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Payment not found"}`))
		}
	}, false)
	ctx := context.Background()

	pp, err := c.GetPayment(ctx, "1234")
	require.NoError(t, err)
	assert.Equal(t, domain.ProviderPayment{Ref: "1234", ExternalReference: "pay-1", Status: domain.PaymentApproved,
		RawStatus: "approved/accredited", Amount: decimal.NewFromInt(20000), Currency: "COP"}, *pp)

	_, err = c.GetPayment(ctx, "777")
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	_, err = c.GetPayment(ctx, "../users")
	assert.ErrorIs(t, err, domain.ErrDataNotFound, "only numeric ids reach the API")
	_, err = c.GetPayment(ctx, "999")
	assert.ErrorIs(t, err, domain.ErrDataNotFound, "live payments are ignored outside production")

	found, err := c.FindPayments(ctx, "pay-1")
	require.NoError(t, err)
	require.Len(t, found, 2)
	assert.Equal(t, domain.PaymentRejected, found[0].Status)
	assert.Equal(t, domain.PaymentPending, found[1].Status)
	assert.True(t, found[0].Amount.Equal(decimal.NewFromInt(20000)))
}

func TestMapStatus(t *testing.T) {
	for in, want := range map[string]string{
		"approved": domain.PaymentApproved, "pending": domain.PaymentPending, "in_process": domain.PaymentPending,
		"authorized": domain.PaymentPending, "in_mediation": domain.PaymentPending, "rejected": domain.PaymentRejected,
		"cancelled": domain.PaymentCancelled, "refunded": domain.PaymentRefunded, "charged_back": domain.PaymentRefunded,
		"something_new": domain.PaymentPending,
	} {
		assert.Equal(t, want, MapStatus(in), in)
	}
}

func TestVerifyWebhook(t *testing.T) {
	c := New(Settings{WebhookSecret: secret})
	ts := "1742505638683"
	requestID := "bb56a2f1-6aae-46ac-982e-9dcd3581d08e"

	// vector computed by hand with the documented template
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("id:123456;request-id:" + requestID + ";ts:" + ts + ";"))
	signature := "ts=" + ts + ",v1=" + hex.EncodeToString(mac.Sum(nil))
	assert.Equal(t, signature, SignNotification(secret, "123456", requestID, ts))

	body := []byte(`{"action":"payment.updated","api_version":"v1","data":{"id":"123456"},"live_mode":false,"type":"payment"}`)
	req := domain.WebhookRequest{
		Headers: map[string]string{"X-Signature": signature, "X-Request-Id": requestID},
		Query:   map[string]string{"data.id": "123456", "type": "payment"},
		Body:    body,
	}
	notice, err := c.VerifyWebhook(req)
	require.NoError(t, err)
	assert.Equal(t, "123456", notice.ProviderRef)

	// spaces and upper case hex are accepted
	req.Headers["X-Signature"] = " ts=" + ts + " , v1=" + upper(signature[len("ts="+ts+",v1="):])
	_, err = c.VerifyWebhook(req)
	require.NoError(t, err)

	for name, mutate := range map[string]func(r *domain.WebhookRequest){
		"wrong secret": func(r *domain.WebhookRequest) {
			r.Headers["X-Signature"] = SignNotification("other", "123456", requestID, ts)
		},
		"other payment id": func(r *domain.WebhookRequest) { r.Query["data.id"] = "123457" },
		"other request id": func(r *domain.WebhookRequest) { r.Headers["X-Request-Id"] = "x" },
		"other ts": func(r *domain.WebhookRequest) {
			r.Headers["X-Signature"] = "ts=1,v1=" + signature[len("ts="+ts+",v1="):]
		},
		"no signature": func(r *domain.WebhookRequest) { delete(r.Headers, "X-Signature") },
		"garbage":      func(r *domain.WebhookRequest) { r.Headers["X-Signature"] = "nope" },
	} {
		r := domain.WebhookRequest{Headers: map[string]string{"X-Signature": signature, "X-Request-Id": requestID},
			Query: map[string]string{"data.id": "123456"}, Body: body}
		mutate(&r)
		_, err := c.VerifyWebhook(r)
		assert.ErrorIs(t, err, domain.ErrInvalidWebhookSignature, name)
	}

	// no secret configured: everything is refused
	_, err = New(Settings{}).VerifyWebhook(req)
	assert.ErrorIs(t, err, domain.ErrInvalidWebhookSignature)

	// a verified notification of another topic is ignored
	other := domain.WebhookRequest{
		Headers: map[string]string{"X-Signature": SignNotification(secret, "77", requestID, ts), "X-Request-Id": requestID},
		Query:   map[string]string{"data.id": "77", "type": "plan"},
		Body:    []byte(`{"type":"plan","data":{"id":"77"}}`),
	}
	notice, err = c.VerifyWebhook(other)
	require.NoError(t, err)
	assert.Empty(t, notice.ProviderRef)
}

func upper(s string) string {
	out := []byte(s)
	for i, b := range out {
		if b >= 'a' && b <= 'f' {
			out[i] = b - 32
		}
	}
	return string(out)
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
