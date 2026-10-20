package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"time"

	"github.com/gin-gonic/gin"
)

// AnalysisHandler represents the HTTP handler to get financial reports
type AnalysisHandler struct {
	svc port.AnalysisService
}

// NewAnalysisHandler creates a new AnalysisHandler instance
func NewAnalysisHandler(svc port.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{
		svc,
	}
}

type FinancialReportRequest struct {
	Date string `form:"date" binding:"required" example:"2023-10-01"`
}

// GetFinancialReport retrieves the financial report
//
//	@Summary		Get financial report
//	@Description	Retrieves savings, credits, income and expenses metrics for the given date
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			date	query	string	true	"Date filter in YYYY-MM-DD format"
//	@Success		200		{object}	response{data=financialReportResponse}	"Financial report"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/analysis/financial-report [get]
func (ah *AnalysisHandler) GetFinancialReport(ctx *gin.Context) {
	var req FinancialReportRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		validationError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	dateFilter, err := time.Parse(enums.Date, req.Date)
	if err != nil {
		validationError(ctx, err)
		return
	}

	report, err := ah.svc.GetFinancialReport(ctx, *userID, dateFilter)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newFinancialReportResponse(&report)

	handleSuccess(ctx, rsp)
}

// balanceByAccountRequest represents a request body for retrieving the balance by account
type balanceByAccountRequest struct {
	Filter string `form:"filter" binding:"omitempty" example:"savings"`
}

// GetBalanceByAccount retrieves the balance grouped by account
//
//	@Summary		Get balance by account
//	@Description	Retrieves the balance grouped by account for the authenticated user
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			filter	query	string	false	"Optional filter (e.g., 'savings')"
//	@Success		200		{object}	response{data=balanceByAccountResponse}	"Balance by account"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/analysis/accounts-balance [get]
func (ah *AnalysisHandler) GetBalanceByAccount(ctx *gin.Context) {
	var req balanceByAccountRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		validationError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	balance, err := ah.svc.GetAccountsBalance(ctx, *userID, req.Filter)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newBalanceByAccountResponse(balance)

	handleSuccess(ctx, rsp)
}

type CategoryReportRequest struct {
	Filter string  `json:"date_filter" binding:"required"`
	SortBy *string `json:"sort_by" binding:"omitempty,oneof=amount usage"`
}

// GetCategoriesReport retrieves the category expense report
//
//	@Summary		Get categories expense report
//	@Description	Returns expense report by category for the given date, sorted by expense or usage (defaults to expense if not specified)
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			request	body	CategoryReportRequest	true	"Date filter and optional sort field"
//	@Success		200		{object}	response{data=categoryReportResponse}	"Categories expense report"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/analysis/categories-report [post]
func (ah *AnalysisHandler) GetCategoriesReport(ctx *gin.Context) {
	var req CategoryReportRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		validationError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	dateFilter, err := time.Parse(enums.Date, req.Filter)
	if err != nil {
		validationError(ctx, err)
		return
	}

	report, err := ah.svc.GetCategoriesReport(ctx, *userID, dateFilter, req.SortBy)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newCategoryExpenseReportResponse(report)

	handleSuccess(ctx, rsp)
}

type FinancialAnalysisRequest struct {
	Date string `form:"date" binding:"required" example:"2025-05"`
}

// GetFinancialAnalysis retrieves daily and monthly analysis within a date range
//
//	@Summary		Get financial analysis
//	@Description	Returns monthly and daily financial analysis for the last 12 months starting from the provided month
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			date	query	string	true	"Month in YYYY-MM format"
//	@Success		200		{object}	response{data=FinancialAnalysisResponse}	"Financial analysis"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/analysis/financial-analysis [get]
func (ah *AnalysisHandler) GetFinancialAnalysis(ctx *gin.Context) {
	var req FinancialAnalysisRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		validationError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	financialAnalysis, err := ah.svc.GetFinancialAnalysis(ctx, *userID, req.Date)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newFinancialAnalysisResponse(&financialAnalysis)

	handleSuccess(ctx, rsp)
}

