package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// TransactionHandler represents the HTTP handler for transaction-related requests
type TransactionHandler struct {
	svc port.TransactionService
}

// NewTransactionHandler creates a new TransactionHandler instance
func NewTransactionHandler(svc port.TransactionService) *TransactionHandler {
	return &TransactionHandler{
		svc,
	}
}

// createTransactionRequest represents a request body for creating a new transaction
type createTransactionRequest struct {
	CategoryID   uint64  `json:"category_id" binding:"required" example:"1"`
	AccountID    uint64  `json:"account_id" binding:"required" example:"2"`
	Description  string  `json:"description" binding:"required" example:"Mcdonald's hamburger"`
	Expense      bool    `json:"expense" example:"false"`
	Amount       float64 `json:"amount" binding:"required" example:"100000"`
	Date         string  `json:"date" binding:"required" example:"2025-05-03 14:00:00 -0500"`
	ShouldVerify bool    `json:"should_verify" binding:"omitempty" example:"false"`
}

// CreateTransaction godoc
//
//	@Summary		Create a new transaction
//	@Description	create a new transaction with category, account, description, expense, amount, and date
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			createTransactionRequest  body      createTransactionRequest	true	"Create transaction request"
//	@Success		200						{object}	transactionResponse		"Transaction created"
//	@Failure		400						{object}	errorResponse			"Validation error"
//	@Failure		401						{object}	errorResponse			"Unauthorized error"
//	@Failure		403						{object}	errorResponse			"Forbidden error"
//	@Failure		404						{object}	errorResponse			"Data not found error"
//	@Failure		409						{object}	errorResponse			"Data conflict error"
//	@Failure		500						{object}	errorResponse			"Internal server error"
//	@Router			/transactions [post]
//	@Security		BearerAuth
func (ph *TransactionHandler) CreateTransaction(ctx *gin.Context) {
	var req createTransactionRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	parsedDate, err := time.Parse(enums.DateTimeUtc, req.Date)
	if err != nil {
		validationError(ctx, err)
		return
	}

	transaction := &domain.Transaction{
		UserID:      *userID,
		Description: req.Description,
		Expense:     req.Expense,
		Amount:      req.Amount,
		Date:        parsedDate,
		Category:    domain.Category{ID: req.CategoryID},
		Account:     domain.Account{ID: req.AccountID},
	}

	err = ph.svc.CreateTransaction(ctx, transaction)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newTransactionResponse(transaction)

	handleCreatedSuccess(ctx, rsp)
}

// getTransactionRequest represents a request body for retrieving a transaction
type getTransactionRequest struct {
	Id uint64 `uri:"id" binding:"required,min=1" example:"1"`
}

// GetTransaction godoc
//
//	@Summary		Get a transaction
//	@Description	Get a transaction by id and user id
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int				true	"Transaction ID"
//	@Param			user_id	query		uint64			true	"User ID"
//	@Success		200		{object}	transactionResponse	"Transaction retrieved"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		404		{object}	errorResponse	"Data not found error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/transaction/{id} [get]
//	@Security		BearerAuth
func (ph *TransactionHandler) GetTransaction(ctx *gin.Context) {
	var req getTransactionRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	transaction, err := ph.svc.GetTransaction(ctx, *userID, req.Id)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newTransactionResponse(transaction)

	handleSuccess(ctx, rsp)
}

// ListTransactionsRequest represents a request body for listing transaction
type ListTransactionsRequest struct {
	Skip         uint64 `form:"skip" binding:"min=0" example:"0"`
	Limit        uint64 `form:"limit" binding:"required,min=5" example:"5"`
	Categories   string `form:"categories" binding:"omitempty" example:"1"`
	Accounts     string `form:"accounts" binding:"omitempty" example:"1"`
	InitDate     string `form:"init_date" binding:"omitempty" example:"1"`
	EndDate      string `form:"end_date" binding:"omitempty" example:"1"`
	Keyword      string `form:"keyword" binding:"omitempty" example:"1"`
	Expense      *bool  `form:"expense" binding:"omitempty" example:"false"`
	Automated    *bool  `form:"automated" binding:"omitempty" example:"false"`
	ShouldVerify *bool  `form:"should_verify" binding:"omitempty" example:"false"`
	Checked      *bool  `form:"checked" binding:"omitempty" example:"false"`
	SortBy       string `form:"sort_by" binding:"omitempty,sort_by" example:"date"`
	SortOrder    string `form:"sort_order" binding:"omitempty,sort_order" example:"desc"`
}

