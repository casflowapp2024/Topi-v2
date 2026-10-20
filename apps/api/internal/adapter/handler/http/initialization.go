package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
)

type InitializationHandler struct {
	svc port.CategoryService
}

func NewInitializationHandler(svc port.CategoryService) *InitializationHandler {
	return &InitializationHandler{
		svc: svc,
	}
}

func (ih *InitializationHandler) InitializeResources(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	err = ih.svc.CreateCategories(ctx, domain.DefaultCategories(*userID))
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}
