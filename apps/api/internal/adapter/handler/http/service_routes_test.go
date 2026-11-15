package http

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

// workerRoutes are the routes only the worker calls (apps/worker/worker/api_client.py)
var workerRoutes = []struct{ method, path string }{
	{http.MethodGet, "/accounts/admin/list"},
	{http.MethodPost, "/transactions/admin/create"},
	{http.MethodGet, "/email/u1/1"},
	{http.MethodPut, "/email/admin/error/1"},
	{http.MethodPut, "/user-extra/admin/read-email"},
}

// newFullRouter registers every route with empty handlers: the requests below never reach a handler
func newFullRouter(t *testing.T, env string) (*gin.Engine, *mock.MockUserService) {
	ctrl := gomock.NewController(t)
	users := mock.NewMockUserService(ctrl)

	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})

	routes := &Routes{
		HealthHandler:         &HealthHandler{},
		UserHandler:           &UserHandler{svc: users},
		UserExtraHandler:      &UserExtraHandler{},
		CategoryHandler:       &CategoryHandler{},
		BankHandler:           &BankHandler{},
		AccountTypeHandler:    &AccountTypeHandler{},
		AccountHandler:        &AccountHandler{},
		TransactionHandler:    &TransactionHandler{},
		AnalysisHandler:       &AnalysisHandler{},
		FxHandler:             &FxHandler{},
		ValuationHandler:      &ValuationHandler{},
		CurrencyChangeHandler: &CurrencyChangeHandler{},
		CreditCardHandler:     &CreditCardHandler{},
		EmailHandler:          &EmailHandler{},
		InitDevHandler:        &InitDevHandler{},
		InitializationHandler: &InitializationHandler{},
		Router:                gin.New(),
	}
	routes.Init(env)

	return routes.Router, users
}

func TestServiceRoutes_RejectEveryJWT(t *testing.T) {
	adminPayload := &domain.TokenPayload{UserID: "a1", Groups: map[string]bool{enums.AdminRole: true}, Use: "access"}

	for _, route := range workerRoutes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			router, users := newFullRouter(t, "development")
			// the bearer is never even checked: a valid admin token gets 403
			users.EXPECT().Authorize(gomock.Any(), gomock.Any()).Return(adminPayload, nil).AnyTimes()

			w := doRequest(router, route.method, route.path, map[string]string{"Authorization": "Bearer admin-token"})
			assert.Equal(t, http.StatusForbidden, w.Code)

			w = doRequest(router, route.method, route.path, nil)
			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}

func TestServiceRoutes_WrongAPIKey(t *testing.T) {
	for _, route := range workerRoutes {
		router, users := newFullRouter(t, "development")
		users.EXPECT().AuthorizeAPIKey("wrong").Return(nil, domain.ErrUnauthorized)

		w := doRequest(router, route.method, route.path, map[string]string{"X-API-Key": "wrong"})
		assert.Equal(t, http.StatusUnauthorized, w.Code, route.path)
	}
}

func TestServiceOnlyMiddleware(t *testing.T) {
	servicePayload := &domain.TokenPayload{UserID: "service", Groups: map[string]bool{enums.AdminRole: true}, Use: "access"}

	newRouter := func(t *testing.T) (*gin.Engine, *mock.MockUserService) {
		ctrl := gomock.NewController(t)
		users := mock.NewMockUserService(ctrl)
		gin.SetMode(gin.TestMode)
		logger.Set(&config.App{Env: "test"})
		router := gin.New()
		router.GET("/internal", ServiceOnlyMiddleware(users), func(ctx *gin.Context) {
			payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
			assert.NoError(t, err)
			assert.Equal(t, "service", payload.UserID)
			handleSuccess(ctx, nil)
		})
		return router, users
	}

	t.Run("X-API-Key passes", func(t *testing.T) {
		router, users := newRouter(t)
		users.EXPECT().AuthorizeAPIKey("internal-key").Return(servicePayload, nil)
		w := doRequest(router, http.MethodGet, "/internal", map[string]string{"X-API-Key": "internal-key"})
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("an admin JWT gets 403", func(t *testing.T) {
		router, _ := newRouter(t)
		w := doRequest(router, http.MethodGet, "/internal", map[string]string{"Authorization": "Bearer admin-token"})
		assert.Equal(t, http.StatusForbidden, w.Code)
	})
}

func TestRemovedRoutes_NotFound(t *testing.T) {
	removed := []struct{ method, path string }{
		{http.MethodGet, "/accounts/admin/list/by-bank"},
		{http.MethodDelete, "/user-extra/admin/u1"},
		{http.MethodPost, "/account-types/admin/create"},
		{http.MethodPut, "/account-types/admin/1"},
		{http.MethodDelete, "/account-types/admin/1"},
	}
	for _, route := range removed {
		router, users := newFullRouter(t, "development")
		users.EXPECT().AuthorizeAPIKey(gomock.Any()).Return(nil, domain.ErrUnauthorized).AnyTimes()
		users.EXPECT().Authorize(gomock.Any(), gomock.Any()).Return(nil, domain.ErrUnauthorized).AnyTimes()

		w := doRequest(router, route.method, route.path, map[string]string{"X-API-Key": "internal-key"})
		assert.Equal(t, http.StatusNotFound, w.Code, route.method+" "+route.path)
	}
}

func TestInitData_OnlyOutsideProduction(t *testing.T) {
	router, _ := newFullRouter(t, enums.Production)
	w := doRequest(router, http.MethodPost, "/init/data", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)

	router, _ = newFullRouter(t, "development")
	w = doRequest(router, http.MethodPost, "/init/data", nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code) // exists, needs a session
}
