package http

import (
	"bytes"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newBankCatalogRouter(t *testing.T) (*gin.Engine, *mock.MockUserService, *mock.MockAdminService, *mock.MockBankCatalogService) {
	ctrl := gomock.NewController(t)
	users := mock.NewMockUserService(ctrl)
	admin := mock.NewMockAdminService(ctrl)
	catalog := mock.NewMockBankCatalogService(ctrl)
	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})
	router := gin.New()
	routes := &Routes{UserHandler: &UserHandler{svc: users}, AdminHandler: NewAdminHandler(admin, nil),
		BankCatalogHandler: NewBankCatalogHandler(catalog), Router: router}
	routes.BankCatalogRoutes()
	return router, users, admin, catalog
}

func adminJSON(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestBankCatalogRoutes(t *testing.T) {
	user := &domain.TokenPayload{UserID: "u1", Groups: map[string]bool{"admin": false}}
	adminUser := &domain.TokenPayload{UserID: "a1", Groups: map[string]bool{"admin": true}}

	t.Run("a normal user cannot see nor edit the catalog", func(t *testing.T) {
		router, users, _, _ := newBankCatalogRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "user-token").Return(user, nil).Times(3)
		for _, route := range []struct{ method, path string }{
			{http.MethodGet, "/admin/banks"},
			{http.MethodGet, "/admin/banks/user-senders"},
			{http.MethodPost, "/admin/banks/1/senders"},
		} {
			w := doRequest(router, route.method, route.path, map[string]string{"Authorization": "Bearer user-token"})
			assert.Equal(t, http.StatusForbidden, w.Code, route.path)
		}
	})

	t.Run("an admin adds a sender and the access is audited", func(t *testing.T) {
		router, users, admin, catalog := newBankCatalogRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "admin-token").Return(adminUser, nil)
		admin.EXPECT().Audit(gomock.Any(), gomock.Any()).Return(nil)
		catalog.EXPECT().AddSender(gomock.Any(), uint64(3), "alertas@nequi.com.co", gomock.Any()).
			Return(&domain.CatalogSender{ID: 9, BankID: 3, Email: "alertas@nequi.com.co", Active: true}, nil)
		w := adminJSON(router, http.MethodPost, "/admin/banks/3/senders", `{"email":"alertas@nequi.com.co"}`)
		assert.Equal(t, http.StatusCreated, w.Code)
	})

	t.Run("an invalid sender is a 400", func(t *testing.T) {
		router, users, admin, catalog := newBankCatalogRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "admin-token").Return(adminUser, nil)
		admin.EXPECT().Audit(gomock.Any(), gomock.Any()).Return(nil)
		catalog.EXPECT().AddSender(gomock.Any(), uint64(3), "a,b", gomock.Any()).Return(nil, domain.ErrInvalidSenderEmail)
		w := adminJSON(router, http.MethodPost, "/admin/banks/3/senders", `{"email":"a,b"}`)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("the logo upload passes the bytes to the service", func(t *testing.T) {
		router, users, admin, catalog := newBankCatalogRouter(t)
		users.EXPECT().Authorize(gomock.Any(), "admin-token").Return(adminUser, nil)
		admin.EXPECT().Audit(gomock.Any(), gomock.Any()).Return(nil)
		png := []byte("\x89PNG\r\n\x1a\nDATA")
		catalog.EXPECT().PutLogo(gomock.Any(), uint64(2), png).Return(nil)
		body := &bytes.Buffer{}
		form := multipart.NewWriter(body)
		part, err := form.CreateFormFile("logo", "logo.png")
		require.NoError(t, err)
		_, _ = part.Write(png)
		require.NoError(t, form.Close())
		req := httptest.NewRequest(http.MethodPut, "/admin/banks/2/logo", body)
		req.Header.Set("Authorization", "Bearer admin-token")
		req.Header.Set("Content-Type", form.FormDataContentType())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("the logo is public, cached and locked down", func(t *testing.T) {
		router, _, _, catalog := newBankCatalogRouter(t)
		svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)
		catalog.EXPECT().GetLogo(gomock.Any(), uint64(4)).
			Return(&domain.BankLogo{BankID: 4, ContentType: "image/svg+xml", Bytes: svg, ETag: "abc"}, nil).Times(2)
		w := doRequest(router, http.MethodGet, "/banks/catalog/4/logo?v=abc", nil)
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "image/svg+xml", w.Header().Get("Content-Type"))
		assert.Contains(t, w.Header().Get("Content-Security-Policy"), "default-src 'none'")
		assert.Equal(t, `"abc"`, w.Header().Get("ETag"))
		w = doRequest(router, http.MethodGet, "/banks/catalog/4/logo", map[string]string{"If-None-Match": `"abc"`})
		assert.Equal(t, http.StatusNotModified, w.Code)
	})

	t.Run("a bank without logo is a 404", func(t *testing.T) {
		router, _, _, catalog := newBankCatalogRouter(t)
		catalog.EXPECT().GetLogo(gomock.Any(), uint64(5)).Return(nil, domain.ErrDataNotFound)
		w := doRequest(router, http.MethodGet, "/banks/catalog/5/logo", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}
