package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// EmailHandler represents the HTTP handler for email-related requests
type EmailHandler struct {
	svc port.EmailService
}

// NewEmailHandler creates a new EmailHandler instance
func NewEmailHandler(svc port.EmailService) *EmailHandler {
	return &EmailHandler{
		svc: svc,
	}
}

// GetAuthURLRequest represents the query parameters for getting authentication URL
type GetAuthURLRequest struct {
	Provider string `form:"provider" binding:"required,oneof=gmail outlook"`
}

// GetAuthURL godoc
//
//	@Summary		Get authentication URL for email provider
//	@Description	Returns the authentication URL for the specified email provider
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			provider	query		string	true	"Email provider (gmail or outlook)"
//	@Success		200			{object}	response{data=authURLResponse} "Success with auth URL"
//	@Failure		400			{object}	errorResponse	"Validation error"
//	@Failure		500			{object}	errorResponse	"Internal server error"
//	@Router			/email/auth-url [get]
func (eh *EmailHandler) GetAuthURL(ctx *gin.Context) {
	var req GetAuthURLRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	url, err := eh.svc.GetUserAuthURL(ctx, req.Provider)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAuthURLResponse(*url)

	handleSuccess(ctx, rsp)
}

// RegisterEmailRequest represents the JSON body for registering an email
type RegisterEmailRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Provider string `json:"provider" binding:"required,oneof=gmail outlook"`
}

// RegisterCodeRequest represents the query parameters for the authorization code
type RegisterCodeRequest struct {
	Code string `form:"code" binding:"required,min=50,max=1000"`
}

