package mercadopago

import (
	"cash-flow/internal/core/domain"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
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
	return New(Settings{AccessToken: "TEST-token", WebhookSecret: secret, BaseURL: srv.URL, AllowLive: allowLive})
}

// orderJSON is the shape of POST/GET /v1/orders read on 2026-11-14 (fields the adapter does not use left out)
const orderJSON = `{"id":"ORDTST01M7DAZD620HB8CTJ8GCP3THX1","type":"online","processing_mode":"manual",
"external_reference":"pay-1","total_amount":"20000","status":"%s","status_detail":"%s","currency":"COP",
"checkout_url":"https://www.mercadopago.com.co/checkout/v1/redirect?order_id=ORDTST01M7DAZD620HB8CTJ8GCP3THX1"}`

func TestCreateCheckout(t *testing.T) {
	var got map[string]any
	var idempotency string
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/v1/orders", r.URL.Path)
		assert.Equal(t, "Bearer TEST-token", r.Header.Get("Authorization"))
		idempotency = r.Header.Get("X-Idempotency-Key")
		body, _ := io.ReadAll(r.Body)
		got = nil
		require.NoError(t, json.Unmarshal(body, &got))
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(fmt.Sprintf(orderJSON, "created", "created")))
	}, false)

	session, err := c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "pay-1", Title: "Aporte",
		Amount: decimal.NewFromInt(20000), Currency: "COP", ReturnURL: "https://app.topi.test/apoyar/gracias"})
	require.NoError(t, err)
	assert.Equal(t, "ORDTST01M7DAZD620HB8CTJ8GCP3THX1", session.CheckoutRef)
	assert.Contains(t, session.CheckoutURL, "order_id=ORDTST01M7DAZD620HB8CTJ8GCP3THX1")
	assert.Equal(t, "pay-1", idempotency, "one order per payment, even if the call is retried")

	assert.Equal(t, "online", got["type"])
	assert.Equal(t, "manual", got["processing_mode"])
	assert.Equal(t, "20000", got["total_amount"], "amounts travel as decimal strings")
	assert.Equal(t, "pay-1", got["external_reference"])
	item := got["items"].([]any)[0].(map[string]any)
	assert.Equal(t, "20000", item["unit_price"])
	assert.Equal(t, float64(1), item["quantity"])
	assert.Equal(t, []any{map[string]any{"type": "IVA", "value": "0"}}, got["taxes"])
	online := got["config"].(map[string]any)["online"].(map[string]any)
	assert.Equal(t, "https://app.topi.test/apoyar/gracias?payment=pay-1", online["success_url"])
	assert.Equal(t, "https://app.topi.test/apoyar/gracias?payment=pay-1", online["failure_url"])
	assert.Equal(t, "all", online["auto_return"])
	_, hasPayer := got["payer"]
	assert.False(t, hasPayer, "the email of the user is not sent")

	// localhost: no automatic return
	_, err = c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "pay-2", Title: "Aporte",
		Amount: decimal.NewFromInt(10000), Currency: "COP", ReturnURL: "http://localhost:3000/apoyar/gracias"})
	require.NoError(t, err)
	_, hasAuto := got["config"].(map[string]any)["online"].(map[string]any)["auto_return"]
	assert.False(t, hasAuto)
}

