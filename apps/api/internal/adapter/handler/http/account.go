package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AccountHandler struct {
	svc port.AccountService
}

func NewAccountHandler(svc port.AccountService) *AccountHandler {
	return &AccountHandler{
		svc,
	}
}

type createAccountRequest struct {
	Name           string  `json:"name" binding:"required" example:"Bancolombia Savings"`
	LastFourDigits string  `json:"last_four_digits" binding:"required,four_digits" example:"1234"`
	BankID         uint64  `json:"bank_id" binding:"required" example:"1"`
	TypeID         uint64  `json:"type_id" binding:"required,account_type" example:"12"`
	InitialBalance float64 `json:"initial_balance" example:"0.01"`
	EmailID        *uint64 `json:"email_id" binding:"omitempty" example:"1"`
	// Currency is the ISO 4217 code of the account (COP when empty). It cannot change later.
	Currency string `json:"currency" binding:"omitempty,len=3" example:"USD"`
}

// CreateAccount creates a new account
//
//	@Summary		Create account
//	@Description	Creates a new account for the authenticated user
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			request	body		createAccountRequest	true	"Account creation request"
//	@Success		201		{object}	response{data=accountResponse}	"Account created"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/create [post]
func (ah *AccountHandler) CreateAccount(ctx *gin.Context) {
	var req createAccountRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	err = ctx.ShouldBindJSON(&req)
	if err != nil {
		validationError(ctx, err)
		return
	}

	account := &domain.Account{
		UserID:         *userID,
		Name:           req.Name,
		LastFourDigits: req.LastFourDigits,
		InitialBalance: req.InitialBalance,
		Currency:       req.Currency,
		Bank:           domain.Bank{ID: req.BankID},
		Type:           domain.AccountType{ID: req.TypeID},
		Email:          domain.Email{ID: req.EmailID},
	}

	err = ah.svc.CreateAccount(ctx, account)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountResponse(account, true)

	handleCreatedSuccess(ctx, rsp)
}

type GetAccountRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

