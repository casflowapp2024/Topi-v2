package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"

	"github.com/gin-gonic/gin"
)

// LaunchHandler: panel → Lanzamiento (plan/27 §I). Admin only and audited.
type LaunchHandler struct {
	svc port.LaunchService
}

// NewLaunchHandler creates a new LaunchHandler instance
func NewLaunchHandler(svc port.LaunchService) *LaunchHandler {
	return &LaunchHandler{svc: svc}
}

// Report is GET /admin/launch
func (h *LaunchHandler) Report(ctx *gin.Context) {
	report, err := h.svc.Report(ctx)
	respond(ctx, report, err)
}

type launchStageRequest struct {
	StartedAt string `json:"started_at" binding:"required"`
	Note      string `json:"note"`
}

// SetStage is PUT /admin/launch/stages/:stage
func (h *LaunchHandler) SetStage(ctx *gin.Context) {
	var req launchStageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	respond(ctx, nil, h.svc.SetStage(ctx, adminID(ctx), domain.LaunchStage{
		Stage: ctx.Param("stage"), StartedAt: req.StartedAt, Note: req.Note,
	}))
}
