// Package mercadopago implements port.Billing with the Mercado Pago HTTP API (Checkout Pro, no SDK).
// Docs read on 2026-11-13 (plan/22-modelo-negocio.md): preferences, payment notifications (x-signature) and
// GET /v1/payments. It never sees card data: the buyer pays in the Mercado Pago checkout.
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
	// NotificationURL is the public webhook URL (empty = the one configured in Tus integraciones)
	NotificationURL string
	// AllowLive: only production accepts payments with live_mode=true (sandbox everywhere else)
	AllowLive bool
	// UseSandboxURL opens sandbox_init_point instead of init_point
	UseSandboxURL bool
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
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	Quantity    int         `json:"quantity"`
	UnitPrice   json.Number `json:"unit_price"`
	CurrencyID  string      `json:"currency_id"`
	Description string      `json:"description,omitempty"`
}

type tax struct {
	Type  string `json:"type"`
	Value int64  `json:"value"`
}

type backURLs struct {
	Success string `json:"success"`
	Failure string `json:"failure"`
	Pending string `json:"pending"`
}

type preferenceRequest struct {
	Items               []item    `json:"items"`
	Taxes               []tax     `json:"taxes"`
	ExternalReference   string    `json:"external_reference"`
	BackURLs            *backURLs `json:"back_urls,omitempty"`
	AutoReturn          string    `json:"auto_return,omitempty"`
	NotificationURL     string    `json:"notification_url,omitempty"`
	StatementDescriptor string    `json:"statement_descriptor"`
}

type preferenceResponse struct {
	ID               string `json:"id"`
	InitPoint        string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

// CreateCheckout creates a preference (one per payment) and returns its checkout URL
func (c *Client) CreateCheckout(ctx context.Context, req domain.CheckoutRequest) (*domain.CheckoutSession, error) {
	body := preferenceRequest{
		Items: []item{{ID: "apoyo-topi", Title: req.Title, Quantity: 1, UnitPrice: json.Number(req.Amount.String()),
			CurrencyID: req.Currency}},
		// a voluntary contribution: without taxes Mercado Pago assumes 19% VAT included (to validate with
		// the accountant, plan/22)
		Taxes:               []tax{{Type: "IVA", Value: 0}},
		ExternalReference:   req.PaymentID,
		NotificationURL:     c.settings.NotificationURL,
		StatementDescriptor: "TOPI",
	}
	if req.ReturnURL != "" {
		back := req.ReturnURL + "?payment=" + url.QueryEscape(req.PaymentID)
		body.BackURLs = &backURLs{Success: back, Failure: back, Pending: back}
		// auto_return needs a public https URL (Mercado Pago rejects localhost)
		if strings.HasPrefix(req.ReturnURL, "https://") {
			body.AutoReturn = "approved"
		}
	}

	var out preferenceResponse
	if err := c.do(ctx, http.MethodPost, "/checkout/preferences", body, &out); err != nil {
		return nil, err
	}
	checkoutURL := out.InitPoint
	if c.settings.UseSandboxURL && out.SandboxInitPoint != "" {
		checkoutURL = out.SandboxInitPoint
	}
	if out.ID == "" || checkoutURL == "" {
		return nil, fmt.Errorf("%w: preference without id or init_point", domain.ErrBillingProvider)
	}
	return &domain.CheckoutSession{PaymentID: req.PaymentID, CheckoutURL: checkoutURL, CheckoutRef: out.ID}, nil
}

type paymentResponse struct {
	ID                json.Number     `json:"id"`
	Status            string          `json:"status"`
	StatusDetail      string          `json:"status_detail"`
	ExternalReference string          `json:"external_reference"`
	TransactionAmount decimal.Decimal `json:"transaction_amount"`
	CurrencyID        string          `json:"currency_id"`
	LiveMode          bool            `json:"live_mode"`
}

// GetPayment reads a payment (GET /v1/payments/{id})
func (c *Client) GetPayment(ctx context.Context, providerRef string) (*domain.ProviderPayment, error) {
	if !isPaymentID(providerRef) {
		return nil, domain.ErrDataNotFound
	}
	var out paymentResponse
	if err := c.do(ctx, http.MethodGet, "/v1/payments/"+providerRef, nil, &out); err != nil {
		return nil, err
	}
	pp, ok := c.toProvider(out)
	if !ok {
		return nil, domain.ErrDataNotFound
	}
	return &pp, nil
}

type searchResponse struct {
	Results []paymentResponse `json:"results"`
}

// FindPayments lists the payments of an external reference (oldest first: the latest is applied last)
func (c *Client) FindPayments(ctx context.Context, externalRef string) ([]domain.ProviderPayment, error) {
	query := url.Values{"external_reference": {externalRef}, "sort": {"date_created"}, "criteria": {"asc"}}
	var out searchResponse
	if err := c.do(ctx, http.MethodGet, "/v1/payments/search?"+query.Encode(), nil, &out); err != nil {
		return nil, err
	}
	payments := make([]domain.ProviderPayment, 0, len(out.Results))
	for _, r := range out.Results {
		if pp, ok := c.toProvider(r); ok && pp.ExternalReference == externalRef {
			payments = append(payments, pp)
		}
	}
	return payments, nil
}

// toProvider maps a payment; a live payment outside production is dropped (sandbox only)
func (c *Client) toProvider(r paymentResponse) (domain.ProviderPayment, bool) {
	if r.LiveMode && !c.settings.AllowLive {
		slog.Error("mercadopago: live payment ignored outside production", "provider_ref", r.ID.String())
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
		Ref: r.ID.String(), ExternalReference: r.ExternalReference, Status: MapStatus(r.Status), RawStatus: raw,
		Amount: r.TransactionAmount, Currency: strings.ToUpper(r.CurrencyID), LiveMode: r.LiveMode,
	}, true
}

// MapStatus maps a Mercado Pago payment status to ours
func MapStatus(status string) string {
	switch status {
	case "approved":
		return domain.PaymentApproved
	case "rejected":
		return domain.PaymentRejected
	case "cancelled":
		return domain.PaymentCancelled
	case "refunded", "charged_back":
		return domain.PaymentRefunded
	default:
		// pending, authorized, in_process, in_mediation and anything new
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
// with data.id from the query string (lowercased); a missing value is left out of the manifest.
// Only payment notifications return a reference; any other topic is verified and ignored.
func (c *Client) VerifyWebhook(req domain.WebhookRequest) (*domain.WebhookNotice, error) {
	if c.settings.WebhookSecret == "" {
		return nil, domain.ErrInvalidWebhookSignature
	}
	ts, v1 := parseSignature(header(req.Headers, "x-signature"))
	if ts == "" || v1 == "" {
		return nil, domain.ErrInvalidWebhookSignature
	}
	dataID := strings.ToLower(req.Query["data.id"])
	requestID := header(req.Headers, "x-request-id")

	var manifest strings.Builder
	if dataID != "" {
		manifest.WriteString("id:" + dataID + ";")
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
	if topic != "payment" || !isPaymentID(dataID) {
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

// isPaymentID: Mercado Pago payment ids are numbers (anything else never reaches the API path)
func isPaymentID(id string) bool {
	if id == "" || len(id) > 30 {
		return false
	}
	for _, r := range id {
		if r < '0' || r > '9' {
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
func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
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
