package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"time"

	"github.com/gin-gonic/gin"
)

// CurrencyChangeHandler represents the HTTP handler to change the currency of accounts and of
// the user, and to close accounts
type CurrencyChangeHandler struct {
	svc port.CurrencyChangeService
}

// NewCurrencyChangeHandler creates a new CurrencyChangeHandler instance
func NewCurrencyChangeHandler(svc port.CurrencyChangeService) *CurrencyChangeHandler {
	return &CurrencyChangeHandler{svc: svc}
}

type accountIDURI struct {
	ID uint64 `uri:"id" binding:"required,min=1" example:"3"`
}

type currencyChangeURI struct {
	ID       uint64 `uri:"id" binding:"required,min=1" example:"3"`
	ChangeID uint64 `uri:"change_id" binding:"required,min=1" example:"7"`
}

type changeAccountCurrencyRequest struct {
	Currency string `json:"currency" binding:"required,len=3" example:"USD"`
	// Mode: relabel (the amounts were already in the new currency) | convert (convert them)
	Mode string `json:"mode" binding:"required,oneof=relabel convert" example:"convert"`
	// Apply: false = preview only
	Apply bool `json:"apply" example:"false"`
}

type accountCurrencyChangeResponse struct {
	ChangeID        *uint64 `json:"change_id,omitempty" example:"7"`
	Applied         bool    `json:"applied" example:"true"`
	Mode            string  `json:"mode" example:"convert"`
	OldCurrency     string  `json:"old_currency" example:"COP"`
	NewCurrency     string  `json:"new_currency" example:"USD"`
	Transactions    int     `json:"transactions" example:"42"`
	MissingRates    int     `json:"missing_rates" example:"0"`
	ReplacedRates   int     `json:"replaced_rates" example:"0"`
	BalanceBefore   string  `json:"balance_before" example:"8000000"`
	BalanceAfter    string  `json:"balance_after" example:"2000.15"`
	FlowsBaseBefore string  `json:"flows_base_before" example:"8000000"`
	FlowsBaseAfter  string  `json:"flows_base_after" example:"8000000"`
}

// ChangeAccountCurrency godoc
//
//	@Summary		Change the currency of an account
//	@Description	relabel: the amounts were already in the new currency (rates and base amounts are recomputed; historical reports change). convert: each amount is converted with the rate of its date and the base amount stays. apply=false returns the preview; a conversion with missing_rates > 0 cannot be applied.
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		uint64												true	"Account ID"
//	@Param			request	body		changeAccountCurrencyRequest						true	"Change"
//	@Success		200		{object}	response{data=accountCurrencyChangeResponse}	"Preview or applied change"
//	@Failure		400		{object}	errorResponse										"Invalid currency or mode"
//	@Failure		409		{object}	errorResponse										"Missing exchange rates"
//	@Router			/accounts/{id}/currency [post]
//	@Security		BearerAuth
func (ch *CurrencyChangeHandler) ChangeAccountCurrency(ctx *gin.Context) {
	var (
		uri accountIDURI
		req changeAccountCurrencyRequest
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

	change := &domain.AccountCurrencyChange{UserID: *userID, AccountID: uri.ID, NewCurrency: req.Currency,
		Mode: req.Mode, Apply: req.Apply}
	if err = ch.svc.ChangeAccountCurrency(ctx, change); err != nil {
		handleError(ctx, err)
		return
	}
	rsp := accountCurrencyChangeResponse{
		Applied: change.ID != 0, Mode: change.Mode, OldCurrency: change.OldCurrency, NewCurrency: change.NewCurrency,
		Transactions: change.TxCount, MissingRates: change.MissingRates, ReplacedRates: change.ReplacedRates,
		BalanceBefore: change.BalanceBefore.String(), BalanceAfter: change.BalanceAfter.String(),
		FlowsBaseBefore: change.FlowsBaseBefore.String(), FlowsBaseAfter: change.FlowsBaseAfter.String(),
	}
	if change.ID != 0 {
		rsp.ChangeID = &change.ID
	}
	handleSuccess(ctx, rsp)
}

type currencyChangeItemResponse struct {
	ID          uint64  `json:"id" example:"7"`
	Mode        string  `json:"mode" example:"convert"`
	OldCurrency string  `json:"old_currency" example:"COP"`
	NewCurrency string  `json:"new_currency" example:"USD"`
	CreatedAt   string  `json:"created_at" example:"2026-10-28T20:00:00Z"`
	UndoneAt    *string `json:"undone_at" example:"2026-10-28T20:05:00Z"`
}

// ListAccountCurrencyChanges godoc
//
//	@Summary		Currency changes of an account
//	@Tags			Accounts
//	@Produce		json
//	@Param			id	path		uint64											true	"Account ID"
//	@Success		200	{object}	response{data=[]currencyChangeItemResponse}	"Changes, newest first"
//	@Router			/accounts/{id}/currency-changes [get]
//	@Security		BearerAuth
func (ch *CurrencyChangeHandler) ListAccountCurrencyChanges(ctx *gin.Context) {
	var uri accountIDURI
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	changes, err := ch.svc.ListAccountCurrencyChanges(ctx, *userID, uri.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	out := make([]currencyChangeItemResponse, 0, len(changes))
	for _, c := range changes {
		item := currencyChangeItemResponse{ID: c.ID, Mode: c.Mode, OldCurrency: c.OldCurrency, NewCurrency: c.NewCurrency,
			CreatedAt: c.CreatedAt.UTC().Format(time.RFC3339)}
		if c.UndoneAt != nil {
			undone := c.UndoneAt.UTC().Format(time.RFC3339)
			item.UndoneAt = &undone
		}
		out = append(out, item)
	}
	handleSuccess(ctx, out)
}

// UndoAccountCurrencyChange godoc
//
//	@Summary		Undo a currency change
//	@Description	Only the last change of the account, and only if no transaction or valuation of the account was added or edited afterwards.
//	@Tags			Accounts
//	@Produce		json
//	@Param			id			path		uint64			true	"Account ID"
//	@Param			change_id	path		uint64			true	"Change ID"
//	@Success		200			{object}	response		"Undone"
//	@Failure		404			{object}	errorResponse	"Change not found"
//	@Failure		409			{object}	errorResponse	"The account changed afterwards"
//	@Router			/accounts/{id}/currency-changes/{change_id}/undo [post]
//	@Security		BearerAuth
func (ch *CurrencyChangeHandler) UndoAccountCurrencyChange(ctx *gin.Context) {
	var uri currencyChangeURI
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	if err = ch.svc.UndoAccountCurrencyChange(ctx, *userID, uri.ID, uri.ChangeID); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, nil)
}

type accountClosedResponse struct {
	ClosedAt *string `json:"closed_at" example:"2026-10-28T20:00:00Z"`
}

// CloseAccount godoc
//
//	@Summary		Close an account
//	@Description	The account keeps its history in reports but is not offered for new movements.
//	@Tags			Accounts
//	@Produce		json
//	@Param			id	path		uint64								true	"Account ID"
//	@Success		200	{object}	response{data=accountClosedResponse}	"Closed"
//	@Failure		404	{object}	errorResponse						"Account not found"
//	@Router			/accounts/{id}/close [post]
//	@Security		BearerAuth
func (ch *CurrencyChangeHandler) CloseAccount(ctx *gin.Context) { ch.setClosed(ctx, true) }

// ReopenAccount godoc
//
//	@Summary		Reopen a closed account
//	@Tags			Accounts
//	@Produce		json
//	@Param			id	path		uint64								true	"Account ID"
//	@Success		200	{object}	response{data=accountClosedResponse}	"Reopened"
//	@Failure		404	{object}	errorResponse						"Account not found"
//	@Router			/accounts/{id}/reopen [post]
//	@Security		BearerAuth
func (ch *CurrencyChangeHandler) ReopenAccount(ctx *gin.Context) { ch.setClosed(ctx, false) }

func (ch *CurrencyChangeHandler) setClosed(ctx *gin.Context, closed bool) {
	var uri accountIDURI
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	closedAt, err := ch.svc.SetAccountClosed(ctx, *userID, uri.ID, closed)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, accountClosedResponse{ClosedAt: timeString(closedAt)})
}

