package http

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newBillingRouter(t *testing.T) (*gin.Engine, *mock.MockUserService, *mock.MockBillingService) {
	ctrl := gomock.NewController(t)
	users := mock.NewMockUserService(ctrl)
	billing := mock.NewMockBillingService(ctrl)
	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})

	router := gin.New()
	routes := &Routes{UserHandler: &UserHandler{svc: users}, BillingHandler: NewBillingHandler(billing), Router: router}
	routes.BillingRoutes()
	return router, users, billing
}

func billingRequest(router *gin.Engine, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

var userAuth = map[string]string{"Authorization": "Bearer user-token"}

func expectUser(users *mock.MockUserService, userID string) {
	users.EXPECT().Authorize(gomock.Any(), "user-token").
		Return(&domain.TokenPayload{UserID: userID, Groups: map[string]bool{"admin": false}}, nil)
}

func TestBillingRoutes_NeedSession(t *testing.T) {
	router, _, _ := newBillingRouter(t)
	for _, route := range []struct{ method, path string }{
		{http.MethodGet, "/billing/config"},
		{http.MethodPost, "/billing/support"},
		{http.MethodGet, "/billing/payments/p1"},
	} {
		w := billingRequest(router, route.method, route.path, `{"amount":"20000"}`, nil)
		assert.Equal(t, http.StatusUnauthorized, w.Code, route.path)
	}
}

func TestBillingStartSupport(t *testing.T) {
	router, users, billing := newBillingRouter(t)

	expectUser(users, "u1")
	billing.EXPECT().StartSupport(gomock.Any(), "u1", "20000").
		Return(&domain.CheckoutSession{PaymentID: "p1", CheckoutURL: "https://mp.test/c", CheckoutRef: "pref-secret"}, nil)
	w := billingRequest(router, http.MethodPost, "/billing/support", `{"amount":"20000"}`, userAuth)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"checkout_url":"https://mp.test/c"`)
	assert.NotContains(t, w.Body.String(), "pref-secret", "the preference id stays in the server")

	expectUser(users, "u1")
	billing.EXPECT().StartSupport(gomock.Any(), "u1", "1").Return(nil, domain.ErrInvalidSupportAmount)
	w = billingRequest(router, http.MethodPost, "/billing/support", `{"amount":"1"}`, userAuth)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	expectUser(users, "u1")
	w = billingRequest(router, http.MethodPost, "/billing/support", `{}`, userAuth)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	expectUser(users, "u1")
	billing.EXPECT().StartSupport(gomock.Any(), "u1", "20000").Return(nil, domain.ErrBillingDisabled)
	w = billingRequest(router, http.MethodPost, "/billing/support", `{"amount":"20000"}`, userAuth)
	assert.Equal(t, http.StatusNotFound, w.Code)

	// internal callers (X-API-Key) cannot pay
	users.EXPECT().AuthorizeAPIKey("internal").Return(&domain.TokenPayload{UserID: "service", Groups: map[string]bool{"admin": true}}, nil)
	w = billingRequest(router, http.MethodPost, "/billing/support", `{"amount":"20000"}`, map[string]string{"X-API-Key": "internal"})
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestBillingGetPaymentAndConfig(t *testing.T) {
	router, users, billing := newBillingRouter(t)

	expectUser(users, "u1")
	billing.EXPECT().GetPayment(gomock.Any(), "u1", "p1").Return(&domain.PaymentView{ID: "p1", Amount: "20000", Status: "approved"}, nil)
	w := billingRequest(router, http.MethodGet, "/billing/payments/p1", "", userAuth)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"amount":"20000"`)

	expectUser(users, "u2")
	billing.EXPECT().GetPayment(gomock.Any(), "u2", "p1").Return(nil, domain.ErrDataNotFound)
	w = billingRequest(router, http.MethodGet, "/billing/payments/p1", "", userAuth)
	assert.Equal(t, http.StatusNotFound, w.Code)

	expectUser(users, "u1")
	billing.EXPECT().Config().Return(domain.BillingConfig{Enabled: true, Presets: []string{"10000"}})
	w = billingRequest(router, http.MethodGet, "/billing/config", "", userAuth)
	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data domain.BillingConfig `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.True(t, body.Data.Enabled)
}

func TestBillingWebhook(t *testing.T) {
	router, _, billing := newBillingRouter(t)
	headers := map[string]string{"X-Signature": "ts=1,v1=abc", "X-Request-Id": "r1"}
	body := `{"type":"payment","data":{"id":"1234"}}`

	// the handler passes headers, query and body untouched; no session needed
	billing.EXPECT().HandleWebhook(gomock.Any(), "mercadopago", gomock.Any()).DoAndReturn(
		func(_ any, _ string, req domain.WebhookRequest) error {
			assert.Equal(t, "ts=1,v1=abc", req.Headers["X-Signature"])
			assert.Equal(t, "r1", req.Headers["X-Request-Id"])
			assert.Equal(t, "1234", req.Query["data.id"])
			assert.Equal(t, body, string(req.Body))
			return nil
		})
	w := billingRequest(router, http.MethodPost, "/billing/webhook/mercadopago?data.id=1234&type=payment", body, headers)
	assert.Equal(t, http.StatusOK, w.Code)

	billing.EXPECT().HandleWebhook(gomock.Any(), "mercadopago", gomock.Any()).Return(domain.ErrInvalidWebhookSignature)
	w = billingRequest(router, http.MethodPost, "/billing/webhook/mercadopago?data.id=1234", body, headers)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	billing.EXPECT().HandleWebhook(gomock.Any(), "wompi", gomock.Any()).Return(domain.ErrUnknownPaymentProvider)
	w = billingRequest(router, http.MethodPost, "/billing/webhook/wompi", body, headers)
	assert.Equal(t, http.StatusNotFound, w.Code)

	// a failure of ours: 5xx so the provider retries
	billing.EXPECT().HandleWebhook(gomock.Any(), "mercadopago", gomock.Any()).Return(errors.New("db down"))
	w = billingRequest(router, http.MethodPost, "/billing/webhook/mercadopago?data.id=1234", body, headers)
	assert.GreaterOrEqual(t, w.Code, 500)

	// too large
	w = billingRequest(router, http.MethodPost, "/billing/webhook/mercadopago", strings.Repeat("x", maxWebhookBody+10), headers)
	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestAdminMoney(t *testing.T) {
	_, users, admin, _ := newAdminRouterWithFounders(t)
	ctrl := gomock.NewController(t)
	billing := mock.NewMockBillingService(ctrl)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	handler := NewAdminHandler(admin, mock.NewMockFounderService(ctrl))
	handler.SetBilling(billing)
	routes := &Routes{UserHandler: &UserHandler{svc: users}, AdminHandler: handler, Router: r}
	routes.AdminRoutes()

	users.EXPECT().Authorize(gomock.Any(), "admin-token").
		Return(&domain.TokenPayload{UserID: "a1", Groups: map[string]bool{"admin": true}}, nil)
	admin.EXPECT().Audit(gomock.Any(), gomock.Any()).Return(nil)
	billing.EXPECT().Money(gomock.Any()).Return(&domain.MoneyReport{Enabled: true, Total: "30000", Payments: 2}, nil)
	w := doRequest(r, http.MethodGet, "/admin/money", map[string]string{"Authorization": "Bearer admin-token"})
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"total":"30000"`)
}
