package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// CreditCardHandler represents the HTTP handler for credit card terms and status
type CreditCardHandler struct {
	svc port.CreditCardService
}

// NewCreditCardHandler creates a new CreditCardHandler instance
func NewCreditCardHandler(svc port.CreditCardService) *CreditCardHandler {
	return &CreditCardHandler{svc: svc}
}

// creditCardTerms is the body and the response of the card terms (decimals as strings)
type creditCardTerms struct {
	CreditLimit    *string `json:"credit_limit" example:"8000000"`
	StatementDay   *int16  `json:"statement_day" binding:"omitempty,min=1,max=31" example:"15"`
	DueDay         *int16  `json:"due_day" binding:"omitempty,min=1,max=31" example:"30"`
	InterestRateEA *string `json:"interest_rate_ea" example:"28.5"`
}

func newCreditCardTerms(d *domain.CreditCardDetails) creditCardTerms {
	return creditCardTerms{CreditLimit: decimalString(d.CreditLimit), StatementDay: d.StatementDay, DueDay: d.DueDay,
		InterestRateEA: decimalString(d.InterestRateEA)}
}

// optionalDecimal parses an optional decimal string (empty = not set)
func optionalDecimal(s *string) (*decimal.Decimal, bool) {
	if s == nil || *s == "" {
		return nil, true
	}
	d, err := decimal.NewFromString(*s)
	if err != nil {
		return nil, false
	}
	return &d, true
}

// GetCreditCard godoc
//
//	@Summary		Credit card terms
//	@Tags			Accounts
//	@Produce		json
//	@Param			id	path		uint64							true	"Account ID"
//	@Success		200	{object}	response{data=creditCardTerms}	"Terms (null fields when not set)"
//	@Failure		400	{object}	errorResponse					"Not a credit card"
//	@Router			/accounts/{id}/credit-card [get]
//	@Security		BearerAuth
func (ch *CreditCardHandler) GetCreditCard(ctx *gin.Context) {
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
	details, err := ch.svc.GetCreditCard(ctx, *userID, uri.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, newCreditCardTerms(details))
}

// SaveCreditCard godoc
//
//	@Summary		Set the credit card terms
//	@Description	Credit limit, statement day, due day and interest rate (all optional). The first time it also creates the categories "Intereses" and "Comisiones" if the user has none with those names.
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		uint64							true	"Account ID"
//	@Param			request	body		creditCardTerms					true	"Terms"
//	@Success		200		{object}	response{data=creditCardTerms}	"Saved"
//	@Failure		400		{object}	errorResponse					"Invalid terms or not a credit card"
//	@Router			/accounts/{id}/credit-card [put]
//	@Security		BearerAuth
func (ch *CreditCardHandler) SaveCreditCard(ctx *gin.Context) {
	var (
		uri accountIDURI
		req creditCardTerms
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
	limit, okLimit := optionalDecimal(req.CreditLimit)
	rate, okRate := optionalDecimal(req.InterestRateEA)
	if !okLimit || !okRate {
		handleError(ctx, domain.ErrInvalidCreditCard)
		return
	}
	details := &domain.CreditCardDetails{AccountID: uri.ID, UserID: *userID, CreditLimit: limit,
		StatementDay: req.StatementDay, DueDay: req.DueDay, InterestRateEA: rate}
	if err = ch.svc.SaveCreditCard(ctx, details); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, newCreditCardTerms(details))
}

type creditCardStatusResponse struct {
	creditCardTerms
	AccountID            uint64  `json:"account_id" example:"4"`
	Name                 string  `json:"name" example:"Visa"`
	Currency             string  `json:"currency" example:"COP"`
	Debt                 string  `json:"debt" example:"1250000"`
	Available            *string `json:"available" example:"6750000"`
	LastStatement        *string `json:"last_statement" example:"2026-10-15"`
	NextStatement        *string `json:"next_statement" example:"2026-11-15"`
	DueDate              *string `json:"due_date" example:"2026-10-30"`
	StatementDebt        *string `json:"statement_debt" example:"900000"`
	PaidSinceStatement   *string `json:"paid_since_statement" example:"400000"`
	PendingStatement     *string `json:"pending_statement" example:"500000"`
	PurchasesSince       *string `json:"purchases_since" example:"350000"`
	InstallmentPurchases int     `json:"installment_purchases" example:"2"`
}

func dateString(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.DateOnly)
	return &s
}

// ListCreditCards godoc
//
//	@Summary		Credit cards today
//	@Description	For each open card: debt, available credit and the last billing period (statement debt, payments since, what is left to pay and the due date). With purchases in installments the bank bills only the installment, so pending_statement is an upper bound.
//	@Tags			Analysis
//	@Produce		json
//	@Success		200	{object}	response{data=[]creditCardStatusResponse}	"Cards"
//	@Router			/analysis/credit-cards [get]
//	@Security		BearerAuth
func (ch *CreditCardHandler) ListCreditCards(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	cards, err := ch.svc.ListCreditCardStatus(ctx, *userID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	out := make([]creditCardStatusResponse, 0, len(cards))
	for i := range cards {
		c := &cards[i]
		out = append(out, creditCardStatusResponse{
			creditCardTerms: newCreditCardTerms(&c.CreditCardDetails),
			AccountID:       c.AccountID, Name: c.Name, Currency: c.Currency,
			Debt: c.Debt.String(), Available: decimalString(c.Available),
			LastStatement: dateString(c.LastStatement), NextStatement: dateString(c.NextStatement),
			DueDate: dateString(c.DueDate), StatementDebt: decimalString(c.StatementDebt),
			PaidSinceStatement: decimalString(c.PaidSinceStatement), PendingStatement: decimalString(c.PendingStatement),
			PurchasesSince: decimalString(c.PurchasesSince), InstallmentPurchases: c.InstallmentPurchases,
		})
	}
	handleSuccess(ctx, out)
}
