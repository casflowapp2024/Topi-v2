package http

import (
	"bytes"
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

func newMailRouter(t *testing.T) (*gin.Engine, *mock.MockUserService, *mock.MockNotificationService) {
	router, users, prefs, _, _ := newMailRouterFull(t)
	return router, users, prefs
}

func newMailRouterFull(t *testing.T) (*gin.Engine, *mock.MockUserService, *mock.MockNotificationService, *mock.MockMailService, *mock.MockMailEventParser) {
	ctrl := gomock.NewController(t)
	users := mock.NewMockUserService(ctrl)
	prefs := mock.NewMockNotificationService(ctrl)
	mail := mock.NewMockMailService(ctrl)
	events := mock.NewMockMailEventParser(ctrl)

	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})
	registerValidators()

	routes := Routes{UserHandler: NewUserHandler(users), MailHandler: NewMailHandler(prefs, mail, events, "https://www.topi.test"), Router: gin.New()}
	routes.MailRoutes()
	return routes.Router, users, prefs, mail, events
}

func TestMailHandler_NotificationPrefs(t *testing.T) {
	router, users, prefs := newMailRouter(t)
	users.EXPECT().Authorize(gomock.Any(), "jwt").Return(&domain.TokenPayload{UserID: "u1", Groups: map[string]bool{}}, nil).AnyTimes()
	prefs.EXPECT().GetPrefs(gomock.Any(), "u1").Return(domain.DefaultNotificationPrefs(), nil)
	prefs.EXPECT().UpdatePrefs(gomock.Any(), "u1", domain.NotificationPrefs{MonthlySummary: true, ConnectionAlerts: false}).
		Return(domain.NotificationPrefs{MonthlySummary: true}, nil)

	do := func(method, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/users/notification-prefs", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer jwt")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	w := do(http.MethodGet, "")
	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data map[string]bool `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, map[string]bool{"email_monthly_summary": false, "email_connection_alerts": true, "email_product_news": false}, body.Data)

	w = do(http.MethodPut, `{"email_monthly_summary":true,"email_connection_alerts":false}`)
	assert.Equal(t, http.StatusOK, w.Code)

	// a partial body never turns something off by omission
	w = do(http.MethodPut, `{"email_monthly_summary":true}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestMailHandler_Unsubscribe(t *testing.T) {
	router, _, prefs := newMailRouter(t)
	prefs.EXPECT().CheckUnsubscribe("good").Return(domain.UnsubMonthlySummary, nil)
	prefs.EXPECT().CheckUnsubscribe("bad").Return("", domain.ErrInvalidUnsubscribeToken)
	prefs.EXPECT().Unsubscribe(gomock.Any(), "good").Return(domain.UnsubMonthlySummary, nil)
	prefs.EXPECT().Unsubscribe(gomock.Any(), "bad").Return("", domain.ErrInvalidUnsubscribeToken)

	// GET only shows the button (mail scanners open links)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/mail/unsubscribe?t=good", nil))
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `<form method="post"`)
	assert.Contains(t, w.Body.String(), "el resumen mensual")
	assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/mail/unsubscribe?t=bad", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)

	// POST (button or one-click List-Unsubscribe-Post) applies it
	req := httptest.NewRequest(http.MethodPost, "/mail/unsubscribe?t=good", strings.NewReader("List-Unsubscribe=One-Click"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Ya no recibirás el resumen mensual")
	assert.Contains(t, w.Body.String(), "https://www.topi.test/dashboard?settings=emails")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/mail/unsubscribe?t=bad", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "El enlace no es válido")
}

func TestMailHandler_ResendWebhook(t *testing.T) {
	router, _, _, mail, events := newMailRouterFull(t)
	event := &domain.MailEvent{Type: domain.MailEventBounced, ProviderID: "re_1"}
	gomock.InOrder(
		events.EXPECT().Parse("msg_1", "1700000000", "v1,bad", []byte(`{"type":"email.bounced"}`)).Return(nil, errors.New("invalid webhook signature")),
		events.EXPECT().Parse("msg_1", "1700000000", "v1,good", []byte(`{"type":"email.bounced"}`)).Return(event, nil),
	)
	mail.EXPECT().HandleEvent(gomock.Any(), *event).Return(nil)

	send := func(signature string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/mail/webhook/resend", strings.NewReader(`{"type":"email.bounced"}`))
		req.Header.Set("svix-id", "msg_1")
		req.Header.Set("svix-timestamp", "1700000000")
		req.Header.Set("svix-signature", signature)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	assert.Equal(t, http.StatusUnauthorized, send("v1,bad").Code, "invalid signature: 401 and nothing is applied")
	assert.Equal(t, http.StatusOK, send("v1,good").Code)
}
