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

// valuationRouter registers the routes like routes.go, next to the account route they share a prefix with
func valuationRouter(svc *mock.MockValuationService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewValuationHandler(svc)
	h.now = func() time.Time { return time.Date(2026, 10, 28, 15, 0, 0, 0, time.UTC) }
	r := gin.New()
	auth := func(ctx *gin.Context) { setupAnalysisAuthContext(ctx, "user123") }
	accounts := r.Group("/accounts").Use(auth)
	accounts.GET("/:id", func(ctx *gin.Context) { ctx.Status(http.StatusTeapot) })
	accounts.GET("/:id/valuations", h.ListValuations)
	accounts.POST("/:id/valuations", h.SaveValuation)
	accounts.DELETE("/:id/valuations/:valuation_id", h.DeleteValuation)
	r.Group("/analysis").Use(auth).GET("/investments", h.GetInvestments)
	return r
}

func TestValuationHandler(t *testing.T) {
	t.Run("guarda una valoración", func(t *testing.T) {
		svc := mock.NewMockValuationService(gomock.NewController(t))
		svc.EXPECT().SaveValuation(gomock.Any(), gomock.Any()).DoAndReturn(func(_ any, v *domain.AccountValuation) error {
			assert.Equal(t, "user123", v.UserID)
			assert.Equal(t, uint64(3), v.AccountID)
			assert.Equal(t, "2026-10-20", v.Date.Format(time.DateOnly))
			assert.True(t, v.Value.Equal(decimal.RequireFromString("1600000.5")))
			v.ID, v.Source = 9, "manual"
			return nil
		})
		w := doJSON(valuationRouter(svc), http.MethodPost, "/accounts/3/valuations",
			map[string]any{"date": "2026-10-20", "value": "1600000.5", "note": "extracto"})
		assert.Equal(t, http.StatusCreated, w.Code)
		var body struct {
			Data valuationResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, uint64(9), body.Data.ID)
		assert.Equal(t, "1600000.5", body.Data.Value)
	})

	t.Run("valor que no es número", func(t *testing.T) {
		svc := mock.NewMockValuationService(gomock.NewController(t))
		w := doJSON(valuationRouter(svc), http.MethodPost, "/accounts/3/valuations",
			map[string]any{"date": "2026-10-20", "value": "mucho"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("cuenta que no es inversión", func(t *testing.T) {
		svc := mock.NewMockValuationService(gomock.NewController(t))
		svc.EXPECT().SaveValuation(gomock.Any(), gomock.Any()).Return(domain.ErrNotInvestmentAccount)
		w := doJSON(valuationRouter(svc), http.MethodPost, "/accounts/1/valuations",
			map[string]any{"date": "2026-10-20", "value": "1"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("lista y borra; GET /accounts/:id sigue siendo la cuenta", func(t *testing.T) {
		svc := mock.NewMockValuationService(gomock.NewController(t))
		svc.EXPECT().ListValuations(gomock.Any(), "user123", uint64(3)).Return([]domain.AccountValuation{
			{ID: 9, AccountID: 3, Date: time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC), Value: decimal.NewFromInt(5)}}, nil)
		svc.EXPECT().DeleteValuation(gomock.Any(), "user123", uint64(3), uint64(9)).Return(nil)
		r := valuationRouter(svc)
		w := doJSON(r, http.MethodGet, "/accounts/3/valuations", nil)
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"date":"2026-10-20"`)
		assert.Equal(t, http.StatusOK, doJSON(r, http.MethodDelete, "/accounts/3/valuations/9", nil).Code)
		assert.Equal(t, http.StatusTeapot, doJSON(r, http.MethodGet, "/accounts/3", nil).Code)
	})

	t.Run("rendimiento: por defecto el mes en curso", func(t *testing.T) {
		svc := mock.NewMockValuationService(gomock.NewController(t))
		start := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)
		svc.EXPECT().GetInvestmentPerformance(gomock.Any(), "user123", start, end).Return([]domain.InvestmentPerformance{{
			AccountID: 3, Currency: "COP", ValueStart: decimal.RequireFromString("1050000"),
			Contributions: decimal.RequireFromString("500000"), Gain: decimal.RequireFromString("50000"),
		}}, nil)
		w := doJSON(valuationRouter(svc), http.MethodGet, "/analysis/investments", nil)
		assert.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data investmentsResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, "2026-10-01", body.Data.Start)
		require.Len(t, body.Data.Accounts, 1)
		require.NotNil(t, body.Data.Accounts[0].GainPercent)
		assert.Equal(t, "3.23", *body.Data.Accounts[0].GainPercent)
	})

	t.Run("rendimiento: fecha inválida", func(t *testing.T) {
		svc := mock.NewMockValuationService(gomock.NewController(t))
		w := doJSON(valuationRouter(svc), http.MethodGet, "/analysis/investments?start=ayer", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