type changeBaseCurrencyRequest struct {
	Currency string `json:"currency" binding:"required,len=3" example:"USD"`
	// Apply: false = preview only
	Apply bool `json:"apply" example:"false"`
}

type baseCurrencyChangeResponse struct {
	Applied        bool   `json:"applied" example:"false"`
	OldCurrency    string `json:"old_currency" example:"COP"`
	NewCurrency    string `json:"new_currency" example:"USD"`
	Transactions   int    `json:"transactions" example:"840"`
	MissingRates   int    `json:"missing_rates" example:"0"`
	ReplacedRates  int    `json:"replaced_rates" example:"2"`
	NetWorthBefore string `json:"net_worth_before" example:"52000000"`
	NetWorthAfter  string `json:"net_worth_after" example:"13435.5"`
}

// ChangeBaseCurrency godoc
//
//	@Summary		Change the user's base currency
//	@Description	Every base amount is recomputed with the market rate of its date (manual rates are replaced; both legs of a transfer keep the same base amount). apply=false returns the preview.
//	@Tags			UserExtra
//	@Accept			json
//	@Produce		json
//	@Param			request	body		changeBaseCurrencyRequest					true	"Change"
//	@Success		200		{object}	response{data=baseCurrencyChangeResponse}	"Preview or applied change"
//	@Failure		400		{object}	errorResponse								"Invalid currency"
//	@Router			/user-extra/base-currency [post]
//	@Security		BearerAuth
func (ch *CurrencyChangeHandler) ChangeBaseCurrency(ctx *gin.Context) {
	var req changeBaseCurrencyRequest
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	change := &domain.BaseCurrencyChange{UserID: *userID, NewCurrency: req.Currency, Apply: req.Apply}
	if err = ch.svc.ChangeBaseCurrency(ctx, change); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, baseCurrencyChangeResponse{
		Applied: change.Apply, OldCurrency: change.OldCurrency, NewCurrency: change.NewCurrency,
		Transactions: change.TxCount, MissingRates: change.MissingRates, ReplacedRates: change.ReplacedRates,
		NetWorthBefore: change.NetWorthBefore.String(), NetWorthAfter: change.NetWorthAfter.String(),
	})
}

// timeString is t in RFC 3339 (UTC), or nil
func timeString(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}