// RegisterEmail godoc
//
//	@Summary		Register a user's email
//	@Description	Register a new email for the authenticated user
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			code		query		string				                 true	"Authorization code"
//	@Param			request		body		response{data=RegisterEmailRequest}	 true	"Email registration details"
//	@Success		200			{object}	response{data=nil}	                        "Email registered successfully"
//	@Failure		400			{object}	errorResponse		                        "Validation error"
//	@Failure		401			{object}	errorResponse		                        "Unauthorized error"
//	@Failure		409			{object}	errorResponse		                        "Data conflict error"
//	@Failure		500			{object}	errorResponse		                        "Internal server error"
//	@Router			/email/register [post]
func (eh *EmailHandler) RegisterEmail(ctx *gin.Context) {
	var (
		codeReq  RegisterCodeRequest
		emailReq RegisterEmailRequest
	)

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	err = ctx.ShouldBindQuery(&codeReq)
	if err != nil {
		validationError(ctx, err)
		return
	}

	err = ctx.ShouldBindJSON(&emailReq)
	if err != nil {
		validationError(ctx, err)
		return
	}

	email := &domain.Email{
		UserID:   *userID,
		Code:     codeReq.Code,
		Email:    strings.ToLower(emailReq.Email),
		Provider: emailReq.Provider,
		Active:   true,
	}

	err = eh.svc.RegisterUserEmail(ctx, email)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

// GetEmailTokenRequest represents the URI parameters for getting an email token
type GetEmailTokenRequest struct {
	UserID string `uri:"user_id" binding:"required"`
	ID     uint64 `uri:"id" binding:"required"`
}

// GetEmailToken godoc
//
//	@Summary		Get email token
//	@Description	Retrieves the authentication token for a specific email
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			user_id		path		string		                      true	"User ID"
//	@Param			id			path		integer		                      true	"Email ID"
//	@Success		200			{object}	response{data=emailTokenResponse} "Success with email token"
//	@Failure		400			{object}	errorResponse	                  "Validation error"
//	@Failure		404			{object}	errorResponse                     "Data not found error"
//	@Failure		500			{object}	errorResponse	                  "Internal server error"
//	@Router			/email/{user_id}/{id} [get]
func (eh *EmailHandler) GetEmailToken(ctx *gin.Context) {
	var req GetEmailTokenRequest

	if err := ctx.ShouldBindUri(&req); err != nil {
		validationError(ctx, err)
		return
	}

	token, err := eh.svc.GetUserEmailToken(ctx, req.UserID, req.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newEmailTokenResponse(token)

	handleSuccess(ctx, rsp)
}

// GetListEmailRequest represents the query parameters for listing emails
type GetListEmailRequest struct {
	Skip  uint64 `form:"skip" binding:"omitempty,min=0" example:"0"`
	Limit uint64 `form:"limit" binding:"omitempty,min=5" example:"5"`
}

// GetListEmail godoc
//
//	@Summary		List user emails
//	@Description	Retrieves a list of emails for the authenticated user
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			skip	query		integer		false	"Number of records to skip"
//	@Param			limit	query		integer		false	"Maximum number of records to return"
//	@Success	    200	    {object}	response{data=emailListResponse}	"Success with list of emails"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/email/list [get]
func (eh *EmailHandler) GetListEmail(ctx *gin.Context) {
	var req GetListEmailRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	emails, err := eh.svc.ListUserEmails(ctx, *userID, req.Skip, req.Limit)
	if err != nil {
		handleError(ctx, err)
		return
	}

	emailsResponse := newEmailListResponse(emails, req.Limit, req.Skip)

	handleSuccess(ctx, emailsResponse)
}

// UpdateEmailRequest represents the JSON body for updating an email
type UpdateEmailRequest struct {
	Activate bool `json:"activate" binding:"omitempty"`
	Verify   bool `json:"verify" binding:"omitempty"`
}

// UpdateEmail GoDoc
//
//	@Summary		Update an email
//	@Description	Update email properties such as activation status
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			id			path		integer				true	"Email ID"
//	@Param			request		body		UpdateEmailRequest	true	"Email update details"
//	@Success		200			{object}	response{data=nil}	"Email updated successfully"
//	@Failure		400			{object}	errorResponse		"Validation error"
//	@Failure		401			{object}	errorResponse		"Unauthorized error"
//	@Failure		404			{object}	errorResponse		"Data not found error"
//	@Failure		500			{object}	errorResponse		"Internal server error"
//	@Router			/email/{id} [patch]
func (eh *EmailHandler) UpdateEmail(ctx *gin.Context) {
	var req UpdateEmailRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		validationError(ctx, err)
		return
	}

	email := &domain.Email{
		UserID: *userID,
		ID:     &id,
		Active: req.Activate,
		Verify: req.Verify,
	}

	err = eh.svc.UpdateUserEmail(ctx, email)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

// DeleteEmail godoc
//
//	@Summary		Delete an email
//	@Description	Delete an email and update any accounts that use this email
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			id			path		integer				true	"Email ID"
//	@Success		200			{object}	response{data=nil}	"Email deleted successfully"
//	@Failure		400			{object}	errorResponse		"Validation error"
//	@Failure		401			{object}	errorResponse		"Unauthorized error"
//	@Failure		404			{object}	errorResponse		"Data not found error"
//	@Failure		500			{object}	errorResponse		"Internal server error"
//	@Router			/email/{id} [delete]
func (eh *EmailHandler) DeleteEmail(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		validationError(ctx, err)
		return
	}

	err = eh.svc.DeleteEmail(ctx, *userID, id)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

// SaveEmailErrorRequest represents the JSON body for saving an email error
type SaveEmailErrorRequest struct {
	Error string `json:"error" binding:"required" example:"authorization_failed"`
}

// SaveEmailError GoDoc
//
//	@Summary		Save email error (Admin only)
//	@Description	Save an error message for a specific email (admin endpoint)
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			id			path		integer				    true	"Email ID"
//	@Param			request		body		SaveEmailErrorRequest	true	"Email error details"
//	@Success		200			{object}	response{data=nil}		"Email error saved successfully"
//	@Failure		400			{object}	errorResponse			"Validation error"
//	@Failure		401			{object}	errorResponse			"Unauthorized error"
//	@Failure		403			{object}	errorResponse			"Forbidden error"
//	@Failure		404			{object}	errorResponse			"Data not found error"
//	@Failure		500			{object}	errorResponse			"Internal server error"
//	@Router			/email/admin/error [put]
func (eh *EmailHandler) SaveEmailError(ctx *gin.Context) {
	var req SaveEmailErrorRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		validationError(ctx, err)
		return
	}

	err = eh.svc.SaveEmailError(ctx, id, strings.ToLower(req.Error))
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

type ReadEmailRequest struct {
	AccountIDs []uint64 `json:"account_ids" binding:"required"`
}

// ReadEmail godoc
//
//	@Summary		Read email for accounts (async)
//	@Description	Initiates background email reading for the specified accounts by enqueueing jobs in email_jobs (processed by the worker). Returns immediately after validation without waiting for email processing.
//	@Tags			Emails
//	@Accept			json
//	@Produce		json
//	@Param			request		body		ReadEmailRequest	true	"Account IDs"
//	@Success		200			{object}	response{data=nil}	"Email reading process started successfully"
//	@Failure		400			{object}	errorResponse		"Validation error"
//	@Failure		401			{object}	errorResponse		"Unauthorized error"
//	@Failure		500			{object}	errorResponse		"Internal server error"
//	@Router			/email/read/ [post]
func (eh *EmailHandler) ReadEmail(ctx *gin.Context) {
	var req ReadEmailRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	rsp, err := eh.svc.ReadEmail(ctx, *userID, req.AccountIDs)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, rsp)
}
