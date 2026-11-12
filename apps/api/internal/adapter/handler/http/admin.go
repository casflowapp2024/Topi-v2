package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AdminHandler serves the admin panel (plan/25-admin-metricas.md). Every route goes behind AuthMiddleware,
// AdminMiddleware and AdminAuditMiddleware.
type AdminHandler struct {
	svc      port.AdminService
	founders port.FounderService
}

// NewAdminHandler creates a new AdminHandler instance
func NewAdminHandler(svc port.AdminService, founders port.FounderService) *AdminHandler {
	return &AdminHandler{svc: svc, founders: founders}
}

// AdminAuditMiddleware records every access to the panel (admin, route, query). Without the audit row the
// access is refused: nothing in the panel is seen without leaving a trace.
func AdminAuditMiddleware(svc port.AdminService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
		if err != nil {
			handleAbort(ctx, err)
			return
		}
		detail := map[string]any{"method": ctx.Request.Method}
		if query := ctx.Request.URL.RawQuery; query != "" && len(query) <= 200 {
			detail["query"] = query
		}
		if err = svc.Audit(ctx.Request.Context(), domain.AdminAudit{
			AdminID: payload.UserID, Action: domain.AdminActionView, Target: ctx.FullPath(), Detail: detail,
		}); err != nil {
			handleAbort(ctx, domain.ErrInternal)
			return
		}
		ctx.Next()
	}
}

func adminID(ctx *gin.Context) string {
	payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		return ""
	}
	return payload.UserID
}

// Summary godoc
//
//	@Summary	Admin: North Star, active users, signups and metric tree
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=domain.AdminSummary}
//	@Failure	403	{object}	errorResponse	"Not an admin"
//	@Router		/admin/metrics/summary [get]
//	@Security	BearerAuth
func (h *AdminHandler) Summary(ctx *gin.Context) {
	result, err := h.svc.Summary(ctx)
	respond(ctx, result, err)
}

// Activation godoc
//
//	@Summary	Admin: activation of the new users (30, 90 and 365 days)
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=[]domain.ActivationRates}
//	@Router		/admin/metrics/activation [get]
//	@Security	BearerAuth
func (h *AdminHandler) Activation(ctx *gin.Context) {
	result, err := h.svc.Activation(ctx)
	respond(ctx, result, err)
}

// Cohorts godoc
//
//	@Summary	Admin: weekly cohorts over "al día" (S1, S4, S12)
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=[]domain.Cohort}
//	@Router		/admin/metrics/cohorts [get]
//	@Security	BearerAuth
func (h *AdminHandler) Cohorts(ctx *gin.Context) {
	result, err := h.svc.Cohorts(ctx)
	respond(ctx, result, err)
}

// Reading godoc
//
//	@Summary	Admin: health of the email reader
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=domain.ReadingHealth}
//	@Router		/admin/metrics/reading [get]
//	@Security	BearerAuth
func (h *AdminHandler) Reading(ctx *gin.Context) {
	result, err := h.svc.Reading(ctx)
	respond(ctx, result, err)
}

// Quality godoc
//
//	@Summary	Admin: corrections, verifications and Por revisar (30 days)
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=domain.QualityReport}
//	@Router		/admin/metrics/quality [get]
//	@Security	BearerAuth
func (h *AdminHandler) Quality(ctx *gin.Context) {
	result, err := h.svc.Quality(ctx)
	respond(ctx, result, err)
}

// Catalog godoc
//
//	@Summary	Admin: categories, accounts and budgets (names with k >= 5 users)
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=domain.Catalog}
//	@Router		/admin/metrics/catalog [get]
//	@Security	BearerAuth
func (h *AdminHandler) Catalog(ctx *gin.Context) {
	result, err := h.svc.Catalog(ctx)
	respond(ctx, result, err)
}

// Costs godoc
//
//	@Summary	Admin: tokens and cost of the model, mail vs quota
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=domain.CostReport}
//	@Router		/admin/metrics/costs [get]
//	@Security	BearerAuth
func (h *AdminHandler) Costs(ctx *gin.Context) {
	result, err := h.svc.Costs(ctx)
	respond(ctx, result, err)
}

