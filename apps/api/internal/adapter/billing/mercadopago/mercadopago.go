// Package mercadopago implements port.Billing with the Mercado Pago HTTP API (Checkout Pro via the Orders API,
// no SDK). Docs read on 2026-11-14 (plan/22-modelo-negocio.md): POST/GET /v1/orders, order notifications
// (x-signature) and order statuses. It never sees card data: the buyer pays in the Mercado Pago checkout.
package mercadopago

import (
	"bytes"
	"cash-flow/internal/core/domain"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// DefaultBaseURL is the Mercado Pago API (the same host for test and production credentials)
const DefaultBaseURL = "https://api.mercadopago.com"

// maxResponse bounds what is read from the API
const maxResponse = 1 << 20

// Settings of the adapter (MP_* variables)
type Settings struct {
	AccessToken   string
	WebhookSecret string
	// BaseURL empty = DefaultBaseURL (tests use an httptest server)
	BaseURL string
	// AllowLive: only production accepts real orders; everywhere else only test orders (ORDTST...) count
	AllowLive bool
}

// Client implements port.Billing
type Client struct {
	settings Settings
	client   *http.Client
}

// New creates the Mercado Pago adapter
func New(settings Settings) *Client {
	if settings.BaseURL == "" {
		settings.BaseURL = DefaultBaseURL
	}
	settings.BaseURL = strings.TrimRight(settings.BaseURL, "/")
	return &Client{settings: settings, client: &http.Client{Timeout: 15 * time.Second}}
}

// Name is payments.provider
func (c *Client) Name() string { return domain.ProviderMercadoPago }

type item struct {
	Title     string `json:"title"`
	Quantity  int    `json:"quantity"`
	UnitPrice string `json:"unit_price"`
}

type tax struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type onlineConfig struct {
	SuccessURL string `json:"success_url,omitempty"`
	FailureURL string `json:"failure_url,omitempty"`
	PendingURL string `json:"pending_url,omitempty"`
	AutoReturn string `json:"auto_return,omitempty"`
}

type orderConfig struct {
	Online onlineConfig `json:"online"`
}

type orderRequest struct {
	Type              string       `json:"type"`
	ProcessingMode    string       `json:"processing_mode"`
	TotalAmount       string       `json:"total_amount"`
	ExternalReference string       `json:"external_reference"`
	Description       string       `json:"description"`
	Items             []item       `json:"items"`
	Taxes             []tax        `json:"taxes"`
	Config            *orderConfig `json:"config,omitempty"`
}

type orderResponse struct {
	ID                string `json:"id"`
	Status            string `json:"status"`
	StatusDetail      string `json:"status_detail"`
	ExternalReference string `json:"external_reference"`
	TotalAmount       string `json:"total_amount"`
	Currency          string `json:"currency"`
	CheckoutURL       string `json:"checkout_url"`
}

// CreateCheckout creates an order of Checkout Pro (Orders API, one per payment) and returns its checkout_url.
// The order id is both the checkout and the provider reference of the payment.
func (c *Client) CreateCheckout(ctx context.Context, req domain.CheckoutRequest) (*domain.CheckoutSession, error) {
	amount := req.Amount.String()
	body := orderRequest{
		Type: "online", ProcessingMode: "manual", TotalAmount: amount,
		ExternalReference: req.PaymentID, Description: req.Title,
		Items: []item{{Title: req.Title, Quantity: 1, UnitPrice: amount}},
		// a voluntary contribution: without taxes Mercado Pago assumes 19% VAT included (to validate with
		// the accountant, plan/22)
		Taxes: []tax{{Type: "IVA", Value: "0"}},
	}
	if req.ReturnURL != "" {
		back := req.ReturnURL + "?payment=" + url.QueryEscape(req.PaymentID)
		body.Config = &orderConfig{Online: onlineConfig{SuccessURL: back, FailureURL: back, PendingURL: back}}
		// automatic return only to a public https site
		if strings.HasPrefix(req.ReturnURL, "https://") {
			body.Config.Online.AutoReturn = "all"
		}
	}

	var out orderResponse
	// the payment id makes the creation idempotent: a retry of the same payment never creates a second order
	if err := c.do(ctx, http.MethodPost, "/v1/orders", req.PaymentID, body, &out); err != nil {
		return nil, err
	}
	if out.ID == "" || out.CheckoutURL == "" {
		return nil, fmt.Errorf("%w: order without id or checkout_url", domain.ErrBillingProvider)
	}
	return &domain.CheckoutSession{PaymentID: req.PaymentID, CheckoutURL: out.CheckoutURL, CheckoutRef: out.ID}, nil
}

// GetPayment reads an order (GET /v1/orders/{id}); the id keeps its case (a lowercased id is not found)
func (c *Client) GetPayment(ctx context.Context, providerRef string) (*domain.ProviderPayment, error) {
	if !isOrderID(providerRef) {
		return nil, domain.ErrDataNotFound
	}
	var out orderResponse
	if err := c.do(ctx, http.MethodGet, "/v1/orders/"+providerRef, "", nil, &out); err != nil {
		return nil, err
	}
	pp, ok := c.toProvider(out)
	if !ok {
		return nil, domain.ErrDataNotFound
	}
	return &pp, nil
}

// testOrderPrefix: orders created with test credentials ("ORDTST..."); the order has no live_mode field
const testOrderPrefix = "ORDTST"

// toProvider maps an order; outside production only test orders count (sandbox only)
func (c *Client) toProvider(r orderResponse) (domain.ProviderPayment, bool) {
	live := !strings.HasPrefix(r.ID, testOrderPrefix)
	if live && !c.settings.AllowLive {
		slog.Error("mercadopago: live order ignored outside production", "provider_ref", r.ID)
		return domain.ProviderPayment{}, false
	}
	amount, err := decimal.NewFromString(r.TotalAmount)
	if err != nil {
		slog.Error("mercadopago: order without a valid total_amount", "provider_ref", r.ID)
		return domain.ProviderPayment{}, false
	}
	raw := r.Status
	if r.StatusDetail != "" {
		raw += "/" + r.StatusDetail
	}
	if len(raw) > 80 {
		raw = raw[:80]
	}
	return domain.ProviderPayment{
		Ref: r.ID, ExternalReference: r.ExternalReference, Status: MapStatus(r.Status), RawStatus: raw,
		Amount: amount, Currency: strings.ToUpper(r.Currency), LiveMode: live,
	}, true
}

// MapStatus maps the status of an order (Orders API) to ours. processed = approved and credited (also when
// partially refunded).
func MapStatus(status string) string {
	switch status {
	case "created":
		return domain.PaymentCreated
	case "processed":
		return domain.PaymentApproved
	case "failed":
		return domain.PaymentRejected
	case "canceled", "cancelled", "expired":
		return domain.PaymentCancelled
	case "refunded", "charged_back":
		return domain.PaymentRefunded
	default:
		// processing, action_required and anything new
		return domain.PaymentPending
	}
}

type notification struct {
	Type   string `json:"type"`
	Action string `json:"action"`
	Data   struct {
		ID json.RawMessage `json:"id"`
	} `json:"data"`
}

// VerifyWebhook checks x-signature: v1 = hex(HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"))
// with data.id from the query string (lowercased in the manifest only); a missing value is left out.
// Only order notifications return a reference; any other topic is verified and ignored.
func (c *Client) VerifyWebhook(req domain.WebhookRequest) (*domain.WebhookNotice, error) {
	if c.settings.WebhookSecret == "" {
		return nil, domain.ErrInvalidWebhookSignature
	}
	ts, v1 := parseSignature(header(req.Headers, "x-signature"))
	if ts == "" || v1 == "" {
		return nil, domain.ErrInvalidWebhookSignature
	}
	dataID := req.Query["data.id"]
	requestID := header(req.Headers, "x-request-id")

	var manifest strings.Builder
	if dataID != "" {
		manifest.WriteString("id:" + strings.ToLower(dataID) + ";")
	}
	if requestID != "" {
		manifest.WriteString("request-id:" + requestID + ";")
	}
	manifest.WriteString("ts:" + ts + ";")

	mac := hmac.New(sha256.New, []byte(c.settings.WebhookSecret))
	mac.Write([]byte(manifest.String()))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(strings.ToLower(v1))) {
		return nil, domain.ErrInvalidWebhookSignature
	}

	topic := req.Query["type"]
	if topic == "" {
		topic = req.Query["topic"]
	}
	var body notification
	if len(req.Body) > 0 && json.Unmarshal(req.Body, &body) == nil && body.Type != "" {
		topic = body.Type
	}
	if topic != "order" || !isOrderID(dataID) {
		return &domain.WebhookNotice{}, nil
	}
	return &domain.WebhookNotice{ProviderRef: dataID}, nil
}

