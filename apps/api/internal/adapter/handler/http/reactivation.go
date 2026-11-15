package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"

	"github.com/gin-gonic/gin"
)

// ReactivationHandler: personal reactivation from Usuarios → "Escribirle" (plan/27 §G). Admin only and audited.
// One user per request: there is no bulk route.
type ReactivationHandler struct {
	svc port.ReactivationService
}

// NewReactivationHandler creates a new ReactivationHandler instance
func NewReactivationHandler(svc port.ReactivationService) *ReactivationHandler {
	return &ReactivationHandler{svc: svc}
}

// View is GET /admin/users/:id/reactivation: allowed or why not, and the starting text
func (h *ReactivationHandler) View(ctx *gin.Context) {
	view, err := h.svc.View(ctx, ctx.Param("id"))
	respond(ctx, view, err)
}

// Preview is POST /admin/users/:id/reactivation/preview: the final email (only for the admin, nothing stored)
func (h *ReactivationHandler) Preview(ctx *gin.Context) {
	var draft domain.ReactivationDraft
	if err := ctx.ShouldBindJSON(&draft); err != nil {
		validationError(ctx, err)
		return
	}
	preview, err := h.svc.Preview(ctx, ctx.Param("id"), draft)
	respond(ctx, preview, err)
}

// Send is POST /admin/users/:id/reactivation
func (h *ReactivationHandler) Send(ctx *gin.Context) {
	var draft domain.ReactivationDraft
	if err := ctx.ShouldBindJSON(&draft); err != nil {
		validationError(ctx, err)
		return
	}
	respond(ctx, nil, h.svc.Send(ctx, adminID(ctx), ctx.Param("id"), draft))
}
