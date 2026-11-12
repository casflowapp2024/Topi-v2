package http

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

var adminRoutes = []struct{ method, path string }{
	{http.MethodGet, "/admin/metrics/summary"},
	{http.MethodGet, "/admin/metrics/activation"},
	{http.MethodGet, "/admin/metrics/cohorts"},
	{http.MethodGet, "/admin/metrics/reading"},
	{http.MethodGet, "/admin/metrics/quality"},
	{http.MethodGet, "/admin/metrics/catalog"},
	{http.MethodGet, "/admin/metrics/costs"},
	{http.MethodPost, "/admin/metrics/refresh"},
	{http.MethodGet, "/admin/users"},
}

func newAdminRouter(t *testing.T) (*gin.Engine, *mock.MockUserService, *mock.MockAdminService) {
	ctrl := gomock.NewController(t)
	users := mock.NewMockUserService(ctrl)
	admin := mock.NewMockAdminService(ctrl)
	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})

	router := gin.New()
	routes := &Routes{UserHandler: &UserHandler{svc: users}, AdminHandler: NewAdminHandler(admin), Router: router}
	routes.AdminRoutes()
	return router, users, admin
}

func TestAdminRoutes_NormalUserGets403AndNothingRuns(t *testing.T) {
	for _, route := range adminRoutes {
		t.Run(route.path, func(t *testing.T) {
			router, users, _ := newAdminRouter(t)
			users.EXPECT().Authorize(gomock.Any(), "user-token").
				Return(&domain.TokenPayload{UserID: "u2", Groups: map[string]bool{"admin": false}}, nil)

			// the admin service mock has no expectations: any call (audit included) fails the test
			w := doRequest(router, route.method, route.path, map[string]string{"Authorization": "Bearer user-token"})

			assert.Equal(t, http.StatusForbidden, w.Code)
		})
	}
}

func TestAdminRoutes_WithoutTokenGets401(t *testing.T) {
	router, _, _ := newAdminRouter(t)
	w := doRequest(router, http.MethodGet, "/admin/metrics/summary", nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAdminRoutes_AdminIsAudited(t *testing.T) {
	router, users, admin := newAdminRouter(t)
	users.EXPECT().Authorize(gomock.Any(), "admin-token").
		Return(&domain.TokenPayload{UserID: "a1", Groups: map[string]bool{"admin": true}}, nil).Times(2)

	admin.EXPECT().Audit(gomock.Any(), domain.AdminAudit{
		AdminID: "a1", Action: domain.AdminActionView, Target: "/admin/users",
		Detail: map[string]any{"method": http.MethodGet, "query": "segment=active7"},
	}).Return(nil)
	admin.EXPECT().Users(gomock.Any(), domain.AdminUserFilter{Segment: "active7"}).
		Return(&domain.AdminUserPage{Rows: []domain.AdminUserRow{}}, nil)

	w := doRequest(router, http.MethodGet, "/admin/users?segment=active7", map[string]string{"Authorization": "Bearer admin-token"})
	assert.Equal(t, http.StatusOK, w.Code)

	// without the audit row the panel is not served
	admin.EXPECT().Audit(gomock.Any(), gomock.Any()).Return(errors.New("db down"))
	w = doRequest(router, http.MethodGet, "/admin/metrics/summary", map[string]string{"Authorization": "Bearer admin-token"})
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestAdminRoutes_WorkerKeyIsNotAnAdminSession(t *testing.T) {
	// the worker's X-API-Key is admin for internal routes; the panel audits it under "service"
	router, users, admin := newAdminRouter(t)
	users.EXPECT().AuthorizeAPIKey("internal-key").
		Return(&domain.TokenPayload{UserID: "service", Groups: map[string]bool{"admin": true}}, nil)
	admin.EXPECT().Audit(gomock.Any(), gomock.Any()).DoAndReturn(func(_ any, audit domain.AdminAudit) error {
		assert.Equal(t, "service", audit.AdminID)
		return nil
	})
	admin.EXPECT().Cohorts(gomock.Any()).Return([]domain.Cohort{}, nil)

	req := httptest.NewRequest(http.MethodGet, "/admin/metrics/cohorts", nil)
	req.Header.Set("X-API-Key", "internal-key")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
