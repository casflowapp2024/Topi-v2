package http

import (
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
)

type AccountTypeHandler struct {
	svc port.AccountTypeService
}

func NewAccountTypeHandler(svc port.AccountTypeService) *AccountTypeHandler {
	return &AccountTypeHandler{
		svc,
	}
}

type createAccountTypeRequest struct {
	Name string `json:"name" binding:"required" example:"savings"`
	// Class: deposit (default) | investment | credit
	Class string `json:"class" binding:"omitempty,oneof=deposit investment credit" example:"deposit"`
}

type GetAccountTypeRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

// GetAccountType retrieves an account type
//
//	@Summary		Get account type
//	@Description	Retrieves a specific account type by ID
//	@Tags			Account Types
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int		true	"Account Type ID"
//	@Success		200		{object}	response{data=accountTypeResponse}	"Account type details"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/account-types/{id} [get]
func (at *AccountTypeHandler) GetAccountType(ctx *gin.Context) {
	var req GetAccountTypeRequest

	if err := ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	accountType, err := at.svc.GetAccountType(ctx, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountTypeResponse(accountType)

	handleSuccess(ctx, rsp)
}

type GetAccountTypesRequest struct {
	Skip  uint64 `form:"skip" binding:"omitempty,min=0" example:"0"`
	Limit uint64 `form:"limit" binding:"omitempty,min=5" example:"5"`
}

// GetAccountTypes retrieves a list of account types
//
//	@Summary		Get account types
//	@Description	Retrieves a list of account types
//	@Tags			Account Types
//	@Accept			json
//	@Produce		json
//	@Param			skip	query		int		false	"Skip"
//	@Param			limit	query		int		false	"Limit"
//	@Success		200		{object}	response{data=[]accountTypeResponse}	"List of account types"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/account-types/list [get]
func (at *AccountTypeHandler) GetAccountTypes(ctx *gin.Context) {
	var req GetAccountTypesRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	accountTypes, err := at.svc.GetAccountTypes(ctx, req.Skip, req.Limit)
	if err != nil {
		handleError(ctx, err)
		return
	}

	total := uint64(len(accountTypes))
	accountsList := make([]accountTypeResponse, total)

	for idx, accountType := range accountTypes {
		accountsList[idx] = newAccountTypeResponse(&accountType)
	}

	metadata := newMeta(total, req.Limit, req.Skip)
	rsp := toMap(metadata, accountsList, enums.AccountTypes)

	handleSuccess(ctx, rsp)
}

type updateAccountTypeRequest struct {
	Name string `json:"name" binding:"required" example:"savings"`
}

type deleteAccountTypeRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}