// ListTransactions godoc
//
//	@Summary		List transaction
//	@Description	List transaction with pagination
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			user_id	query		uint64			true	"UserID"
//	@Param			Skip	query		uint64			true	"Skip"
//	@Param			Limit	query		uint64			true	"Limit"
//	@Success		200		{object}	meta			"Transactions displayed"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/transaction [get]
//	@Security		BearerAuth
func (ph *TransactionHandler) ListTransactions(ctx *gin.Context) {
	var (
		req              ListTransactionsRequest
		transactionsList []transactionResponse
	)

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	filters, err := req.mapTransactionFilters(ctx, *userID)
	if err != nil {
		validationError(ctx, err)
		return
	}

	transactions, err := ph.svc.ListTransactions(ctx, filters)
	if err != nil {
		handleError(ctx, err)
		return
	}

	// TODO: Execute in response file
	var total uint64
	var news uint64
	var readEmail bool
	for i := 0; i < len(transactions); i++ {
		transaction := transactions[i]
		transactionsList = append(transactionsList, newTransactionResponse(&transaction))
		if i == 0 {
			total = transaction.Total
			news = transaction.News
			readEmail = transaction.ReadEmail
		}
	}

	metadata := transactionMetadata(total, news, req.Limit, req.Skip, readEmail)
	rsp := toMap(metadata, transactionsList, enums.Transactions)

	handleSuccess(ctx, rsp)
}

// updateTransactionRequest represents a request body for updating a transaction
type updateTransactionRequest struct {
	CategoryID   uint64  `json:"category_id" binding:"required" example:"1"`
	AccountID    uint64  `json:"account_id" binding:"required" example:"2"`
	Description  string  `json:"description" binding:"required" example:"Transaction for the order"`
	Expense      bool    `json:"expense" example:"false"`
	Amount       float64 `json:"amount" binding:"required" example:"100000"`
	Date         string  `json:"date" binding:"required" example:"2021-12-20"`
	ShouldVerify bool    `json:"should_verify" binding:"omitempty" example:"false"`
	Checked      bool    `json:"checked" binding:"omitempty" example:"false"`
	// FxRate (optional) sets the exchange rate by hand: fx_rate_source = 'user' and amount_base is
	// recalculated. Decimal as string.
	FxRate *string `json:"fx_rate" binding:"omitempty" example:"3900.5"`
}

// UpdateTransaction godoc
//
//	@Summary		Update a transaction
//	@Description	Update a transaction's category, account, description, expense, amount, and date
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			id						path		int						true	"Transaction ID"
//	@Param			updateTransactionRequest	body		updateTransactionRequest	true	"Update transaction request"
//	@Success		200						{object}	transactionResponse			"Transaction updated"
//	@Failure		400						{object}	errorResponse			"Validation error"
//	@Failure		401						{object}	errorResponse			"Unauthorized error"
//	@Failure		403						{object}	errorResponse			"Forbidden error"
//	@Failure		404						{object}	errorResponse			"Data not found error"
//	@Failure		409						{object}	errorResponse			"Data conflict error"
//	@Failure		500						{object}	errorResponse			"Internal server error"
//	@Router			/transaction/{id} [put]
//	@Security		BearerAuth
func (ph *TransactionHandler) UpdateTransaction(ctx *gin.Context) {
	var req updateTransactionRequest

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

	parsedDate, err := time.Parse(enums.DateTimeUtc, req.Date)
	if err != nil {
		validationError(ctx, err)
		return
	}

	transaction := &domain.Transaction{
		ID:           id,
		UserID:       *userID,
		Description:  req.Description,
		Expense:      req.Expense,
		Amount:       req.Amount,
		Date:         parsedDate,
		ShouldVerify: req.ShouldVerify,
		Checked:      req.Checked,
		Category:     domain.Category{ID: req.CategoryID},
		Account:      domain.Account{ID: req.AccountID},
	}

	if req.FxRate != nil {
		rate, rErr := decimal.NewFromString(*req.FxRate)
		if rErr != nil {
			handleError(ctx, domain.ErrInvalidFxRate)
			return
		}
		transaction.FxRate = &rate
	}

	err = ph.svc.UpdateTransaction(ctx, transaction)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newTransactionResponse(transaction)

	handleSuccess(ctx, rsp)
}