type CategoryAnalysisRequest struct {
	CategoryID uint64 `form:"category_id" binding:"required" example:"6"`
	Date       string `form:"date" binding:"required" example:"2025-05"`
}

// GetCategoryAnalysis retrieves the category behavior analysis over time
//
//	@Summary		Get category analysis
//	@Description	Returns monthly expense analysis for a specific category over the last 12 months starting from the provided month
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			category_id	query	uint64	true	"Category ID to analyze"
//	@Param			date		query	string	true	"Month in YYYY-MM format"
//	@Success		200			{object}	response{data=CategoryAnalysisResponse}	"Category analysis"
//	@Failure		400			{object}	errorResponse	"Validation error"
//	@Failure		401			{object}	errorResponse	"Unauthorized error"
//	@Failure		500			{object}	errorResponse	"Internal server error"
//	@Router			/analysis/category-analysis [get]
func (ah *AnalysisHandler) GetCategoryAnalysis(ctx *gin.Context) {
	var req CategoryAnalysisRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		validationError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	analysis, err := ah.svc.GetCategoryAnalysis(ctx, *userID, req.CategoryID, req.Date)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newCategoryAnalysisResponse(&analysis)

	handleSuccess(ctx, rsp)
}

type AccountsReportRequest struct {
	Start        string  `json:"start" binding:"required" example:"2023-10-01"`
	End          string  `json:"end" binding:"required" example:"2023-10-01"`
	AccountsType string  `json:"accounts_type" binding:"required,oneof=savings credits investments" example:"savings"`
	Accounts     []int64 `json:"accounts" binding:"required" example:"[1,2,3,4]"`
}

// GetAccountsReport retrieves detailed financial report for specific accounts
//
//	@Summary		Get accounts report
//	@Description	Returns a detailed financial report for specified accounts within a date range, filtered by account type
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			request	body	AccountsReportRequest	true	"Accounts report request with date range, account type and account IDs"
//	@Success		200		{object}	response{data=AccountsReportResponse}	"Accounts report"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/analysis/accounts-report [post]
func (ah *AnalysisHandler) GetAccountsReport(ctx *gin.Context) {
	var req AccountsReportRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		validationError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	start, end, err := utils.FormatARDates(req.Start, req.End)
	if err != nil {
		validationError(ctx, err)
		return
	}

	report := domain.AccountsReport{
		UserID:       *userID,
		Start:        start,
		End:          end,
		Accounts:     req.Accounts,
		AccountsType: req.AccountsType,
	}

	err = ah.svc.GetAccountsReport(ctx, &report)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountsResponse(&report)

	handleSuccess(ctx, rsp)
}

type AccountAnalysisRequest struct {
	AccountID uint64 `form:"account_id" binding:"required" example:"1"`
	Date      string `form:"date" binding:"required" example:"2025-05"`
}

// GetAccountAnalysis retrieves the account behavior analysis over time
//
//	@Summary		Get account analysis
//	@Description	Returns monthly balance, income and expenses analysis for a specific account over the last 12 months starting from the provided month
//	@Tags			Analysis
//	@Accept			json
//	@Produce		json
//	@Param			account_id	query	uint64	true	"Account ID to analyze"
//	@Param			date		query	string	true	"Month in YYYY-MM format"
//	@Success		200			{object}	response{data=AccountAnalysisResponse}	"Account analysis"
//	@Failure		400			{object}	errorResponse	"Validation error"
//	@Failure		401			{object}	errorResponse	"Unauthorized error"
//	@Failure		500			{object}	errorResponse	"Internal server error"
//	@Router			/analysis/account-analysis [get]
func (ah *AnalysisHandler) GetAccountAnalysis(ctx *gin.Context) {
	var req AccountAnalysisRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	accountAnalysis, err := ah.svc.GetAccountAnalysis(ctx, *userID, req.AccountID, req.Date)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAccountAnalysisResponse(&accountAnalysis)

	handleSuccess(ctx, rsp)
}
