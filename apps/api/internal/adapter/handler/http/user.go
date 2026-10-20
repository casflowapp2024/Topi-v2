package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
)

// UserHandler represents the HTTP handler for user-related requests
type UserHandler struct {
	svc port.UserService
}

// NewUserHandler creates a new UserHandler instance
func NewUserHandler(svc port.UserService) *UserHandler {
	return &UserHandler{svc}
}

// registerRequest represents the request body for creating a user
type registerRequest struct {
	Name            string `json:"name" binding:"required,max=30" example:"John"`
	LastName        string `json:"last_name" binding:"required,max=30" example:"Doe"`
	Email           string `json:"email" binding:"required,email,max=30" example:"test@example.com"`
	Password        string `json:"password" binding:"required,min=8,max=40" example:"12345678"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8,max=40" example:"12345678"`
}

// Register godoc
//
//	@Summary		Register a new user
//	@Description	Creates a new user account with the provided information
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			registerRequest	body		registerRequest	true "Register request"
//	@Success		200				{object}	response             "User created"
//	@Failure		400				{object}	errorResponse	     "Validation error"
//	@Failure		401				{object}	errorResponse	     "Unauthorized error"
//	@Failure		404				{object}	errorResponse	     "Data not found error"
//	@Failure		409				{object}	errorResponse	     "Data conflict error"
//	@Failure		500				{object}	errorResponse	     "Internal server error"
//	@Router			/signup [post]
func (uh *UserHandler) Register(ctx *gin.Context) {
	var req registerRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err := domain.ConfirmPassword(req.Password, req.ConfirmPassword); err != nil {
		validationError(ctx, err)
		return
	}

	authUser := domain.User{
		Name:     req.Name,
		LastName: req.LastName,
		Email:    req.Email,
		Password: req.Password,
	}

	err := uh.svc.Register(ctx, &authUser)
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, authUser.Email, nil)

	rsp := newCreatedResponse()

	handleCreatedSuccess(ctx, rsp)
}

// confirmUserAccountRequest represents the request for confirming a user account
type confirmUserAccountRequest struct {
	Email string `json:"email" binding:"required,email" example:"joe@example.com"`
	Code  string `json:"code" binding:"required,min=6" example:"123456"`
}

// ConfirmUser godoc
//
//	@Summary		Confirm a user account
//	@Description	Confirm a user account using email and verification code
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			confirmUserAccountRequest	body	confirmUserAccountRequest	true	"Email and confirmation code"
//	@Success		200		{object}	response	    "User confirmed"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		404		{object}	errorResponse	"Data not found error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/users/confirm [post]
func (uh *UserHandler) ConfirmUser(ctx *gin.Context) {
	var req confirmUserAccountRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err := uh.svc.ConfirmUser(ctx, req.Email, req.Code)
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, req.Email, nil)

	handleCustomSuccess(ctx, enums.ConfirmedUser)
}

// GetSocialAuthURL godoc
//
//	@Summary		Get social authentication URL
//	@Description	Retrieves a URL for third-party social authentication
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			platform	path		string	false	"Platform type (e.g., 'mobile')"
//	@Success		200			{object}	response	"Authentication URL retrieved successfully"
//	@Failure		400			{object}	errorResponse	"Bad request error"
//	@Failure		401			{object}	errorResponse	"Unauthorized error"
//	@Failure		500			{object}	errorResponse	"Internal server error"
//	@Router			/users/social-auth-url [get]
//	@Router			/users/social-auth-url/{platform} [get]
func (uh *UserHandler) GetSocialAuthURL(ctx *gin.Context) {
	// Extract optional platform parameter from URL path
	platform := ctx.Param("platform")

	authURL, err := uh.svc.GetSocialAuthURL(ctx, platform)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAuthURLResponse(*authURL)

	handleSuccess(ctx, rsp)
}

// loginRequest represents the request body for logging in a user
type loginRequest struct {
	Email    string `json:"email" binding:"omitempty,email" example:"test@example.com"`
	Password string `json:"password" binding:"omitempty,min=8" example:"12345678" minLength:"8"`
	Code     string `json:"code" binding:"omitempty,min=6" example:"123456"`
}

// Login godoc
//
//	@Summary		Login and get an access token
//	@Description	Logs in a registered user and returns an access token if the credentials are valid
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			loginRequest	body		loginRequest	true	"Login credentials"
//	@Success		200		{object}	authResponse	"Successfully logged in"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		401		{object}	errorResponse	"Unauthorized error"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/users/login [post]
func (uh *UserHandler) Login(ctx *gin.Context) {
	var req loginRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	token, err := uh.svc.Login(ctx, req.Email, req.Password, req.Code)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newAuthResponse(token)

	logRequestMetric(ctx, req.Email, nil)

	handleSuccess(ctx, rsp)
}

