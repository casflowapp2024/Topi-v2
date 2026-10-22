package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// healthTimeout bounds the database checks so /health answers even if Postgres hangs
const healthTimeout = 3 * time.Second

type HealthHandler struct {
	svc port.HealthService
}

func NewHealthHandler(svc port.HealthService) *HealthHandler {
	return &HealthHandler{svc: svc}
}

func (hh *HealthHandler) CheckHealth(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"status": "healthy",
	})
}

// Health godoc
//
//	@Summary		Health for monitoring
//	@Description	Database and worker heartbeat. 200 while the database answers (also when the worker is stale); 503 if it does not.
//	@Tags			Health
//	@Produce		json
//	@Success		200	{object}	domain.Health
//	@Failure		503	{object}	domain.Health
//	@Router			/health [get]
func (hh *HealthHandler) Health(ctx *gin.Context) {
	checkCtx, cancel := context.WithTimeout(ctx.Request.Context(), healthTimeout)
	defer cancel()

	health := hh.svc.Check(checkCtx)
	status := http.StatusOK
	if health.DB != domain.HealthOK {
		status = http.StatusServiceUnavailable
	}
	ctx.JSON(status, health)
}