// Users godoc
//
//	@Summary	Admin: users table (no amounts, no transactions)
//	@Tags		Admin
//	@Produce	json
//	@Param		segment	query	string	false	"active7|active30|active90|inactive90|no_connection|broken"
//	@Param		q		query	string	false	"Search by name or email"
//	@Param		limit	query	int		false	"Page size (max 200)"
//	@Param		offset	query	int		false	"Offset"
//	@Success	200	{object}	response{data=domain.AdminUserPage}
//	@Router		/admin/users [get]
//	@Security	BearerAuth
func (h *AdminHandler) Users(ctx *gin.Context) {
	limit, _ := strconv.ParseUint(ctx.Query("limit"), 10, 64)
	offset, _ := strconv.ParseUint(ctx.Query("offset"), 10, 64)
	result, err := h.svc.Users(ctx, domain.AdminUserFilter{
		Segment: ctx.Query("segment"), Search: ctx.Query("q"), Limit: limit, Offset: offset,
	})
	respond(ctx, result, err)
}

// Refresh godoc
//
//	@Summary	Admin: recompute the precomputed metrics (last 7 days; full=true all history)
//	@Tags		Admin
//	@Produce	json
//	@Param		full	query	bool	false	"Recompute all history"
//	@Success	200	{object}	response{data=map[string]int}
//	@Router		/admin/metrics/refresh [post]
//	@Security	BearerAuth
func (h *AdminHandler) Refresh(ctx *gin.Context) {
	rows, err := h.svc.Refresh(ctx, adminID(ctx), ctx.Query("full") == "true")
	respond(ctx, map[string]int{"rows": rows}, err)
}

func respond(ctx *gin.Context, data any, err error) {
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, data)
}

// Founders godoc
//
//	@Summary	Admin: founder eligible users, active in 90 days and without activity
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{object}	response{data=domain.FounderList}
//	@Router		/admin/founders [get]
//	@Security	BearerAuth
func (h *AdminHandler) Founders(ctx *gin.Context) {
	result, err := h.founders.List(ctx)
	respond(ctx, result, err)
}

// ConfirmActiveFounders godoc
//
//	@Summary	Admin: confirm every active eligible user (dry_run=true only returns the summary)
//	@Tags		Admin
//	@Produce	json
//	@Param		dry_run	query	bool	false	"Preview without changing anything"
//	@Success	200	{object}	response{data=domain.FounderBulkResult}
//	@Router		/admin/founders/confirm-active [post]
//	@Security	BearerAuth
func (h *AdminHandler) ConfirmActiveFounders(ctx *gin.Context) {
	result, err := h.founders.ConfirmActive(ctx, adminID(ctx), ctx.Query("dry_run") == "true")
	respond(ctx, result, err)
}

// ConfirmFounder godoc
//
//	@Summary	Admin: confirm one eligible user as founder
//	@Tags		Admin
//	@Param		id	path	string	true	"User id"
//	@Success	200	{object}	response
//	@Failure	400	{object}	errorResponse	"Not eligible"
//	@Router		/admin/founders/{id}/confirm [post]
//	@Security	BearerAuth
func (h *AdminHandler) ConfirmFounder(ctx *gin.Context) {
	respond(ctx, nil, h.founders.Confirm(ctx, adminID(ctx), ctx.Param("id")))
}

// UnconfirmFounder godoc
//
//	@Summary	Admin: remove the founder confirmation of one user (the user and its data stay)
//	@Tags		Admin
//	@Param		id	path	string	true	"User id"
//	@Success	200	{object}	response
//	@Router		/admin/founders/{id}/confirm [delete]
//	@Security	BearerAuth
func (h *AdminHandler) UnconfirmFounder(ctx *gin.Context) {
	respond(ctx, nil, h.founders.Unconfirm(ctx, adminID(ctx), ctx.Param("id")))
}
