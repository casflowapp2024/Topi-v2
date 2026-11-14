package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BillingHandler serves "Apoyar a Topi" (plan/22-modelo-negocio.md, N1) and the payment webhooks
type BillingHandler struct {
	svc port.BillingService
}

// NewBillingHandler creates a BillingHandler
func NewBillingHandler(svc port.BillingService) *BillingHandler {
	return &BillingHandler{svc: svc}
}

type supportRequest struct {
	// Amount in whole pesos as a decimal string ("20000")
	Amount string `json:"amount" binding:"required"`
}

// Config godoc
//
//	@Summary	Whether "Apoyar a Topi" is available and the amounts offered
//	@Tags		Billing
//	@Produce	json
//	@Success	200	{object}	response{data=domain.BillingConfig}
//	@Router		/billing/config [get]
//	@Security	BearerAuth
func (h *BillingHandler) Config(ctx *gin.Context) {
	handleSuccess(ctx, h.svc.Config())
}

// StartSupport godoc
//
//	@Summary		Start a voluntary support payment
//	@Description	Creates the payment and returns the checkout URL of the provider. The payment is approved only by the provider (webhook or server query), never by the front.
//	@Tags			Billing
//	@Accept			json
//	@Produce		json
//	@Param			request	body		supportRequest								true	"Amount in whole pesos"
//	@Success		200		{object}	response{data=domain.CheckoutSession}
//	@Failure		400		{object}	errorResponse	"Invalid amount"
//	@Failure		404		{object}	errorResponse	"Payments not available"
//	@Router			/billing/support [post]
//	@Security		BearerAuth
func (h *BillingHandler) StartSupport(ctx *gin.Context) {
	userID, ok := billingUser(ctx)
	if !ok {
		return
	}
	var req supportRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		handleError(ctx, domain.ErrInvalidSupportAmount)
		return
	}
	session, err := h.svc.StartSupport(ctx, userID, req.Amount)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, session)
}

// GetPayment godoc
//
//	@Summary	A payment of the user (thanks page); while not final the server asks the provider
//	@Tags		Billing
//	@Produce	json
//	@Param		id	path		string	true	"Payment id"
//	@Success	200	{object}	response{data=domain.PaymentView}
//	@Failure	404	{object}	errorResponse
//	@Router		/billing/payments/{id} [get]
//	@Security	BearerAuth
func (h *BillingHandler) GetPayment(ctx *gin.Context) {
	userID, ok := billingUser(ctx)
	if !ok {
		return
	}
	view, err := h.svc.GetPayment(ctx, userID, ctx.Param("id"))
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, view)
}

// Webhook godoc
//
//	@Summary		Payment provider notifications
//	@Description	Signature verified (Mercado Pago: x-signature with MP_WEBHOOK_SECRET); idempotent by provider reference. The status is always read from the provider API.
//	@Tags			Billing
//	@Accept			json
//	@Produce		json
//	@Param			provider	path		string	true	"mercadopago"
//	@Success		200			{object}	response		"Processed (or ignored)"
//	@Failure		401			{object}	errorResponse	"Invalid signature"
//	@Router			/billing/webhook/{provider} [post]
func (h *BillingHandler) Webhook(ctx *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(ctx.Request.Body, maxWebhookBody+1))
	if err != nil || len(body) > maxWebhookBody {
		ctx.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, newErrorResponse([]string{"body too large"}))
		return
	}
	headers := map[string]string{}
	for key, values := range ctx.Request.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}
	query := map[string]string{}
	for key, values := range ctx.Request.URL.Query() {
		if len(values) > 0 {
			query[key] = values[0]
		}
	}

	err = h.svc.HandleWebhook(ctx, ctx.Param("provider"), domain.WebhookRequest{Headers: headers, Query: query, Body: body})
	switch {
	case err == nil:
		handleCustomSuccess(ctx, "ok")
	case errors.Is(err, domain.ErrInvalidWebhookSignature):
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, newErrorResponse([]string{domain.ErrUnauthorized.Error()}))
	default:
		// 4xx for an unknown provider; 5xx otherwise, so the provider retries the notification
		handleError(ctx, err)
	}
}

// serviceCallerID is the UserID of the X-API-Key payload (service.ServiceUserID): it is not a user
const serviceCallerID = "service"

// billingUser returns the authenticated user; internal callers (X-API-Key) cannot pay
func billingUser(ctx *gin.Context) (string, bool) {
	payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return "", false
	}
	if payload.UserID == "" || payload.UserID == serviceCallerID {
		handleError(ctx, domain.ErrForbidden)
		return "", false
	}
	return payload.UserID, true
}
