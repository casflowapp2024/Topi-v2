package http

import (
	"bytes"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func newFeedbackRouter(t *testing.T) (*gin.Engine, *mock.MockUserService, *mock.MockAdminService, *mock.MockFeedbackService) {
	ctrl := gomock.NewController(t)
	users := mock.NewMockUserService(ctrl)
	admin := mock.NewMockAdminService(ctrl)
	feedback := mock.NewMockFeedbackService(ctrl)
	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})
	router := gin.New()
	routes := &Routes{UserHandler: &UserHandler{svc: users}, AdminHandler: NewAdminHandler(admin, nil),
		FeedbackHandler: NewFeedbackHandler(feedback), Router: router}
	routes.FeedbackRoutes()
	return router, users, admin, feedback
}

func TestFeedbackRoutes(t *testing.T) {
	user := &domain.TokenPayload{UserID: "u1", Groups: map[string]bool{"admin": false}}
	adminUser := &domain.TokenPayload{UserID: "a1", Groups: map[string]bool{"admin": true}}

	t.Run("a normal user cannot read the opinions", func(t *testing.T) {
		router, users, _, _ := newFeedbackRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "user-token").Return(user, nil).Times(2)
		w := doRequest(router, http.MethodGet, "/admin/feedback", map[string]string{"Authorization": "Bearer user-token"})
		assert.Equal(t, http.StatusForbidden, w.Code)
		w = doRequest(router, http.MethodPost, "/admin/feedback/1/read", map[string]string{"Authorization": "Bearer user-token"})
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("an admin reads them and the access is audited", func(t *testing.T) {
		router, users, admin, feedback := newFeedbackRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "admin-token").Return(adminUser, nil)
		admin.EXPECT().Audit(gomock.Any(), gomock.Any()).DoAndReturn(func(_ any, audit domain.AdminAudit) error {
			assert.Equal(t, "/admin/feedback", audit.Target)
			return nil
		})
		feedback.EXPECT().List(gomock.Any(), true).Return(&domain.FeedbackPage{}, nil)
		w := doRequest(router, http.MethodGet, "/admin/feedback?unread=true", map[string]string{"Authorization": "Bearer admin-token"})
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("the fourth of the day gets 429", func(t *testing.T) {
		router, users, _, feedback := newFeedbackRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "user-token").Return(user, nil)
		feedback.EXPECT().Submit(gomock.Any(), "u1", gomock.Any()).Return(domain.ErrLimitExceededException)
		req := httptest.NewRequest(http.MethodPost, "/feedback", bytes.NewBufferString(`{"text":"hola","contact_ok":true}`))
		req.Header.Set("Authorization", "Bearer user-token")
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusTooManyRequests, w.Code)
	})
}
