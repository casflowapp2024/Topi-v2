package http

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubGmailQuota struct{ ok bool }

func (s stubGmailQuota) Quota(context.Context) (*domain.GmailQuota, error) {
	return &domain.GmailQuota{}, nil
}
func (s stubGmailQuota) CanConnectNew(context.Context) (bool, error) { return s.ok, nil }

func gmailQuotaRouter(h *EmailHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})
	router := gin.New()
	auth := func(ctx *gin.Context) {
		ctx.Set(enums.AuthorizationPayloadKey, &domain.TokenPayload{UserID: "user-1"})
	}
	router.GET("/email/gmail-capacity", auth, h.GmailCapacity)
	router.GET("/email/auth-url", auth, h.GetAuthURL)
	return router
}

// plan/28 §7: the front asks before offering Gmail; with no room it gets the message for the user
func TestEmailHandler_GmailCapacity(t *testing.T) {
	for _, ok := range []bool{true, false} {
		h := NewEmailHandler(nil)
		h.SetGmailQuota(stubGmailQuota{ok: ok})
		w := httptest.NewRecorder()
		gmailQuotaRouter(h).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/email/gmail-capacity", nil))
		require.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data struct {
				Available bool   `json:"available"`
				Message   string `json:"message"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, ok, body.Data.Available)
		if ok {
			assert.Empty(t, body.Data.Message)
		} else {
			assert.Equal(t, domain.GmailFullMessage, body.Data.Message)
		}
	}
}

func TestEmailHandler_AuthURL_GmailFullIs409AndReconnectPassesTheID(t *testing.T) {
	ctrl := gomock.NewController(t)
	svc := mock.NewMockEmailService(ctrl)
	id := uint64(9)
	svc.EXPECT().GetUserAuthURL(gomock.Any(), "user-1", "gmail", nil).Return(nil, domain.ErrGmailFull)
	url := "https://accounts.google.com/o/oauth2/auth?x=1"
	svc.EXPECT().GetUserAuthURL(gomock.Any(), "user-1", "gmail", &id).Return(&url, nil)
	router := gmailQuotaRouter(NewEmailHandler(svc))

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/email/auth-url?provider=gmail", nil))
	assert.Equal(t, http.StatusConflict, w.Code)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/email/auth-url?provider=gmail&reconnect=9", nil))
	assert.Equal(t, http.StatusOK, w.Code)
}