// deleteTransactionRequest represents a request body for deleting a transaction
type deleteTransactionRequest struct {
	ID uint64 `uri:"id" binding:"required,min=1" example:"1"`
}

// DeleteTransaction godoc
//
//	@Summary		Delete a transaction
//	@Description	Delete a transaction by id and user id
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			id		path		uint64			true	"Transaction ID"
//	@Param			user_id	query		uint64			true	"User ID"
//	@Success		200		{object}	response		"Transaction deleted"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		403		{object}	errorResponse	"Forbidden error"
//	@Failure		404		{object}	errorResponse	"Data not found error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/transaction/{id} [delete]
//	@Security		BearerAuth
func (ph *TransactionHandler) DeleteTransaction(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	var req deleteTransactionRequest

	if err = ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err = ph.svc.DeleteTransaction(ctx, *userID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

type adminCreateTransactionRequest struct {
	UserID       string                    `json:"user_id" binding:"omitempty" example:"1"`
	Transactions []adminTransactionRequest `json:"transactions" binding:"required,dive"`
}

type adminTransactionRequest struct {
	AccountID    uint64  `json:"account_id" binding:"required" example:"2"`
	Description  string  `json:"description" binding:"required" example:"Mcdonald's hamburger"`
	Expense      bool    `json:"expense" example:"false"`
	Amount       float64 `json:"amount" binding:"required" example:"100000"`
	Date         string  `json:"date" binding:"required" example:"2025-05-03 14:00:00 -0500"`
	ShouldVerify bool    `json:"should_verify" binding:"omitempty" example:"false"`
	// SourceMessageID is the provider message id of the email (worker). Makes the insert idempotent.
	SourceMessageID *string `json:"source_message_id" binding:"omitempty,max=512" example:"18c2f0a1b2c3d4e5"`
}

// AdminCreateTransactions godoc
//
//	@Summary		Admin create transactions
//	@Description	Create one or multiple transactions on behalf of a user. Transactions with source_message_id are idempotent: an already stored message, or a legacy automated transaction with the same account, amount, expense and date ±2 min, is returned in "skipped" instead of being inserted.
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			request	body	adminCreateTransactionRequest	true	"Admin create transactions request"
//	@Success		201		{object}	response{data=AdminTransactions}	"Transactions created and skipped"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		403		{object}	errorResponse	"Forbidden error"
//	@Failure		404		{object}	errorResponse	"Data not found error"
//	@Failure		409		{object}	errorResponse	"Data conflict error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/transactions/admin [post]
//	@Security		BearerAuth
func (ph *TransactionHandler) AdminCreateTransactions(ctx *gin.Context) {
	var req adminCreateTransactionRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	var transactions = make(domain.Transactions, len(req.Transactions))

	for i, t := range req.Transactions {
		parsedDate, err := time.Parse(enums.DateTimeUtc, t.Date)
		if err != nil {
			validationError(ctx, err)
			return
		}

		transactions[i] = domain.Transaction{
			UserID:       req.UserID,
			Description:  utils.Capitalize(t.Description),
			Expense:      t.Expense,
			Amount:       t.Amount,
			Date:         parsedDate,
			ShouldVerify: t.ShouldVerify,
			Checked:      false,
			Account:      domain.Account{ID: t.AccountID},
			Automated:    true,

			SourceMessageID: t.SourceMessageID,
		}
	}

	result, err := ph.svc.AdminCreateTransactions(ctx, req.UserID, transactions)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAdminTransactionResponse(result)

	handleCreatedSuccess(ctx, rsp)
}

func (r *ListTransactionsRequest) mapTransactionFilters(
	ctx *gin.Context,
	userID string,
) (domain.TransactionFilters, error) {
	filters := domain.TransactionFilters{
		UserID:       userID,
		Skip:         r.Skip,
		Limit:        r.Limit,
		Keyword:      r.Keyword,
		Expense:      r.Expense,
		Automated:    r.Automated,
		ShouldVerify: r.ShouldVerify,
		Checked:      r.Checked,
		SortBy:       r.SortBy,
		SortOrder:    r.SortOrder,
	}

	if r.InitDate != "" {
		initDate, err := time.Parse(enums.DateTimeUtc, r.InitDate)
		if err != nil {
			return domain.TransactionFilters{}, err
		}
		filters.InitDate = initDate
	}

	if r.EndDate != "" {
		endDate, err := time.Parse(enums.DateTimeUtc, r.EndDate)
		if err != nil {
			return domain.TransactionFilters{}, err
		}
		filters.EndDate = endDate
	}

	if categories := ctx.DefaultQuery("categories", ""); categories != "" {
		categoryList := strings.Split(categories, ",")
		for _, category := range categoryList {
			categoryID, err := strconv.ParseUint(category, 10, 64)
			if err != nil {
				return domain.TransactionFilters{}, err
			}
			filters.Category = append(filters.Category, categoryID)
		}
	}

	if accounts := ctx.DefaultQuery("accounts", ""); accounts != "" {
		accountList := strings.Split(accounts, ",")
		for _, account := range accountList {
			accountID, err := strconv.ParseUint(account, 10, 64)
			if err != nil {
				return domain.TransactionFilters{}, err
			}
			filters.Account = append(filters.Account, accountID)
		}
	}

	return filters, nil
}

type createTransferRequest struct {
	FromAccountID  uint64 `json:"from_account_id" binding:"required" example:"1"`
	ToAccountID    uint64 `json:"to_account_id" binding:"required" example:"2"`
	AmountSent     string `json:"amount_sent" binding:"required" example:"100"`
	AmountReceived string `json:"amount_received" binding:"required" example:"387041"`
	Date           string `json:"date" binding:"required" example:"2026-10-28T10:00:00-05:00"`
	CategoryID     uint64 `json:"category_id" binding:"required" example:"10"`
	Description    string `json:"description" binding:"omitempty,max=255" example:"Cambio a pesos"`
}

type transferResponse struct {
	TransferGroupID string              `json:"transfer_group_id"`
	FromCurrency    string              `json:"from_currency" example:"USD"`
	ToCurrency      string              `json:"to_currency" example:"COP"`
	EffectiveRate   string              `json:"effective_rate" example:"3870.41"`
	MarketRate      *string             `json:"market_rate" example:"3890"`
	Out             transactionResponse `json:"out"`
	In              transactionResponse `json:"in"`
}

// CreateTransfer godoc
//
//	@Summary		Transfer between accounts
//	@Description	Creates an expense in the origin account and an income in the destination with the same transfer_group_id. Between currencies, amount_received is what arrived; effective_rate = amount_received / amount_sent and market_rate is the official rate of the day.
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			request	body		createTransferRequest			true	"Transfer"
//	@Success		201		{object}	response{data=transferResponse}	"Transfer created"
//	@Failure		400		{object}	errorResponse					"Validation error"
//	@Failure		404		{object}	errorResponse					"Account not found"
//	@Router			/transactions/transfer [post]
//	@Security		BearerAuth
func (ph *TransactionHandler) CreateTransfer(ctx *gin.Context) {
	var req createTransferRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	sent, sErr := decimal.NewFromString(req.AmountSent)
	received, rErr := decimal.NewFromString(req.AmountReceived)
	if sErr != nil || rErr != nil {
		handleError(ctx, domain.ErrInvalidTransfer)
		return
	}
	date, err := time.Parse(enums.DateTimeUtc, req.Date)
	if err != nil {
		validationError(ctx, err)
		return
	}

	transfer := &domain.Transfer{
		UserID: *userID, FromAccountID: req.FromAccountID, ToAccountID: req.ToAccountID,
		AmountSent: sent, AmountReceived: received, Date: date,
		Description: strings.TrimSpace(req.Description), CategoryID: req.CategoryID,
	}
	if err = ph.svc.CreateTransfer(ctx, transfer); err != nil {
		handleError(ctx, err)
		return
	}

	handleCreatedSuccess(ctx, transferResponse{
		TransferGroupID: transfer.GroupID,
		FromCurrency:    transfer.FromCurrency,
		ToCurrency:      transfer.ToCurrency,
		EffectiveRate:   transfer.EffectiveRate().String(),
		MarketRate:      decimalString(transfer.MarketRate),
		Out:             newTransactionResponse(&transfer.Out),
		In:              newTransactionResponse(&transfer.In),
	})
}
