package http

import (
	"bytes"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// transferRouter registers the transaction routes in the same order as routes.go (gin panics on
// conflicting patterns) with an authenticated user.
func transferRouter(svc *mock.MockTransactionService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewTransactionHandler(svc)
	r := gin.New()
	g := r.Group("/transactions").Use(func(ctx *gin.Context) { setupAnalysisAuthContext(ctx, "user123") })
	g.POST("/create", h.CreateTransaction)
	g.POST("/transfer", h.CreateTransfer)
	g.GET("/transfer/candidates", h.ListTransferCandidates)
	g.POST("/transfer/dismiss", h.DismissTransferCandidate)
	g.DELETE("/transfer/:group", h.UnlinkTransfer)
	g.POST("/:id/transfer", h.LinkTransfer)
	g.GET("/:id", h.GetTransaction)
	g.GET("/list", h.ListTransactions)
	g.PUT("/:id", h.UpdateTransaction)
	g.DELETE("/:id", h.DeleteTransaction)
	return r
}

func doJSON(r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestTransactionHandler_LinkTransfer(t *testing.T) {
	t.Run("creates the counterpart in another account", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		svc := mock.NewMockTransactionService(ctrl)
		svc.EXPECT().LinkTransfer(gomock.Any(), gomock.Any()).DoAndReturn(
			func(_ any, link *domain.TransferLink) error {
				assert.Equal(t, "user123", link.UserID)
				assert.Equal(t, uint64(5), link.TransactionID)
				assert.Equal(t, uint64(2), link.CounterpartAccountID)
				require.NotNil(t, link.CounterpartAmount)
				assert.True(t, link.CounterpartAmount.Equal(decimal.RequireFromString("100.5")))
				link.GroupID = "g-1"
				link.Transaction.ID, link.Counterpart.ID = 5, 6
				return nil
			})

		w := doJSON(transferRouter(svc), http.MethodPost, "/transactions/5/transfer",
			map[string]any{"counterpart_account_id": 2, "counterpart_amount": "100.5"})

		assert.Equal(t, http.StatusCreated, w.Code)
		var body struct {
			Data linkTransferResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, "g-1", body.Data.TransferGroupID)
		assert.Equal(t, uint64(6), body.Data.Counterpart.ID)
	})

	t.Run("links with an existing transaction", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		svc := mock.NewMockTransactionService(ctrl)
		svc.EXPECT().LinkTransfer(gomock.Any(), gomock.Any()).DoAndReturn(
			func(_ any, link *domain.TransferLink) error {
				assert.Equal(t, uint64(9), link.CounterpartTransactionID)
				assert.Nil(t, link.CounterpartAmount)
				return nil
			})

		w := doJSON(transferRouter(svc), http.MethodPost, "/transactions/5/transfer",
			map[string]any{"counterpart_transaction_id": 9})
		assert.Equal(t, http.StatusCreated, w.Code)
	})

	t.Run("rejects an amount that is not a number", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		w := doJSON(transferRouter(svc), http.MethodPost, "/transactions/5/transfer",
			map[string]any{"counterpart_account_id": 2, "counterpart_amount": "abc"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("already linked is a conflict", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		svc.EXPECT().LinkTransfer(gomock.Any(), gomock.Any()).Return(domain.ErrTransferLinked)
		w := doJSON(transferRouter(svc), http.MethodPost, "/transactions/5/transfer",
			map[string]any{"counterpart_transaction_id": 9})
		assert.Equal(t, http.StatusConflict, w.Code)
	})
}

func TestTransactionHandler_UnlinkTransfer(t *testing.T) {
	t.Run("unlinks by group id", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		group := "5b1c0c4e-3f0e-4c55-9d3a-0f6f1f1e2a10"
		svc.EXPECT().UnlinkTransfer(gomock.Any(), "user123", group).Return(nil)
		w := doJSON(transferRouter(svc), http.MethodDelete, "/transactions/transfer/"+group, nil)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("group id must be a uuid", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		w := doJSON(transferRouter(svc), http.MethodDelete, "/transactions/transfer/123", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("deleting a transaction still works", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		svc.EXPECT().DeleteTransaction(gomock.Any(), "user123", uint64(7)).Return(nil)
		w := doJSON(transferRouter(svc), http.MethodDelete, "/transactions/7", nil)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestTransactionHandler_TransferCandidates(t *testing.T) {
	t.Run("lists candidates with decimal strings", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		date := time.Date(2026, 10, 27, 15, 4, 5, 0, time.UTC)
		svc.EXPECT().ListTransferCandidates(gomock.Any(), "user123", uint64(10)).Return([]domain.TransferCandidate{{
			OutTransactionID: 10, InTransactionID: 11, OutAccountID: 1, InAccountID: 2,
			OutAmount: decimal.RequireFromString("500000"), InAmount: decimal.RequireFromString("125.25"),
			OutCurrency: "COP", InCurrency: "USD", OutDate: date, InDate: date, Confidence: "low",
		}}, nil)

		w := doJSON(transferRouter(svc), http.MethodGet, "/transactions/transfer/candidates?limit=10", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data []transferCandidateResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		require.Len(t, body.Data, 1)
		assert.Equal(t, "125.25", body.Data[0].InAmount)
		assert.Equal(t, "2026-10-27T15:04:05Z", body.Data[0].OutDate)
		assert.Equal(t, "low", body.Data[0].Confidence)
	})

	t.Run("dismisses a pair", func(t *testing.T) {
		svc := mock.NewMockTransactionService(gomock.NewController(t))
		svc.EXPECT().DismissTransferCandidate(gomock.Any(), "user123", uint64(10), uint64(11)).Return(nil)
		w := doJSON(transferRouter(svc), http.MethodPost, "/transactions/transfer/dismiss",
			map[string]any{"out_transaction_id": 10, "in_transaction_id": 11})
		assert.Equal(t, http.StatusOK, w.Code)
	})
}
