package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
)

// ReadingHandler: reading status, welcome checklist, bank samples and the public list of banks (plan/27 §B, §C)
type ReadingHandler struct {
	svc port.ReadingService
}

// NewReadingHandler creates a new ReadingHandler instance
func NewReadingHandler(svc port.ReadingService) *ReadingHandler {
	return &ReadingHandler{svc: svc}
}

// Status is GET /email/status: per connection, last read, emails processed and transactions created (no content)
func (h *ReadingHandler) Status(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	status, err := h.svc.Status(ctx, *userID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, status)
}

// Onboarding is GET /onboarding/status: the four steps of the checklist with their real state
func (h *ReadingHandler) Onboarding(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	status, err := h.svc.Onboarding(ctx, *userID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, status)
}

type bankSampleRequest struct {
	BankID *uint64 `json:"bank_id"`
}

// BankSample is POST /banks/sample-request: where to forward a bank notification (the app never stores it)
func (h *ReadingHandler) BankSample(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	var req bankSampleRequest
	if ctx.Request.ContentLength > 0 {
		if err = ctx.ShouldBindJSON(&req); err != nil {
			validationError(ctx, err)
			return
		}
	}
	address, err := h.svc.RequestBankSample(ctx, *userID, req.BankID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, gin.H{"address": address})
}

// PublicBanks is GET /public/banks: names of the banks Topi reads (landing and the "no movements" notice)
func PublicBanks(ctx *gin.Context) {
	ctx.Header("Cache-Control", "public, max-age=3600")
	handleSuccess(ctx, gin.H{"banks": domain.SupportedBanks()})
}