// SignNotification builds the x-signature of a notification (tests and the local simulation of the webhook)
func SignNotification(secret, dataID, requestID, ts string) string {
	manifest := "id:" + strings.ToLower(dataID) + ";request-id:" + requestID + ";ts:" + ts + ";"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(manifest))
	return "ts=" + ts + ",v1=" + hex.EncodeToString(mac.Sum(nil))
}

func parseSignature(value string) (ts, v1 string) {
	for _, part := range strings.Split(value, ",") {
		key, val, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		switch strings.TrimSpace(key) {
		case "ts":
			ts = strings.TrimSpace(val)
		case "v1":
			v1 = strings.TrimSpace(val)
		}
	}
	return ts, v1
}

func header(headers map[string]string, name string) string {
	for key, value := range headers {
		if strings.EqualFold(key, name) {
			return value
		}
	}
	return ""
}

// isOrderID: order ids are letters and digits ("ORDTST01M7..."); anything else never reaches the API path
func isOrderID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for _, r := range id {
		if !(r >= '0' && r <= '9' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z') {
			return false
		}
	}
	return true
}

type apiError struct {
	Message string `json:"message"`
	Error   string `json:"error"`
}

// do calls the API with the access token. 404 = domain.ErrDataNotFound; other errors wrap ErrBillingProvider.
func (c *Client) do(ctx context.Context, method, path, idempotencyKey string, in, out any) error {
	var body io.Reader
	if in != nil {
		payload, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.settings.BaseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.settings.AccessToken)
	req.Header.Set("Accept", "application/json")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idempotencyKey != "" {
		req.Header.Set("X-Idempotency-Key", idempotencyKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", domain.ErrBillingProvider, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponse))
	if err != nil {
		return fmt.Errorf("%w: %v", domain.ErrBillingProvider, err)
	}

	if resp.StatusCode == http.StatusNotFound {
		return domain.ErrDataNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		var e apiError
		_ = json.Unmarshal(data, &e)
		// the message only: never the request (no secrets in logs)
		return fmt.Errorf("%w: status %d %s %s", domain.ErrBillingProvider, resp.StatusCode, e.Error, e.Message)
	}
	if out == nil {
		return nil
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err = decoder.Decode(out); err != nil {
		return errors.Join(domain.ErrBillingProvider, err)
	}
	return nil
}
