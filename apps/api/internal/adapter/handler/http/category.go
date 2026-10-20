package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"

	"github.com/gin-gonic/gin"
)

type CategoryHandler struct {
	svc port.CategoryService
}

func NewCategoryHandler(svc port.CategoryService) *CategoryHandler {
	return &CategoryHandler{
		svc,
	}
}

type createCategoryRequest struct {
	Name   string  `json:"name" binding:"required" example:"Food"`
	Budget float64 `json:"budget" binding:"omitempty" example:"1000000"`
	Emoji  string  `json:"emoji" binding:"omitempty" example:"🍔"`
	Income bool    `json:"income" binding:"omitempty" example:"false"`
}

func (ch *CategoryHandler) CreateCategory(ctx *gin.Context) {
	var req createCategoryRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	category := &domain.Category{
		UserID: *userID,
		Name:   req.Name,
		Budget: req.Budget,
		Emoji:  req.Emoji,
		Income: req.Income,
	}

	err = ch.svc.CreateCategory(ctx, category)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newCategoryResponse(category)

	handleCreatedSuccess(ctx, rsp)
}

type GetCategoryRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

func (ch *CategoryHandler) GetCategory(ctx *gin.Context) {
	var req GetCategoryRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	category, err := ch.svc.GetCategory(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newCategoryResponse(category)

	handleSuccess(ctx, rsp)
}

type GetCategoryListRequest struct {
	Skip  uint64 `form:"skip" binding:"omitempty,min=0" example:"0"`
	Limit uint64 `form:"limit" binding:"omitempty,min=5" example:"5"`
}

func (ch *CategoryHandler) GetCategories(ctx *gin.Context) {
	var req GetCategoryListRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	categories, err := ch.svc.GetCategories(ctx, *userID, req.Skip, req.Limit)
	if err != nil {
		handleError(ctx, err)
		return
	}

	total := uint64(len(categories))
	categoryList := make([]categoryResponse, total)

	for idx, category := range categories {
		categoryList[idx] = newCategoryResponse(&category)
	}

	metadata := newMeta(total, req.Limit, req.Skip)
	rsp := toMap(metadata, categoryList, enums.Categories)

	handleSuccess(ctx, rsp)
}

type updateCategoryRequest struct {
	Name   string  `json:"name" binding:"required" example:"Food"`
	Budget float64 `json:"budget" binding:"omitempty" example:"1000000"`
	Emoji  string  `json:"emoji" binding:"omitempty" example:"🍔"`
	Income bool    `json:"income" binding:"omitempty" example:"false"`
}

func (ch *CategoryHandler) UpdateCategory(ctx *gin.Context) {
	var req updateCategoryRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	idStr := ctx.Param("id")
	id, err := utils.StringToUint64(idStr)
	if err != nil {
		validationError(ctx, err)
		return
	}

	category := &domain.Category{
		ID:     id,
		UserID: *userID,
		Name:   req.Name,
		Budget: req.Budget,
		Emoji:  req.Emoji,
		Income: req.Income,
	}

	err = ch.svc.UpdateCategory(ctx, category)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newCategoryResponse(category)

	handleSuccess(ctx, rsp)
}

type deleteCategoryRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

func (ch *CategoryHandler) DeleteCategory(ctx *gin.Context) {
	var req deleteCategoryRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	category := domain.Category{
		UserID: *userID,
		ID:     req.ID,
	}

	err = ch.svc.DeleteCategory(ctx, category)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}
