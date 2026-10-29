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

func creditCardRouter(svc *mock.MockCreditCardService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewCreditCardHandler(svc)
	r := gin.New()
	auth := func(ctx *gin.Context) { setupAnalysisAuthContext(ctx, "user123") }
	accounts := r.Group("/accounts").Use(auth)
	accounts.GET("/:id/credit-card", h.GetCreditCard)
	accounts.PUT("/:id/credit-card", h.SaveCreditCard)
	r.Group("/analysis").Use(auth).GET("/credit-cards", h.ListCreditCards)
	return r
}

func TestCreditCardHandler(t *testing.T) {
	t.Run("guarda los términos", func(t *testing.T) {
		svc := mock.NewMockCreditCardService(gomock.NewController(t))
		svc.EXPECT().SaveCreditCard(gomock.Any(), gomock.Any()).DoAndReturn(func(_ any, d *domain.CreditCardDetails) error {
			assert.Equal(t, uint64(4), d.AccountID)
			require.NotNil(t, d.CreditLimit)
			assert.True(t, d.CreditLimit.Equal(decimal.RequireFromString("8000000")))
			assert.Equal(t, int16(15), *d.StatementDay)
			assert.Nil(t, d.InterestRateEA)
			return nil
		})
		w := doJSON(creditCardRouter(svc), http.MethodPut, "/accounts/4/credit-card",
			map[string]any{"credit_limit": "8000000", "statement_day": 15, "due_day": 30, "interest_rate_ea": ""})
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("día fuera de rango y cupo inválido", func(t *testing.T) {
		svc := mock.NewMockCreditCardService(gomock.NewController(t))
		r := creditCardRouter(svc)
		assert.Equal(t, http.StatusBadRequest, doJSON(r, http.MethodPut, "/accounts/4/credit-card", map[string]any{"statement_day": 32}).Code)
		assert.Equal(t, http.StatusBadRequest, doJSON(r, http.MethodPut, "/accounts/4/credit-card", map[string]any{"credit_limit": "mucho"}).Code)
	})

	t.Run("no es tarjeta", func(t *testing.T) {
		svc := mock.NewMockCreditCardService(gomock.NewController(t))
		svc.EXPECT().GetCreditCard(gomock.Any(), "user123", uint64(1)).Return(nil, domain.ErrNotCreditAccount)
		assert.Equal(t, http.StatusBadRequest, doJSON(creditCardRouter(svc), http.MethodGet, "/accounts/1/credit-card", nil).Code)
	})

	t.Run("estado de las tarjetas", func(t *testing.T) {
		svc := mock.NewMockCreditCardService(gomock.NewController(t))
		due := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
		pending := decimal.RequireFromString("250000")
		svc.EXPECT().ListCreditCardStatus(gomock.Any(), "user123").Return([]domain.CreditCardStatus{{
			CreditCardDetails: domain.CreditCardDetails{AccountID: 4}, Name: "Visa", Currency: "COP",
			Debt: decimal.RequireFromString("300000"), DueDate: &due, PendingStatement: &pending,
		}}, nil)
		w := doJSON(creditCardRouter(svc), http.MethodGet, "/analysis/credit-cards", nil)
		assert.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data []creditCardStatusResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		require.Len(t, body.Data, 1)
		assert.Equal(t, "2026-10-30", *body.Data[0].DueDate)
		assert.Equal(t, "250000", *body.Data[0].PendingStatement)
		assert.Equal(t, "300000", body.Data[0].Debt)
	})
}