// GetAccount retrieves an account
//
//	@Summary		Get account
//	@Description	Retrieves a specific account by ID
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int		true	"Account ID"
//	@Success		200		{object}	response{data=accountResponse}	"Account details"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/{id} [get]
func (ah *AccountHandler) GetAccount(ctx *gin.Context) {
	var req GetAccountRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	account, err := ah.svc.GetAccount(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountResponse(account, false)

	handleSuccess(ctx, rsp)
}

type GetAccountsRequest struct {
	Skip   uint64 `form:"skip" binding:"omitempty,min=0" example:"0"`
	Limit  uint64 `form:"limit" binding:"omitempty,min=5" example:"5"`
	Filter string `form:"filter" binding:"omitempty" example:"savings"`
}

// GetAccounts retrieves a list of accounts
//
//	@Summary		Get accounts
//	@Description	Retrieves a list of accounts for the authenticated user
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			skip	query		int		false	"Skip"
//	@Param			limit	query		int		false	"Limit"
//	@Param			filter	query		string	false	"Filter"
//	@Success		200		{object}	response{data=[]accountResponse}	"List of accounts"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/list [get]
func (ah *AccountHandler) GetAccounts(ctx *gin.Context) {
	var req GetAccountsRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	accounts, err := ah.svc.GetAccounts(ctx, *userID, req.Skip, req.Limit, req.Filter)
	if err != nil {
		handleError(ctx, err)
		return
	}

	total := uint64(len(accounts))
	accountsList := make([]accountResponse, total)

	// TODO: Execute in a response file
	for idx, account := range accounts {
		accountsList[idx] = newAccountResponse(&account, false)
	}

	metadata := newMeta(total, req.Limit, req.Skip)
	rsp := toMap(metadata, accountsList, enums.Accounts)

	handleSuccess(ctx, rsp)
}

type updateAccountRequest struct {
	Name           string  `json:"name" binding:"required" example:"Bancolombia Savings"`
	LastFourDigits string  `json:"last_four_digits" binding:"required,four_digits" example:"1234"`
	BankID         uint64  `json:"bank_id" binding:"required" example:"1"`
	TypeID         uint64  `json:"type_id" binding:"required,account_type" example:"12"`
	InitialBalance float64 `json:"initial_balance" example:"0.01"`
	EmailID        *uint64 `json:"email_id" binding:"omitempty" example:"1"`
	// Currency can only change while the account has no transactions
	Currency string `json:"currency" binding:"omitempty,len=3" example:"USD"`
}

// UpdateAccount updates an account
//
//	@Summary		Update account
//	@Description	Updates an existing account
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int		true	"Account ID"
//	@Param			request	body		updateAccountRequest	true	"Account update request"
//	@Success		200		{object}	response{data=accountResponse}	"Account updated"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/{id} [put]
func (ah *AccountHandler) UpdateAccount(ctx *gin.Context) {
	var req updateAccountRequest

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

	account := &domain.Account{
		ID:             id,
		UserID:         *userID,
		Name:           req.Name,
		LastFourDigits: req.LastFourDigits,
		InitialBalance: req.InitialBalance,
		Currency:       req.Currency,
		Bank:           domain.Bank{ID: req.BankID},
		Type:           domain.AccountType{ID: req.TypeID},
		Email:          domain.Email{ID: req.EmailID},
	}

	err = ah.svc.UpdateAccount(ctx, account)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountResponse(account, true)

	handleSuccess(ctx, rsp)
}

type deleteAccountRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

// DeleteAccount deletes an account
//
//	@Summary		Delete account
//	@Description	Deletes an account by ID
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int		true	"Account ID"
//	@Success		200		{object}	response	"Account deleted"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/{id} [delete]
func (ah *AccountHandler) DeleteAccount(ctx *gin.Context) {
	var req deleteAccountRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err = ah.svc.DeleteAccount(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

type AdminGetAccountsRequest struct {
	Skip  uint64 `form:"skip" binding:"omitempty,min=0" example:"0"`
	Limit uint64 `form:"limit" binding:"omitempty,min=5" example:"5"`
}

// AdminGetAccounts retrieves all accounts (Admin)
//
//	@Summary		Admin get accounts
//	@Description	Retrieves all accounts (Admin only)
//	@Tags			Admin
//	@Accept			json
//	@Produce		json
//	@Param			skip	query		int		false	"Skip"
//	@Param			limit	query		int		false	"Limit"
//	@Success		200		{object}	response{data=map[string][]customAccountResponse}	"List of accounts"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/admin/list [get]
func (ah *AccountHandler) AdminGetAccounts(ctx *gin.Context) {
	var req AdminGetAccountsRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	filters := domain.AccountFilters{
		Skip:  req.Skip,
		Limit: req.Limit,
	}

	accounts, err := ah.svc.AdminGetAccounts(ctx, filters)
	if err != nil {
		handleError(ctx, err)
		return
	}

	var total uint64
	if len(accounts) > 0 {
		total = accounts[0].Total
	}

	accountsByUser := newAdminAccountsResponse(accounts)
	metadata := newMeta(total, req.Limit, req.Skip)
	rsp := toMap(metadata, accountsByUser, enums.UserAccounts)

	handleSuccess(ctx, rsp)
}

// AdminGetAccountsByBank retrieves all accounts grouped by bank (Admin)
//
//	@Summary		Admin get accounts by bank
//	@Description	Retrieves all accounts grouped by bank and email (Admin only)
//	@Tags			Admin
//	@Accept			json
//	@Produce		json
//	@Param			skip	query		int		false	"Skip"
//	@Param			limit	query		int		false	"Limit"
//	@Success		200		{object}	response{data=usersAccountsByBankResponse}	"List of accounts grouped by bank"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/admin/list/by-bank [get]
func (ah *AccountHandler) AdminGetAccountsByBank(ctx *gin.Context) {
	var req AdminGetAccountsRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	filters := domain.AccountFilters{
		Skip:  req.Skip,
		Limit: req.Limit,
	}

	groups, err := ah.svc.AdminGetAccountsByBank(ctx, filters)
	if err != nil {
		handleError(ctx, err)
		return
	}

	accountsByBank := newAdminAccountsByBankResponse(groups)

	handleSuccess(ctx, accountsByBank)
}

type calculateInitialBalanceRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

// CalculateInitialBalance recalculates the initial balance
//
//	@Summary		Calculate initial balance
//	@Description	Recalculates the initial balance for an account
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int		true	"Account ID"
//	@Success		200		{object}	response{data=accountResponse}	"Account updated"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/accounts/{id}/calculate/initial-balance [put]
func (ah *AccountHandler) CalculateInitialBalance(ctx *gin.Context) {
	var req calculateInitialBalanceRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	updatedAccount, err := ah.svc.CalculateInitialBalance(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountResponse(updatedAccount, false)

	handleSuccess(ctx, rsp)
}
