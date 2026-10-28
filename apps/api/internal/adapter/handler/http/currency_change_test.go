package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func currencyChangeRouter(svc *mock.MockCurrencyChangeService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewCurrencyChangeHandler(svc)
	r := gin.New()
	auth := func(ctx *gin.Context) { setupAnalysisAuthContext(ctx, "user123") }
	accounts := r.Group("/accounts").Use(auth)
	accounts.PUT("/:id", func(ctx *gin.Context) { ctx.Status(http.StatusTeapot) })
	accounts.POST("/:id/currency", h.ChangeAccountCurrency)
	accounts.GET("/:id/currency-changes", h.ListAccountCurrencyChanges)
	accounts.POST("/:id/currency-changes/:change_id/undo", h.UndoAccountCurrencyChange)
	accounts.POST("/:id/close", h.CloseAccount)
	accounts.POST("/:id/reopen", h.ReopenAccount)
	r.Group("/user-extra").Use(auth).POST("base-currency", h.ChangeBaseCurrency)
	return r
}

func TestCurrencyChangeHandler(t *testing.T) {
	t.Run("vista previa de una conversión", func(t *testing.T) {
		svc := mock.NewMockCurrencyChangeService(gomock.NewController(t))
		svc.EXPECT().ChangeAccountCurrency(gomock.Any(), gomock.Any()).DoAndReturn(func(_ any, c *domain.AccountCurrencyChange) error {
			assert.Equal(t, uint64(3), c.AccountID)
			assert.Equal(t, "convert", c.Mode)
			assert.False(t, c.Apply)
			c.OldCurrency, c.TxCount = "COP", 3
			c.BalanceBefore, c.BalanceAfter = decimal.RequireFromString("1640000"), decimal.RequireFromString("400")
			return nil
		})
		w := doJSON(currencyChangeRouter(svc), http.MethodPost, "/accounts/3/currency",
			map[string]any{"currency": "USD", "mode": "convert"})
		assert.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data accountCurrencyChangeResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.False(t, body.Data.Applied)
		assert.Nil(t, body.Data.ChangeID)
		assert.Equal(t, "400", body.Data.BalanceAfter)
	})

	t.Run("modo inválido", func(t *testing.T) {
		svc := mock.NewMockCurrencyChangeService(gomock.NewController(t))
		w := doJSON(currencyChangeRouter(svc), http.MethodPost, "/accounts/3/currency",
			map[string]any{"currency": "USD", "mode": "magic"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("faltan tasas", func(t *testing.T) {
		svc := mock.NewMockCurrencyChangeService(gomock.NewController(t))
		svc.EXPECT().ChangeAccountCurrency(gomock.Any(), gomock.Any()).Return(domain.ErrMissingFxRates)
		w := doJSON(currencyChangeRouter(svc), http.MethodPost, "/accounts/3/currency",
			map[string]any{"currency": "BRL", "mode": "convert", "apply": true})
		assert.Equal(t, http.StatusConflict, w.Code)
	})

	t.Run("deshacer, listar, cerrar y reabrir", func(t *testing.T) {
		svc := mock.NewMockCurrencyChangeService(gomock.NewController(t))
		closedAt := time.Date(2026, 10, 28, 20, 0, 0, 0, time.UTC)
		svc.EXPECT().UndoAccountCurrencyChange(gomock.Any(), "user123", uint64(3), uint64(7)).Return(domain.ErrCurrencyChangeNotUndoable)
		svc.EXPECT().ListAccountCurrencyChanges(gomock.Any(), "user123", uint64(3)).
			Return([]domain.AccountCurrencyChange{{ID: 7, Mode: "convert", OldCurrency: "COP", NewCurrency: "USD", CreatedAt: closedAt}}, nil)
		svc.EXPECT().SetAccountClosed(gomock.Any(), "user123", uint64(3), true).Return(&closedAt, nil)
		svc.EXPECT().SetAccountClosed(gomock.Any(), "user123", uint64(3), false).Return(nil, nil)
		r := currencyChangeRouter(svc)

		assert.Equal(t, http.StatusConflict, doJSON(r, http.MethodPost, "/accounts/3/currency-changes/7/undo", nil).Code)
		w := doJSON(r, http.MethodGet, "/accounts/3/currency-changes", nil)
		assert.Contains(t, w.Body.String(), `"created_at":"2026-10-28T20:00:00Z"`)
		w = doJSON(r, http.MethodPost, "/accounts/3/close", nil)
		assert.Contains(t, w.Body.String(), `"closed_at":"2026-10-28T20:00:00Z"`)
		w = doJSON(r, http.MethodPost, "/accounts/3/reopen", nil)
		assert.Contains(t, w.Body.String(), `"closed_at":null`)
		assert.Equal(t, http.StatusTeapot, doJSON(r, http.MethodPut, "/accounts/3", nil).Code)
	})

	t.Run("moneda base", func(t *testing.T) {
		svc := mock.NewMockCurrencyChangeService(gomock.NewController(t))
		svc.EXPECT().ChangeBaseCurrency(gomock.Any(), gomock.Any()).DoAndReturn(func(_ any, c *domain.BaseCurrencyChange) error {
			assert.Equal(t, "USD", c.NewCurrency)
			assert.True(t, c.Apply)
			c.OldCurrency = "COP"
			return nil
		})
		w := doJSON(currencyChangeRouter(svc), http.MethodPost, "/user-extra/base-currency",
			map[string]any{"currency": "USD", "apply": true})
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"applied":true`)
	})
}