// GetUser godoc
//
//	@Summary		Get current user information
//	@Description	Retrieves information about the currently authenticated user
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	response{data=userResponse}	"User details retrieved successfully"
//	@Failure		401	{object}	errorResponse	            "Unauthorized error"
//	@Failure		404	{object}	errorResponse	            "User not found"
//	@Failure		500	{object}	errorResponse	            "Internal server error"
//	@Router			/users/ [get]
//	@Security		BearerAuth
func (uh *UserHandler) GetUser(ctx *gin.Context) {
	user, err := uh.svc.GetUser(ctx)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newUserResponse(user)

	handleSuccess(ctx, rsp)
}

// updateUserRequest represents the request body for updating a user
type updateUserRequest struct {
	Name     string `json:"name" binding:"omitempty,required" example:"John"`
	LastName string `json:"last_name" binding:"omitempty,required" example:"Doe"`
}

// UpdateUser godoc
//
//	@Summary		Update user profile
//	@Description	Update the currently authenticated user's profile information
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			updateUserRequest	body		updateUserRequest	true	"User profile information to update"
//	@Success		200					{object}	userResponse		"User updated successfully"
//	@Failure		400					{object}	errorResponse		"Validation error"
//	@Failure		401					{object}	errorResponse		"Unauthorized error"
//	@Failure		404					{object}	errorResponse		"User not found"
//	@Failure		500					{object}	errorResponse		"Internal server error"
//	@Router			/users/ [put]
//	@Security		BearerAuth
func (uh *UserHandler) UpdateUser(ctx *gin.Context) {
	var req updateUserRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	user := domain.User{
		Name:     req.Name,
		LastName: req.LastName,
	}

	updatedUser, err := uh.svc.UpdateUser(ctx, user)
	if err != nil {
		handleError(ctx, err)
		return
	}

	rsp := newUserResponse(updatedUser)

	handleSuccess(ctx, rsp)
}

// resendConfirmationRequest represents the request for resending a confirmation code
type resendConfirmationRequest struct {
	Email string `json:"email" binding:"required,email" example:"joe@example.com"`
}

// ResendConfirmationCode godoc
//
//	@Summary		Resend confirmation code
//	@Description	Resend account verification code to the user's email
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			resendConfirmationRequest	body	resendConfirmationRequest	true	"Email address"
//	@Success		200		{object}	response	    "Confirmation code resent"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		404		{object}	errorResponse	"User not found"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/users/resend-confirmation [post]
func (uh *UserHandler) ResendConfirmationCode(ctx *gin.Context) {
	var req resendConfirmationRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	err := uh.svc.ResendConfirmationCode(ctx, req.Email)
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, req.Email, nil)

	handleCustomSuccess(ctx, enums.ResentConfirmationCode)
}

type forgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email" example:"test@example.com"`
}

// ForgotPassword godoc
//
//	@Summary		Request password reset
//	@Description	Send a password reset code to the user's email address
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			forgotPasswordRequest	body	forgotPasswordRequest	true	"User email"
//	@Success		200		{object}	response	    "Password reset code sent"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		404		{object}	errorResponse	"User not found"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/users/forgot-password [post]
func (uh *UserHandler) ForgotPassword(ctx *gin.Context) {
	var request forgotPasswordRequest

	if err := ctx.ShouldBindJSON(&request); err != nil {
		validationError(ctx, err)
		return
	}

	err := uh.svc.ForgotPassword(ctx, request.Email)
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, request.Email, nil)

	handleCustomSuccess(ctx, enums.ForgotPassword)
}

type confirmForgotPasswordRequest struct {
	Email           string `json:"email" binding:"required,email" example:"test@example.com"`
	Password        string `json:"password" binding:"required,min=8,max=40" example:"12345678"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8,max=40" example:"12345678"`
	Code            string `json:"code" binding:"required,min=6" example:"123456"`
}

// ConfirmForgotPassword godoc
//
//	@Summary		Reset password with verification code
//	@Description	Validates the reset code and updates the user's password
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			confirmForgotPasswordRequest	body	confirmForgotPasswordRequest	true	"Email, code and new password information"
//	@Success		200		{object}	response	    "Password reset successful"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		404		{object}	errorResponse	"User not found"
//	@Failure		500		{object}	errorResponse	"Internal server error"
//	@Router			/users/forgot-password/confirm [post]
func (uh *UserHandler) ConfirmForgotPassword(ctx *gin.Context) {
	var req confirmForgotPasswordRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err := domain.ConfirmPassword(req.Password, req.ConfirmPassword); err != nil {
		validationError(ctx, err)
		return
	}

	err := uh.svc.ConfirmForgotPassword(ctx, req.Email, req.Code, req.Password)
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, req.Email, nil)

	handleCustomSuccess(ctx, enums.ConfirmForgotPassword)
}
