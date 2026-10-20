package http

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

// newAuthRouter registers /private (any authenticated caller) and /admin (admin only)
func newAuthRouter(t *testing.T) (*gin.Engine, *mock.MockUserService) {
	ctrl := gomock.NewController(t)
	svc := mock.NewMockUserService(ctrl)

	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})

	router := gin.New()
	ok := func(ctx *gin.Context) { handleSuccess(ctx, nil) }
	router.GET("/private", AuthMiddleware(svc), ok)
	router.GET("/admin", AuthMiddleware(svc), AdminMiddleware(), ok)

	return router, svc
}

func doRequest(router *gin.Engine, method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func errorMessages(t *testing.T, w *httptest.ResponseRecorder) []string {
	var body struct {
		Messages []string `json:"messages"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	return body.Messages
}

func TestAuthMiddleware_APIKey(t *testing.T) {
	servicePayload := &domain.TokenPayload{UserID: "service", Groups: map[string]bool{"admin": true}, Use: "access"}

	t.Run("valid key reaches admin routes", func(t *testing.T) {
		router, svc := newAuthRouter(t)
		svc.EXPECT().AuthorizeAPIKey("internal-key").Return(servicePayload, nil)

		w := doRequest(router, http.MethodGet, "/admin", map[string]string{"X-API-Key": "internal-key"})

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("invalid key is rejected even with a bearer token", func(t *testing.T) {
		router, svc := newAuthRouter(t)
		svc.EXPECT().AuthorizeAPIKey("wrong").Return(nil, domain.ErrUnauthorized)

		w := doRequest(router, http.MethodGet, "/private", map[string]string{
			"X-API-Key":     "wrong",
			"Authorization": "Bearer some-token",
		})

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Equal(t, []string{domain.ErrUnauthorized.Error()}, errorMessages(t, w))
	})
}

func TestAuthMiddleware_Bearer(t *testing.T) {
	t.Run("admin user reaches admin routes", func(t *testing.T) {
		router, svc := newAuthRouter(t)
		svc.EXPECT().Authorize(gomock.Any(), "admin-token").
			Return(&domain.TokenPayload{UserID: "u1", Groups: map[string]bool{"admin": true}}, nil)

		w := doRequest(router, http.MethodGet, "/admin", map[string]string{"Authorization": "Bearer admin-token"})

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("normal user gets 403 on admin routes", func(t *testing.T) {
		router, svc := newAuthRouter(t)
		svc.EXPECT().Authorize(gomock.Any(), "user-token").
			Return(&domain.TokenPayload{UserID: "u2", Groups: map[string]bool{"admin": false}}, nil)

		w := doRequest(router, http.MethodGet, "/admin", map[string]string{"Authorization": "Bearer user-token"})

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Equal(t, []string{domain.ErrForbidden.Error()}, errorMessages(t, w))
	})

	t.Run("stale token (token_version changed) gets 401", func(t *testing.T) {
		router, svc := newAuthRouter(t)
		svc.EXPECT().Authorize(gomock.Any(), "old-token").Return(nil, domain.ErrUnauthorized)

		w := doRequest(router, http.MethodGet, "/private", map[string]string{"Authorization": "Bearer old-token"})

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("missing header gets 401", func(t *testing.T) {
		router, _ := newAuthRouter(t)

		w := doRequest(router, http.MethodGet, "/private", nil)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Equal(t, []string{domain.ErrEmptyAuthorizationHeader.Error()}, errorMessages(t, w))
	})
}
