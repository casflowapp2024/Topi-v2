package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// ValuationHandler represents the HTTP handler for valuations of investment accounts
type ValuationHandler struct {
	svc port.ValuationService
	now func() time.Time
}

// NewValuationHandler creates a new ValuationHandler instance
func NewValuationHandler(svc port.ValuationService) *ValuationHandler {
	return &ValuationHandler{svc: svc, now: time.Now}
}

type valuationAccountURI struct {
	ID uint64 `uri:"id" binding:"required,min=1" example:"3"`
}

type valuationURI struct {
	ID          uint64 `uri:"id" binding:"required,min=1" example:"3"`
	ValuationID uint64 `uri:"valuation_id" binding:"required,min=1" example:"10"`
}

type saveValuationRequest struct {
	Date  string `json:"date" binding:"required" example:"2026-10-28"`
	Value string `json:"value" binding:"required" example:"12500000"`
	Note  string `json:"note" binding:"omitempty,max=255" example:"Extracto de octubre"`
}

type valuationResponse struct {
	ID        uint64 `json:"id" example:"10"`
	AccountID uint64 `json:"account_id" example:"3"`
	Date      string `json:"date" example:"2026-10-28"`
	Value     string `json:"value" example:"12500000"`
	Source    string `json:"source" example:"manual"`
	Note      string `json:"note" example:"Extracto de octubre"`
}

func newValuationResponse(v *domain.AccountValuation) valuationResponse {
	return valuationResponse{
		ID: v.ID, AccountID: v.AccountID, Date: v.Date.Format(time.DateOnly), Value: v.Value.String(),
		Source: v.Source, Note: v.Note,
	}
}

// ListValuations godoc
//
//	@Summary		Valuations of an investment account
//	@Description	What the account was worth at the end of each day the user recorded, newest first (amounts in the account currency).
//	@Tags			Accounts
//	@Produce		json
//	@Param			id	path		uint64								true	"Account ID"
//	@Success		200	{object}	response{data=[]valuationResponse}	"Valuations"
//	@Router			/accounts/{id}/valuations [get]
//	@Security		BearerAuth
func (vh *ValuationHandler) ListValuations(ctx *gin.Context) {
	var uri valuationAccountURI

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	valuations, err := vh.svc.ListValuations(ctx, *userID, uri.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	out := make([]valuationResponse, 0, len(valuations))
	for i := range valuations {
		out = append(out, newValuationResponse(&valuations[i]))
	}
	handleSuccess(ctx, out)
}

// SaveValuation godoc
//
//	@Summary		Record what an investment account is worth
//	@Description	Creates the valuation of that day or replaces it. The balance of the account follows the last valuation plus the movements after it; valuations are not income or expenses.
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		uint64								true	"Account ID"
//	@Param			request	body		saveValuationRequest				true	"Valuation"
//	@Success		201		{object}	response{data=valuationResponse}	"Valuation saved"
//	@Failure		400		{object}	errorResponse						"Not an investment account, invalid value or date"
//	@Router			/accounts/{id}/valuations [post]
//	@Security		BearerAuth
func (vh *ValuationHandler) SaveValuation(ctx *gin.Context) {
	var (
		uri valuationAccountURI
		req saveValuationRequest
	)

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	date, dErr := time.Parse(time.DateOnly, req.Date)
	value, vErr := decimal.NewFromString(req.Value)
	if dErr != nil || vErr != nil {
		handleError(ctx, domain.ErrInvalidValuation)
		return
	}

	valuation := &domain.AccountValuation{UserID: *userID, AccountID: uri.ID, Date: date, Value: value, Note: req.Note}
	if err = vh.svc.SaveValuation(ctx, valuation); err != nil {
		handleError(ctx, err)
		return
	}
	handleCreatedSuccess(ctx, newValuationResponse(valuation))
}

// DeleteValuation godoc
//
//	@Summary		Delete a valuation
//	@Tags			Accounts
//	@Produce		json
//	@Param			id				path		uint64			true	"Account ID"
//	@Param			valuation_id	path		uint64			true	"Valuation ID"
//	@Success		200				{object}	response		"Deleted"
//	@Failure		404				{object}	errorResponse	"Valuation not found"
//	@Router			/accounts/{id}/valuations/{valuation_id} [delete]
//	@Security		BearerAuth
func (vh *ValuationHandler) DeleteValuation(ctx *gin.Context) {
	var uri valuationURI

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	if err = vh.svc.DeleteValuation(ctx, *userID, uri.ID, uri.ValuationID); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, nil)
}

