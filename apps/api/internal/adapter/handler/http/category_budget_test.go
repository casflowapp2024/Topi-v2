package http

import (
	"bytes"
	"cash-flow/internal/core/domain"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestCategoryHandler_Budgets(t *testing.T) {
	june := time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC)
	versions := []domain.CategoryBudget{
		{Budget: 900, EffectiveFrom: june},
		{Budget: 800, EffectiveFrom: domain.BudgetBaseMonth},
	}

	serve := func(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(method, path, bytes.NewBufferString(body))
		router.ServeHTTP(w, req)
		return w
	}
	withAuth := func(h gin.HandlerFunc) gin.HandlerFunc {
		return func(c *gin.Context) { setupAuthContext(c, "u1"); h(c) }
	}

	t.Run("set from a past month", func(t *testing.T) {
		handler, svc, router := setupCategoryTest(t)
		router.PUT("/categories/:id/budgets", withAuth(handler.SetCategoryBudget))
		svc.EXPECT().SetBudget(gomock.Any(), "u1", uint64(7), 900.0, &june).Return(versions, nil)

		w := serve(router, http.MethodPut, "/categories/7/budgets", `{"budget":900,"from":"2026-06"}`)
		assert.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data []categoryBudgetResponse `json:"data"`
		}
		assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, []categoryBudgetResponse{
			{Budget: 900, From: "2026-06", Base: false},
			{Budget: 800, From: "2000-01", Base: true},
		}, body.Data)
	})

	t.Run("zero budget without month uses the current month", func(t *testing.T) {
		handler, svc, router := setupCategoryTest(t)
		router.PUT("/categories/:id/budgets", withAuth(handler.SetCategoryBudget))
		svc.EXPECT().SetBudget(gomock.Any(), "u1", uint64(7), 0.0, (*time.Time)(nil)).Return(versions, nil)

		w := serve(router, http.MethodPut, "/categories/7/budgets", `{"budget":0}`)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	for _, body := range []string{`{}`, `{"budget":-1}`, `{"budget":1,"from":"junio"}`} {
		t.Run("rejects "+body, func(t *testing.T) {
			handler, _, router := setupCategoryTest(t)
			router.PUT("/categories/:id/budgets", withAuth(handler.SetCategoryBudget))

			w := serve(router, http.MethodPut, "/categories/7/budgets", body)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}

	t.Run("future month maps to 400", func(t *testing.T) {
		handler, svc, router := setupCategoryTest(t)
		router.PUT("/categories/:id/budgets", withAuth(handler.SetCategoryBudget))
		svc.EXPECT().SetBudget(gomock.Any(), "u1", uint64(7), 1.0, gomock.Any()).Return(nil, domain.ErrBudgetMonthOutOfRange)

		w := serve(router, http.MethodPut, "/categories/7/budgets", `{"budget":1,"from":"2030-01"}`)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("deleting the base version is a conflict", func(t *testing.T) {
		handler, svc, router := setupCategoryTest(t)
		router.DELETE("/categories/:id/budgets/:from", withAuth(handler.DeleteCategoryBudget))
		svc.EXPECT().DeleteBudget(gomock.Any(), "u1", uint64(7), domain.BudgetBaseMonth).Return(nil, domain.ErrBudgetBaseVersion)

		w := serve(router, http.MethodDelete, "/categories/7/budgets/2000-01", "")
		assert.Equal(t, http.StatusConflict, w.Code)
	})

	t.Run("list", func(t *testing.T) {
		handler, svc, router := setupCategoryTest(t)
		router.GET("/categories/:id/budgets", withAuth(handler.GetCategoryBudgets))
		svc.EXPECT().ListBudgets(gomock.Any(), "u1", uint64(7)).Return(versions, nil)

		w := serve(router, http.MethodGet, "/categories/7/budgets", "")
		assert.Equal(t, http.StatusOK, w.Code)
	})
}