func TestCreateCheckoutErrors(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"invalid total_amount","error":"bad_request"}`))
	}, false)
	_, err := c.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "p", Amount: decimal.NewFromInt(1), Currency: "COP"})
	assert.ErrorIs(t, err, domain.ErrBillingProvider)

	empty := newTestClient(t, func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`{}`)) }, false)
	_, err = empty.CreateCheckout(context.Background(), domain.CheckoutRequest{PaymentID: "p", Amount: decimal.NewFromInt(1), Currency: "COP"})
	assert.ErrorIs(t, err, domain.ErrBillingProvider)
}

func TestGetPayment(t *testing.T) {
	status, detail := "processed", "accredited"
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/orders/ORDTST01M7DAZD620HB8CTJ8GCP3THX1":
			_, _ = w.Write([]byte(fmt.Sprintf(orderJSON, status, detail)))
		case "/v1/orders/ORD01REAL":
			_, _ = w.Write([]byte(`{"id":"ORD01REAL","status":"processed","external_reference":"pay-1","total_amount":"20000","currency":"COP"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"order not found"}`))
		}
	}, false)
	ctx := context.Background()

	pp, err := c.GetPayment(ctx, "ORDTST01M7DAZD620HB8CTJ8GCP3THX1")
	require.NoError(t, err)
	assert.Equal(t, domain.ProviderPayment{Ref: "ORDTST01M7DAZD620HB8CTJ8GCP3THX1", ExternalReference: "pay-1",
		Status: domain.PaymentApproved, RawStatus: "processed/accredited", Amount: decimal.NewFromInt(20000), Currency: "COP"}, *pp)

	status, detail = "failed", "rejected_by_issuer"
	pp, err = c.GetPayment(ctx, "ORDTST01M7DAZD620HB8CTJ8GCP3THX1")
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentRejected, pp.Status)

	_, err = c.GetPayment(ctx, "ORDTST0NOTHERE")
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	_, err = c.GetPayment(ctx, "../users")
	assert.ErrorIs(t, err, domain.ErrDataNotFound, "only letters and digits reach the API")
	_, err = c.GetPayment(ctx, "ORD01REAL")
	assert.ErrorIs(t, err, domain.ErrDataNotFound, "real orders are ignored outside production")

	live := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":"ORD01REAL","status":"processed","external_reference":"pay-1","total_amount":"20000","currency":"COP"}`))
	}, true)
	pp, err = live.GetPayment(ctx, "ORD01REAL")
	require.NoError(t, err)
	assert.True(t, pp.LiveMode)
}

func TestMapStatus(t *testing.T) {
	for in, want := range map[string]string{
		"created": domain.PaymentCreated, "processing": domain.PaymentPending, "action_required": domain.PaymentPending,
		"processed": domain.PaymentApproved, "failed": domain.PaymentRejected, "canceled": domain.PaymentCancelled,
		"expired": domain.PaymentCancelled, "refunded": domain.PaymentRefunded, "something_new": domain.PaymentPending,
	} {
		assert.Equal(t, want, MapStatus(in), in)
	}
}

func TestVerifyWebhook(t *testing.T) {
	c := New(Settings{WebhookSecret: secret})
	ts := "1742505638683"
	requestID := "bb56a2f1-6aae-46ac-982e-9dcd3581d08e"
	orderID := "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3"

	// vector computed by hand with the documented template: the id goes in lowercase in the manifest
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("id:ord01jq4s4ky8hwq6na5pxb65b3d3;request-id:" + requestID + ";ts:" + ts + ";"))
	signature := "ts=" + ts + ",v1=" + hex.EncodeToString(mac.Sum(nil))
	assert.Equal(t, signature, SignNotification(secret, orderID, requestID, ts))

	body := []byte(`{"action":"order.processed","api_version":"v1","data":{"id":"` + orderID + `","status":"processed"},"live_mode":false,"type":"order"}`)
	req := domain.WebhookRequest{
		Headers: map[string]string{"X-Signature": signature, "X-Request-Id": requestID},
		Query:   map[string]string{"data.id": orderID, "type": "order"},
		Body:    body,
	}
	notice, err := c.VerifyWebhook(req)
	require.NoError(t, err)
	assert.Equal(t, orderID, notice.ProviderRef, "the reference keeps its case: GET /v1/orders needs it")

	// spaces and upper case hex are accepted
	req.Headers["X-Signature"] = " ts=" + ts + " , v1=" + upper(signature[len("ts="+ts+",v1="):])
	_, err = c.VerifyWebhook(req)
	require.NoError(t, err)

	for name, mutate := range map[string]func(r *domain.WebhookRequest){
		"wrong secret": func(r *domain.WebhookRequest) {
			r.Headers["X-Signature"] = SignNotification("other", orderID, requestID, ts)
		},
		"other order":   func(r *domain.WebhookRequest) { r.Query["data.id"] = "ORD01OTHER" },
		"other request": func(r *domain.WebhookRequest) { r.Headers["X-Request-Id"] = "x" },
		"other ts": func(r *domain.WebhookRequest) {
			r.Headers["X-Signature"] = "ts=1,v1=" + signature[len("ts="+ts+",v1="):]
		},
		"no signature":   func(r *domain.WebhookRequest) { delete(r.Headers, "X-Signature") },
		"garbage header": func(r *domain.WebhookRequest) { r.Headers["X-Signature"] = "nope" },
	} {
		r := domain.WebhookRequest{Headers: map[string]string{"X-Signature": signature, "X-Request-Id": requestID},
			Query: map[string]string{"data.id": orderID, "type": "order"}, Body: body}
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
		Query:   map[string]string{"data.id": "77", "type": "payment"},
		Body:    []byte(`{"type":"payment","data":{"id":"77"}}`),
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
