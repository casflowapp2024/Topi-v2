package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"time"

	"github.com/gin-gonic/gin"
)

// categoryBudgetResponse is a version of a category budget (plan/26-presupuestos-historicos.md)
type categoryBudgetResponse struct {
	Budget float64 `json:"budget" example:"1000000"`
	From   string  `json:"from" example:"2026-11"`
	// Base is the oldest version: it can be edited but not deleted. From = "2000-01" means "since always".
	Base bool `json:"base" example:"false"`
}

func newCategoryBudgetsResponse(versions []domain.CategoryBudget) []categoryBudgetResponse {
	rsp := make([]categoryBudgetResponse, len(versions))
	for i, v := range versions {
		rsp[i] = categoryBudgetResponse{
			Budget: v.Budget,
			From:   v.EffectiveFrom.Format(domain.BudgetMonthLayout),
			Base:   i == len(versions)-1,
		}
	}
	return rsp
}

type setCategoryBudgetRequest struct {
	// Budget is required; 0 is a valid value ("no budget from this month")
	Budget *float64 `json:"budget" binding:"required,min=0" example:"900000"`
	// From is the first month of the version (YYYY-MM); empty = the user's current month
	From string `json:"from" binding:"omitempty" example:"2026-06"`
}

func categoryIDParam(ctx *gin.Context) (uint64, bool) {
	id, err := utils.StringToUint64(ctx.Param("id"))
	if err != nil {
		validationError(ctx, err)
		return 0, false
	}
	return id, true
}

// GetCategoryBudgets lists the budget versions of a category, from the newest to the oldest
func (ch *CategoryHandler) GetCategoryBudgets(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	id, ok := categoryIDParam(ctx)
	if !ok {
		return
	}

	versions, err := ch.svc.ListBudgets(ctx, *userID, id)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, newCategoryBudgetsResponse(versions))
}

// SetCategoryBudget sets the budget from a month until the next version and returns the versions
func (ch *CategoryHandler) SetCategoryBudget(ctx *gin.Context) {
	var req setCategoryBudgetRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	id, ok := categoryIDParam(ctx)
	if !ok {
		return
	}
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	var from *time.Time
	if req.From != "" {
		month, err := domain.ParseBudgetMonth(req.From)
		if err != nil {
			validationError(ctx, err)
			return
		}
		from = &month
	}

	versions, err := ch.svc.SetBudget(ctx, *userID, id, *req.Budget, from)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, newCategoryBudgetsResponse(versions))
}

// DeleteCategoryBudget deletes the version that starts in :from (YYYY-MM) and returns the versions
func (ch *CategoryHandler) DeleteCategoryBudget(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	id, ok := categoryIDParam(ctx)
	if !ok {
		return
	}
	month, err := domain.ParseBudgetMonth(ctx.Param("from"))
	if err != nil {
		validationError(ctx, err)
		return
	}

	versions, err := ch.svc.DeleteBudget(ctx, *userID, id, month)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, newCategoryBudgetsResponse(versions))
}
