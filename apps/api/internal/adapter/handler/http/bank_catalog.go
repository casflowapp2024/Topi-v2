package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// BankCatalogHandler: panel → Bancos (plan/33) and the public logo of each catalog bank
type BankCatalogHandler struct {
	svc port.BankCatalogService
}

func NewBankCatalogHandler(svc port.BankCatalogService) *BankCatalogHandler {
	return &BankCatalogHandler{svc: svc}
}

type catalogActiveRequest struct {
	Active *bool `json:"active" binding:"required"`
}

type catalogSenderRequest struct {
	Email string  `json:"email" binding:"required"`
	Note  *string `json:"note"`
}

type catalogSenderUpdateRequest struct {
	Active *bool   `json:"active" binding:"required"`
	Note   *string `json:"note"`
}

func pathID(ctx *gin.Context, name string) (uint64, bool) {
	id, err := strconv.ParseUint(ctx.Param(name), 10, 64)
	if err != nil || id == 0 {
		handleError(ctx, domain.ErrDataNotFound)
		return 0, false
	}
	return id, true
}

// List is GET /admin/banks: the catalog with usage and the health of each sender (last 30 days)
func (h *BankCatalogHandler) List(ctx *gin.Context) {
	banks, err := h.svc.AdminList(ctx)
	respond(ctx, gin.H{"banks": banks}, err)
}

// Create is POST /admin/banks {name, slug?, country?, color?}
func (h *BankCatalogHandler) Create(ctx *gin.Context) {
	var in domain.CatalogBankInput
	if err := ctx.ShouldBindJSON(&in); err != nil {
		validationError(ctx, err)
		return
	}
	bank, err := h.svc.Create(ctx, in)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleCreatedSuccess(ctx, bank)
}

// Update is PUT /admin/banks/:id {name, slug, country, color}
func (h *BankCatalogHandler) Update(ctx *gin.Context) {
	id, ok := pathID(ctx, "id")
	if !ok {
		return
	}
	var in domain.CatalogBankInput
	if err := ctx.ShouldBindJSON(&in); err != nil {
		validationError(ctx, err)
		return
	}
	respond(ctx, nil, h.svc.Update(ctx, id, in))
}

// SetActive is POST /admin/banks/:id/active {active}
func (h *BankCatalogHandler) SetActive(ctx *gin.Context) {
	id, ok := pathID(ctx, "id")
	if !ok {
		return
	}
	var req catalogActiveRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	respond(ctx, nil, h.svc.SetActive(ctx, id, *req.Active))
}

// AddSender is POST /admin/banks/:id/senders {email, note}: also "Agregar al catálogo" of a user sender
func (h *BankCatalogHandler) AddSender(ctx *gin.Context) {
	id, ok := pathID(ctx, "id")
	if !ok {
		return
	}
	var req catalogSenderRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	sender, err := h.svc.AddSender(ctx, id, req.Email, req.Note)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleCreatedSuccess(ctx, sender)
}

// UpdateSender is PUT /admin/banks/:id/senders/:senderId {active, note}. Senders are never deleted: a stale copy in
// banks.email would come back as a sender of the user
func (h *BankCatalogHandler) UpdateSender(ctx *gin.Context) {
	id, ok := pathID(ctx, "id")
	if !ok {
		return
	}
	senderID, ok := pathID(ctx, "senderId")
	if !ok {
		return
	}
	var req catalogSenderUpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	respond(ctx, nil, h.svc.UpdateSender(ctx, id, senderID, *req.Active, req.Note))
}

// PutLogo is PUT /admin/banks/:id/logo (multipart, field "logo"; PNG, WebP or SVG of up to 100 KB, read from bytes)
func (h *BankCatalogHandler) PutLogo(ctx *gin.Context) {
	id, ok := pathID(ctx, "id")
	if !ok {
		return
	}
	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, domain.MaxBankLogoBytes+64*1024)
	file, _, err := ctx.Request.FormFile("logo")
	if err != nil {
		handleError(ctx, domain.ErrInvalidBankLogo)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, domain.MaxBankLogoBytes+1))
	if err != nil {
		handleError(ctx, domain.ErrInvalidBankLogo)
		return
	}
	respond(ctx, nil, h.svc.PutLogo(ctx, id, data))
}

// DeleteLogo is DELETE /admin/banks/:id/logo
func (h *BankCatalogHandler) DeleteLogo(ctx *gin.Context) {
	id, ok := pathID(ctx, "id")
	if !ok {
		return
	}
	respond(ctx, nil, h.svc.DeleteLogo(ctx, id))
}

// UserSenders is GET /admin/banks/user-senders: addresses users typed that the catalog does not have. Grouped,
// never with the user; personal domains masked below domain.MinGroupUsers users
func (h *BankCatalogHandler) UserSenders(ctx *gin.Context) {
	senders, err := h.svc.UserSenders(ctx)
	respond(ctx, gin.H{"senders": senders, "min_users": domain.MinGroupUsers}, err)
}

// Logo is GET /banks/catalog/:id/logo, public (an <img> sends no token). Long cache: the URL carries ?v=<etag>
func (h *BankCatalogHandler) Logo(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.Status(http.StatusNotFound)
		return
	}
	logo, err := h.svc.GetLogo(ctx, id)
	if err != nil {
		if errors.Is(err, domain.ErrDataNotFound) {
			ctx.Status(http.StatusNotFound)
			return
		}
		ctx.Status(http.StatusInternalServerError)
		return
	}
	etag := `"` + logo.ETag + `"`
	header := ctx.Writer.Header()
	header.Set("ETag", etag)
	header.Set("Cache-Control", "public, max-age=86400")
	header.Set("X-Content-Type-Options", "nosniff")
	// an SVG opened on its own cannot run scripts nor load anything
	header.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	header.Set("Cross-Origin-Resource-Policy", "cross-origin")
	if match := ctx.GetHeader("If-None-Match"); match != "" && strings.Contains(match, etag) {
		ctx.Status(http.StatusNotModified)
		return
	}
	ctx.Data(http.StatusOK, logo.ContentType, logo.Bytes)
}

// BankCatalogRoutes: the admin section (admin + audited) and the public logo
func (r *Routes) BankCatalogRoutes() {
	if r.BankCatalogHandler == nil {
		return
	}
	r.Router.GET("/banks/catalog/:id/logo", r.BankCatalogHandler.Logo)
	if r.AdminHandler == nil {
		return
	}
	admin := r.Router.Group("/admin").Use(r.auth(), AdminMiddleware(), AdminAuditMiddleware(r.AdminHandler.svc))
	{
		admin.GET("/banks", r.BankCatalogHandler.List)
		admin.GET("/banks/user-senders", r.BankCatalogHandler.UserSenders)
		admin.POST("/banks", r.BankCatalogHandler.Create)
		admin.PUT("/banks/:id", r.BankCatalogHandler.Update)
		admin.POST("/banks/:id/active", r.BankCatalogHandler.SetActive)
		admin.POST("/banks/:id/senders", r.BankCatalogHandler.AddSender)
		admin.PUT("/banks/:id/senders/:senderId", r.BankCatalogHandler.UpdateSender)
		admin.PUT("/banks/:id/logo", r.BankCatalogHandler.PutLogo)
		admin.DELETE("/banks/:id/logo", r.BankCatalogHandler.DeleteLogo)
	}
}
