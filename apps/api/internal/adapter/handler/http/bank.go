package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"strconv"

	"github.com/gin-gonic/gin"
)

type BankHandler struct {
	svc port.BankService
}

func NewBankHandler(svc port.BankService) *BankHandler {
	return &BankHandler{
		svc,
	}
}

type createBankRequest struct {
	Name  string `json:"name" binding:"required" example:"bancolombia"`
	Email string `json:"email" binding:"omitempty,emails" example:"notification@example.com"`
}

func (ah *BankHandler) CreateBank(ctx *gin.Context) {
	var req createBankRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	bank := &domain.Bank{
		UserID: *userID,
		Name:   req.Name,
		Email:  &req.Email,
	}

	err = ah.svc.CreateBank(ctx, bank)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newBankResponse(bank)

	handleCreatedSuccess(ctx, rsp)
}

type GetBankRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

func (ah *BankHandler) GetBank(ctx *gin.Context) {
	var req GetBankRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	bank, err := ah.svc.GetBank(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newBankResponse(bank)

	handleSuccess(ctx, rsp)
}

type GetBanksRequest struct {
	Skip  uint64 `form:"skip" binding:"omitempty,min=0" example:"0"`
	Limit uint64 `form:"limit" binding:"omitempty,min=5" example:"5"`
}

func (ah *BankHandler) GetBanks(ctx *gin.Context) {
	var req GetBanksRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	banks, err := ah.svc.GetBanks(ctx, *userID, req.Skip, req.Limit)
	if err != nil {
		handleError(ctx, err)
		return
	}

	total := uint64(len(banks))
	bankList := make([]bankResponse, total)

	for idx, bank := range banks {
		bankList[idx] = newBankResponse(&bank)
	}

	metadata := newMeta(total, req.Limit, req.Skip)
	rsp := toMap(metadata, bankList, enums.Banks)

	handleSuccess(ctx, rsp)
}

type updateBankRequest struct {
	Name  string `json:"name" binding:"required" example:"Bank Name"`
	Email string `json:"email" binding:"omitempty,emails" example:"notification@example.com"`
}

func (ah *BankHandler) UpdateBank(ctx *gin.Context) {
	var req updateBankRequest

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
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		validationError(ctx, err)
		return
	}

	bank := &domain.Bank{
		ID:     id,
		UserID: *userID,
		Name:   req.Name,
		Email:  &req.Email,
	}

	err = ah.svc.UpdateBank(ctx, bank)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newBankResponse(bank)

	handleSuccess(ctx, rsp)
}

type deleteBankRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

func (ah *BankHandler) DeleteBank(ctx *gin.Context) {
	var req deleteBankRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err = ah.svc.DeleteBank(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

// GetOfficialBanks retrieves the list of official banks
//
//	@Summary		Get official banks
//	@Description	Retrieves the list of official banks
//	@Tags			Banks
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/banks/official [get]
func (ah *BankHandler) GetOfficialBanks(ctx *gin.Context) {
	officialBanks := ah.svc.GetOfficialBanks(ctx)

	handleSuccess(ctx, officialBanks)
}
