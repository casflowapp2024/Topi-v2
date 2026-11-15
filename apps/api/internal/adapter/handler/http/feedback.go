package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"strconv"

	"github.com/gin-gonic/gin"
)

// FeedbackHandler: "¿Qué le falta a Topi?" (plan/27 §E)
type FeedbackHandler struct {
	svc port.FeedbackService
}

// NewFeedbackHandler creates a new FeedbackHandler instance
func NewFeedbackHandler(svc port.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{svc: svc}
}

type feedbackRequest struct {
	Text       string `json:"text" binding:"required"`
	ContactOK  bool   `json:"contact_ok"`
	AppVersion string `json:"app_version"`
}

// Submit is POST /feedback (max 500 characters, 3 per day)
func (h *FeedbackHandler) Submit(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	var req feedbackRequest
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	respond(ctx, nil, h.svc.Submit(ctx, *userID, domain.Feedback{Text: req.Text, ContactOK: req.ContactOK, AppVersion: req.AppVersion}))
}

// AdminList is GET /admin/feedback?unread=true (audited by AdminAuditMiddleware)
func (h *FeedbackHandler) AdminList(ctx *gin.Context) {
	page, err := h.svc.List(ctx, ctx.Query("unread") == "true")
	respond(ctx, page, err)
}

// AdminMarkRead is POST /admin/feedback/:id/read
func (h *FeedbackHandler) AdminMarkRead(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		handleError(ctx, domain.ErrDataNotFound)
		return
	}
	respond(ctx, nil, h.svc.MarkRead(ctx, adminID(ctx), id))
}