type investmentsRequest struct {
	Start string `form:"start" binding:"omitempty" example:"2026-10-01"`
	End   string `form:"end" binding:"omitempty" example:"2026-10-31"`
}

type investmentPerformanceResponse struct {
	AccountID          uint64  `json:"account_id" example:"3"`
	Name               string  `json:"name" example:"Fondo"`
	Currency           string  `json:"currency" example:"COP"`
	ValueStart         string  `json:"value_start" example:"10000000"`
	ValueEnd           string  `json:"value_end" example:"10600000"`
	Contributions      string  `json:"contributions" example:"500000"`
	Gain               string  `json:"gain" example:"100000"`
	GainPercent        *string `json:"gain_percent" example:"0.95"`
	ContributionsTotal string  `json:"contributions_total" example:"10000000"`
	MarketGainTotal    string  `json:"market_gain_total" example:"600000"`
	LastValuationDate  *string `json:"last_valuation_date" example:"2026-10-28"`
	LastValuationValue *string `json:"last_valuation_value" example:"10600000"`
	RateEnd            *string `json:"rate_end" example:"1"`
}

type investmentsResponse struct {
	Start    string                          `json:"start" example:"2026-10-01"`
	End      string                          `json:"end" example:"2026-10-31"`
	Accounts []investmentPerformanceResponse `json:"accounts"`
}

// GetInvestments godoc
//
//	@Summary		Investment performance
//	@Description	For each investment account in [start, end] (default: this month): value at the start and end, net contributions and gain = value_end − value_start − contributions; gain_percent over value_start + contributions. Amounts in the account currency; rate_end converts them to the base currency.
//	@Tags			Analysis
//	@Produce		json
//	@Param			start	query		string								false	"YYYY-MM-DD"
//	@Param			end		query		string								false	"YYYY-MM-DD"
//	@Success		200		{object}	response{data=investmentsResponse}	"Performance"
//	@Failure		400		{object}	errorResponse						"Invalid dates"
//	@Router			/analysis/investments [get]
//	@Security		BearerAuth
func (vh *ValuationHandler) GetInvestments(ctx *gin.Context) {
	var req investmentsRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	now := vh.now()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, -1)
	if req.Start != "" {
		if start, err = time.Parse(time.DateOnly, req.Start); err != nil {
			handleError(ctx, domain.ErrInvalidDateRange)
			return
		}
	}
	if req.End != "" {
		if end, err = time.Parse(time.DateOnly, req.End); err != nil {
			handleError(ctx, domain.ErrInvalidDateRange)
			return
		}
	}

	performance, err := vh.svc.GetInvestmentPerformance(ctx, *userID, start, end)
	if err != nil {
		handleError(ctx, err)
		return
	}

	out := investmentsResponse{Start: start.Format(time.DateOnly), End: end.Format(time.DateOnly),
		Accounts: make([]investmentPerformanceResponse, 0, len(performance))}
	for _, p := range performance {
		var lastDate *string
		if p.LastValuationDate != nil {
			d := p.LastValuationDate.Format(time.DateOnly)
			lastDate = &d
		}
		out.Accounts = append(out.Accounts, investmentPerformanceResponse{
			AccountID: p.AccountID, Name: p.Name, Currency: p.Currency,
			ValueStart: p.ValueStart.String(), ValueEnd: p.ValueEnd.String(),
			Contributions: p.Contributions.String(), Gain: p.Gain.String(),
			GainPercent:        decimalString(p.GainPercent()),
			ContributionsTotal: p.ContributionsTotal.String(), MarketGainTotal: p.MarketGainTotal.String(),
			LastValuationDate: lastDate, LastValuationValue: decimalString(p.LastValuationValue),
			RateEnd: decimalString(p.RateEnd),
		})
	}
	handleSuccess(ctx, out)
}
