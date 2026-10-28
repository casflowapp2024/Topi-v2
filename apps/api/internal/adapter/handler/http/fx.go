package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// FxHandler represents the HTTP handler for currencies, exchange rates and net worth.
// Money and rates go as strings (exact decimals); the front rounds only to display them.
type FxHandler struct {
	svc port.FxService
}

// NewFxHandler creates a new FxHandler instance
func NewFxHandler(svc port.FxService) *FxHandler {
	return &FxHandler{svc}
}

type currencyResponse struct {
	Code       string `json:"code" example:"USD"`
	Name       string `json:"name" example:"Dólar estadounidense"`
	Symbol     string `json:"symbol" example:"US$"`
	MinorUnits int    `json:"minor_units" example:"2"`
}

// GetCurrencies godoc
//
//	@Summary		List currencies
//	@Description	Active currencies an account can use
//	@Tags			Fx
//	@Produce		json
//	@Success		200	{object}	response{data=[]currencyResponse}	"Currencies"
//	@Failure		401	{object}	errorResponse						"Unauthorized error"
//	@Router			/currencies [get]
//	@Security		BearerAuth
func (fh *FxHandler) GetCurrencies(ctx *gin.Context) {
	currencies, err := fh.svc.ListCurrencies(ctx)
	if err != nil {
		handleError(ctx, err)
		return
	}
	rsp := make([]currencyResponse, 0, len(currencies))
	for _, c := range currencies {
		rsp = append(rsp, currencyResponse{Code: c.Code, Name: c.Name, Symbol: c.Symbol, MinorUnits: c.MinorUnits})
	}
	handleSuccess(ctx, rsp)
}

type fxRateRequest struct {
	From string `form:"from" binding:"required,len=3" example:"USD"`
	To   string `form:"to" binding:"required,len=3" example:"COP"`
	Date string `form:"date" binding:"omitempty" example:"2026-10-28"`
}

type fxRateResponse struct {
	From   string  `json:"from" example:"USD"`
	To     string  `json:"to" example:"COP"`
	Date   string  `json:"date" example:"2026-10-28"`
	Rate   *string `json:"rate" example:"3870.41"`
	Source *string `json:"source" example:"SFC_TRM"`
}

// GetFxRate godoc
//
//	@Summary		Exchange rate
//	@Description	1 from = rate to on date (last rate on or before it; today by default). rate is null when unknown.
//	@Tags			Fx
//	@Produce		json
//	@Param			from	query		string	true	"ISO 4217 code"
//	@Param			to		query		string	true	"ISO 4217 code"
//	@Param			date	query		string	false	"YYYY-MM-DD"
//	@Success		200		{object}	response{data=fxRateResponse}	"Rate"
//	@Failure		400		{object}	errorResponse					"Validation error"
//	@Router			/fx/rate [get]
//	@Security		BearerAuth
func (fh *FxHandler) GetFxRate(ctx *gin.Context) {
	var req fxRateRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}
	var date time.Time
	if req.Date != "" {
		parsed, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			validationError(ctx, err)
			return
		}
		date = parsed
	}
	quote, err := fh.svc.GetQuote(ctx, req.From, req.To, date)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, fxRateResponse{
		From: quote.From, To: quote.To, Date: quote.Date.Format("2006-01-02"),
		Rate: decimalString(quote.Rate), Source: quote.Source,
	})
}

type netWorthAccountResponse struct {
	AccountID      uint64  `json:"account_id" example:"1"`
	Name           string  `json:"name" example:"Ahorros USD"`
	Bank           string  `json:"bank" example:"Bancolombia"`
	LastFourDigits string  `json:"last_four_digits" example:"1234"`
	TypeID         uint64  `json:"type_id" example:"1"`
	Currency       string  `json:"currency" example:"USD"`
	Balance        string  `json:"balance" example:"1250.5"`
	Rate           *string `json:"rate" example:"3870.41"`
	BaseValue      *string `json:"base_value" example:"4839944.21"`
	Cost           *string `json:"cost" example:"4700000"`
	UnrealizedGain *string `json:"unrealized_gain" example:"139944.21"`
	// MarketGain: investments only, value − contributions in the account currency
	MarketGain *string `json:"market_gain,omitempty" example:"250000"`
}

type netWorthResponse struct {
	BaseCurrency   string `json:"base_currency" example:"COP"`
	Date           string `json:"date" example:"2026-10-28"`
	Total          string `json:"total" example:"12500000"`
	UnrealizedGain string `json:"unrealized_gain" example:"139944.21"`
	// UnrealizedGain = MarketGain (investment valuations) + FxGain (exchange rates)
	MarketGain   string                    `json:"market_gain" example:"100000"`
	FxGain       string                    `json:"fx_gain" example:"39944.21"`
	MissingRates bool                      `json:"missing_rates" example:"false"`
	Accounts     []netWorthAccountResponse `json:"accounts"`
}

// GetNetWorth godoc
//
//	@Summary		Net worth
//	@Description	Every account valued today in the user's base currency, with its historical cost and unrealized exchange gain or loss
//	@Tags			Analysis
//	@Produce		json
//	@Success		200	{object}	response{data=netWorthResponse}	"Net worth"
//	@Failure		401	{object}	errorResponse					"Unauthorized error"
//	@Router			/analysis/net-worth [get]
//	@Security		BearerAuth
func (fh *FxHandler) GetNetWorth(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	netWorth, err := fh.svc.GetNetWorth(ctx, *userID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	rsp := netWorthResponse{
		BaseCurrency:   netWorth.BaseCurrency,
		Date:           netWorth.Date.Format("2006-01-02"),
		Total:          netWorth.Total.String(),
		UnrealizedGain: netWorth.UnrealizedGain.String(),
		MarketGain:     netWorth.MarketGain.String(),
		FxGain:         netWorth.FxGain.String(),
		MissingRates:   netWorth.MissingRates,
		Accounts:       make([]netWorthAccountResponse, 0, len(netWorth.Accounts)),
	}
	for _, a := range netWorth.Accounts {
		rsp.Accounts = append(rsp.Accounts, netWorthAccountResponse{
			AccountID: a.AccountID, Name: a.Name, Bank: a.Bank, LastFourDigits: a.LastFourDigits, TypeID: a.TypeID,
			Currency: a.Currency, Balance: a.Balance.String(), Rate: decimalString(a.Rate),
			BaseValue: decimalString(a.BaseValue), Cost: decimalString(a.Cost),
			UnrealizedGain: decimalString(a.UnrealizedGain),
			MarketGain:     decimalString(a.MarketGain),
		})
	}
	handleSuccess(ctx, rsp)
}

// decimalString renders an optional decimal as a JSON string (null when nil)
func decimalString(d *decimal.Decimal) *string {
	if d == nil {
		return nil
	}
	s := d.String()
	return &s
}
