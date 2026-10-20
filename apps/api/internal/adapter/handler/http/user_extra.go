package http

import (
	"encoding/json"

	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
)

// UserExtraHandler represents the HTTP handler for user extra information requests
type UserExtraHandler struct {
	svc port.UserExtraService
}

// NewUserExtraHandler creates a new UserExtraHandler instance
func NewUserExtraHandler(svc port.UserExtraService) *UserExtraHandler {
	return &UserExtraHandler{svc}
}

// userExtraRequest represents the request body for creating or updating user extra information
type userExtraRequest struct {
	UTCOffset           int16           `json:"utc_offset" binding:"utc_offset" example:"-5"`
	Whatsapp            string          `json:"whatsapp" binding:"omitempty,min=8,max=20" example:"+1234567890"`
	OnboardingCompleted bool            `json:"onboarding_completed" binding:"omitempty" example:"true"`
	ReadEmail           bool            `json:"read_email" binding:"omitempty" example:"false"`
	Config              json.RawMessage `json:"config" binding:"omitempty" example:"{\"theme\":\"dark\"}"`
}

// CreateUserExtra godoc
//
//	@Summary		Create user extra information
//	@Description	Create user extra information for the authenticated user
//	@Tags			UserExtra
//	@Accept			json
//	@Produce		json
//	@Param			userExtraRequest	body		userExtraRequest	true	"User extra information request"
//	@Success		201					{object}	response			"User extra information created"
//	@Failure		400					{object}	errorResponse		"Validation error"
//	@Failure		401					{object}	errorResponse		"Unauthorized error"
//	@Failure		409					{object}	errorResponse		"Data conflict error"
//	@Failure		500					{object}	errorResponse		"Internal server error"
//	@Router			/user-extra [post]
//	@Security		BearerAuth
func (uh *UserExtraHandler) CreateUserExtra(ctx *gin.Context) {
	var req userExtraRequest

	payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	offset, ok := enums.OffsetToZone[req.UTCOffset]
	if !ok {
		handleError(ctx, domain.ErrInvalidUTCOffset)
		return
	}

	userExtra := &domain.UserExtra{
		UserID:              payload.UserID,
		Name:                payload.Name,
		LastName:            payload.LastName,
		Email:               payload.Email,
		UTCOffset:           offset,
		Whatsapp:            req.Whatsapp,
		OnboardingCompleted: req.OnboardingCompleted,
		ReadEmail:           req.ReadEmail,
		Config:              req.Config,
	}

	err = uh.svc.Create(ctx, userExtra)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newUserExtraResponse(userExtra)

	handleCreatedSuccess(ctx, rsp)
}

// GetUserExtra godoc
//
//	@Summary		Get user extra information
//	@Description	Get user extra information for the authenticated user
//	@Tags			UserExtra
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	userExtraResponse	"User extra information"
//	@Failure		400	{object}	errorResponse		"Validation error"
//	@Failure		401	{object}	errorResponse		"Unauthorized error"
//	@Failure		404	{object}	errorResponse		"Data not found error"
//	@Failure		500	{object}	errorResponse		"Internal server error"
//	@Router			/user-extra [get]
//	@Security		BearerAuth
func (uh *UserExtraHandler) GetUserExtra(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	userExtra, err := uh.svc.Get(ctx, *userID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newUserExtraResponse(userExtra)

	handleSuccess(ctx, rsp)
}

// updateUserExtraRequest represents the request body for updating user extra information
type updateUserExtraRequest struct {
	UTCOffset           int16           `json:"utc_offset" binding:"utc_offset" example:"-5"`
	Whatsapp            string          `json:"whatsapp" binding:"omitempty" example:"+1234567890"`
	OnboardingCompleted bool            `json:"onboarding_completed" binding:"omitempty" example:"true"`
	ReadEmail           bool            `json:"read_email" binding:"omitempty" example:"false"`
	Config              json.RawMessage `json:"config" binding:"omitempty" example:"{\"theme\":\"dark\"}"`
}

// UpdateUserExtra godoc
//
//	@Summary		Update user extra information
//	@Description	Update user extra information for the authenticated user
//	@Tags			UserExtra
//	@Accept			json
//	@Produce		json
//	@Param			userExtraRequest	body		updateUserExtraRequest	true	"User extra information request"
//	@Success		200					{object}	response			"User extra information updated"
//	@Failure		400					{object}	errorResponse		"Validation error"
//	@Failure		401					{object}	errorResponse		"Unauthorized error"
//	@Failure		404					{object}	errorResponse		"Data not found error"
//	@Failure		500					{object}	errorResponse		"Internal server error"
//	@Router			/user-extra [put]
//	@Security		BearerAuth
func (uh *UserExtraHandler) UpdateUserExtra(ctx *gin.Context) {
	var req updateUserExtraRequest

	payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	offset, ok := enums.OffsetToZone[req.UTCOffset]
	if !ok {
		handleError(ctx, domain.ErrInvalidUTCOffset)
		return
	}

	userExtra := &domain.UserExtra{
		UserID:              payload.UserID,
		Name:                payload.Name,
		LastName:            payload.LastName,
		Email:               payload.Email,
		UTCOffset:           offset,
		Whatsapp:            req.Whatsapp,
		OnboardingCompleted: req.OnboardingCompleted,
		ReadEmail:           req.ReadEmail,
		Config:              req.Config,
	}

	err = uh.svc.Update(ctx, userExtra)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newUserExtraResponse(userExtra)

	handleSuccess(ctx, rsp)
}

type deleteUserExtraRequest struct {
	ID uint64 `uri:"id" binding:"required" example:"1"`
}

// DeleteUserExtra godoc
//
//	@Summary		Delete user extra information
//	@Description	Delete user extra information for the authenticated user
//	@Tags			UserExtra
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	response		"User extra information deleted"
//	@Failure		400	{object}	errorResponse	"Validation error"
//	@Failure		401	{object}	errorResponse	"Unauthorized error"
//	@Failure		404	{object}	errorResponse	"Data not found error"
//	@Failure		500	{object}	errorResponse	"Internal server error"
//	@Router			/user-extra [delete]
//	@Security		BearerAuth
func (uh *UserExtraHandler) DeleteUserExtra(ctx *gin.Context) {
	var req deleteUserExtraRequest

	if err := ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err := uh.svc.Delete(ctx, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

type adminUpdateReadEmailRequest struct {
	UserID string `json:"user_id" binding:"required" example:"user-123"`
	Read   bool   `json:"read" binding:"omitempty" example:"true"`
}

// AdminUpdateReadEmail godoc
//
//	@Summary		Admin update read email status
//	@Description	Admin endpoint to update the read_email field for a specific user extra record
//	@Tags			UserExtra
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"User ID"
//	@Param			read	path		bool			true	"Read Email Status"
//	@Success		200		{object}	response		"Read email status updated successfully"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		404		{object}	errorResponse	"Data not found error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/user-extra/admin/read-email/{id}/{read} [put]
//	@Security		BearerAuth
func (uh *UserExtraHandler) AdminUpdateReadEmail(ctx *gin.Context) {
	var req adminUpdateReadEmailRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err := uh.svc.UpdateReadEmail(ctx, req.UserID, req.Read)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}
