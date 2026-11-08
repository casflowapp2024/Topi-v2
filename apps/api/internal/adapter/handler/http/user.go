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

// requestMeta returns the client data used for rate limiting and auditing
func requestMeta(ctx *gin.Context) domain.RequestMeta {
	return domain.RequestMeta{
		IP:        ctx.ClientIP(),
		UserAgent: ctx.Request.UserAgent(),
	}
}

// registerRequest represents the request body for creating a user
type registerRequest struct {
	Name            string `json:"name" binding:"required,max=30" example:"John"`
	LastName        string `json:"last_name" binding:"required,max=30" example:"Doe"`
	Email           string `json:"email" binding:"required,email,max=255" example:"test@example.com"`
	Password        string `json:"password" binding:"required,min=8,max=40" example:"Password123!"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8,max=40" example:"Password123!"`
}

// Register godoc
//
//	@Summary		Register a new user
//	@Description	Creates a new user (no email verification) and logs it in. Password policy: at least 8 characters, uppercase, lowercase, number and symbol.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			registerRequest	body		registerRequest						true	"Register request"
//	@Success		201				{object}	response{data=signupResponse}		"User created and logged in"
//	@Failure		400				{object}	errorResponse						"Validation error"
//	@Failure		401				{object}	errorResponse						"Password does not meet the requirements"
//	@Failure		409				{object}	errorResponse						"User already exists"
//	@Failure		429				{object}	errorResponse						"Too many requests"
//	@Failure		500				{object}	errorResponse						"Internal server error"
//	@Router			/users/signup [post]
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

	user := domain.User{
		Name:     req.Name,
		LastName: req.LastName,
		Email:    req.Email,
		Password: req.Password,
	}

	tokens, err := uh.svc.Register(ctx, &user, requestMeta(ctx))
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, user.ID, nil)

	handleCreatedSuccess(ctx, newSignupResponse(tokens))
}

// ConfirmUser godoc
//
//	@Summary		Confirm a user account (deprecated, no-op)
//	@Description	Kept for compatibility: accounts no longer need confirmation. Always returns 200.
//	@Tags			Users
//	@Produce		json
//	@Success		200	{object}	response	"Account confirmed"
//	@Router			/users/confirm [post]
func (uh *UserHandler) ConfirmUser(ctx *gin.Context) {
	handleCustomSuccess(ctx, enums.ConfirmedUser)
}

// ResendConfirmationCode godoc
//
//	@Summary		Resend confirmation code (deprecated, no-op)
//	@Description	Kept for compatibility: no emails are sent. Always returns 200.
//	@Tags			Users
//	@Produce		json
//	@Success		200	{object}	response	"OK"
//	@Router			/users/resend-confirmation [post]
func (uh *UserHandler) ResendConfirmationCode(ctx *gin.Context) {
	handleCustomSuccess(ctx, enums.ResentConfirmationCode)
}

// loginRequest represents the request body for logging in a user
type loginRequest struct {
	Email    string `json:"email" binding:"required,email" example:"test@example.com"`
	Password string `json:"password" binding:"required,min=8" example:"Password123!" minLength:"8"`
}

// Login godoc
//
//	@Summary		Login and get an access token
//	@Description	Logs in with email and password. If the account has no password yet (migrated users) it returns 403 "user needs to reset the password": use /users/password/forgot and /users/password/reset.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			loginRequest	body		loginRequest						true	"Login credentials"
//	@Success		200				{object}	response{data=authResponse}			"Successfully logged in"
//	@Failure		400				{object}	errorResponse						"Validation error"
//	@Failure		401				{object}	errorResponse						"Incorrect username or password"
//	@Failure		403				{object}	errorResponse						"The user must create a password"
//	@Failure		429				{object}	errorResponse						"Too many requests"
//	@Failure		500				{object}	errorResponse						"Internal server error"
//	@Router			/users/login [post]
func (uh *UserHandler) Login(ctx *gin.Context) {
	var req loginRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	tokens, err := uh.svc.Login(ctx, req.Email, req.Password, requestMeta(ctx))
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, req.Email, nil)

	handleSuccess(ctx, newAuthResponse(tokens))
}

// forgotPasswordRequest asks for a code to create a new password
type forgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email" example:"test@example.com"`
}

// ForgotPassword godoc
//
//	@Summary		Send a code to recover (or create) the password
//	@Description	Sends a 6 digit code valid for 10 minutes. The answer is the same whether the email is registered or not. Also for accounts without a password (migrated).
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			forgotPasswordRequest	body		forgotPasswordRequest	true	"Email"
//	@Success		200						{object}	response				"If the email is registered a code was sent"
//	@Failure		400						{object}	errorResponse			"Validation error"
//	@Failure		429						{object}	errorResponse			"Too many requests"
//	@Router			/users/password/forgot [post]
func (uh *UserHandler) ForgotPassword(ctx *gin.Context) {
	var req forgotPasswordRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err := uh.svc.ForgotPassword(ctx, req.Email, requestMeta(ctx)); err != nil {
		handleError(ctx, err)
		return
	}

	handleCustomSuccess(ctx, enums.ForgotPassword)
}

// resetPasswordRequest sets a new password with the code sent by email
type resetPasswordRequest struct {
	Email           string `json:"email" binding:"required,email" example:"test@example.com"`
	Code            string `json:"code" binding:"required,len=6,numeric" example:"123456"`
	Password        string `json:"password" binding:"required,min=8,max=40" example:"Password123!"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8,max=40" example:"Password123!"`
}

// ResetPassword godoc
//
//	@Summary		Set a new password with the code sent by email
//	@Description	Checks the code (10 minutes, 5 attempts), sets the password, closes every other session and logs in.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			resetPasswordRequest	body		resetPasswordRequest			true	"Email, code and new password"
//	@Success		200						{object}	response{data=authResponse}		"Password updated and logged in"
//	@Failure		400						{object}	errorResponse					"Validation error or expired code (ask for a new one)"
//	@Failure		401						{object}	errorResponse					"Wrong code or password does not meet the requirements"
//	@Failure		429						{object}	errorResponse					"Too many requests"
//	@Router			/users/password/reset [post]
func (uh *UserHandler) ResetPassword(ctx *gin.Context) {
	var req resetPasswordRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err := domain.ConfirmPassword(req.Password, req.ConfirmPassword); err != nil {
		validationError(ctx, err)
		return
	}

	tokens, err := uh.svc.ResetPassword(ctx, req.Email, req.Code, req.Password, requestMeta(ctx))
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, req.Email, nil)

	handleSuccess(ctx, newAuthResponse(tokens))
}

// setInitialPasswordRequest represents the request to create the password of an account without one
type setInitialPasswordRequest struct {
	Email           string `json:"email" binding:"required,email" example:"test@example.com"`
	Password        string `json:"password" binding:"required,min=8,max=40" example:"Password123!"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8,max=40" example:"Password123!"`
}

// SetInitialPassword godoc
//
//	@Summary		Closed: use /users/password/forgot and /users/password/reset
//	@Description	Creating a password without a code is no longer allowed. Always 401 (kept for old cached fronts).
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			setInitialPasswordRequest	body		setInitialPasswordRequest		true	"Email and new password"
//	@Success		200							{object}	response{data=authResponse}		"Password created and logged in"
//	@Failure		400							{object}	errorResponse					"Validation error"
//	@Failure		401							{object}	errorResponse					"Not allowed or password does not meet the requirements"
//	@Failure		429							{object}	errorResponse					"Too many requests"
//	@Failure		500							{object}	errorResponse					"Internal server error"
//	@Router			/users/set-initial-password [post]
func (uh *UserHandler) SetInitialPassword(ctx *gin.Context) {
	var req setInitialPasswordRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err := domain.ConfirmPassword(req.Password, req.ConfirmPassword); err != nil {
		validationError(ctx, err)
		return
	}

	tokens, err := uh.svc.SetInitialPassword(ctx, req.Email, req.Password, requestMeta(ctx))
	if err != nil {
		handleError(ctx, err)
		return
	}

	logRequestMetric(ctx, req.Email, nil)

	handleSuccess(ctx, newAuthResponse(tokens))
}

// refreshTokenRequest represents a request carrying a refresh token
type refreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required" example:"bG9uZy1yYW5kb20tdG9rZW4"`
}

// Refresh godoc
//
//	@Summary		Refresh the session
//	@Description	Rotates the refresh token and returns new tokens. Reusing an old refresh token revokes every session of the user.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			refreshTokenRequest	body		refreshTokenRequest				true	"Refresh token"
//	@Success		200					{object}	response{data=authResponse}		"New tokens"
//	@Failure		400					{object}	errorResponse					"Validation error"
//	@Failure		401					{object}	errorResponse					"Invalid, expired or reused refresh token"
//	@Router			/users/refresh [post]
func (uh *UserHandler) Refresh(ctx *gin.Context) {
	var req refreshTokenRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	tokens, err := uh.svc.Refresh(ctx, req.RefreshToken, requestMeta(ctx))
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, newAuthResponse(tokens))
}

// Logout godoc
//
//	@Summary		Logout
//	@Description	Revokes the refresh token. Idempotent.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Param			refreshTokenRequest	body		refreshTokenRequest	true	"Refresh token"
//	@Success		200					{object}	response			"Logged out"
//	@Failure		400					{object}	errorResponse		"Validation error"
//	@Router			/users/logout [post]
func (uh *UserHandler) Logout(ctx *gin.Context) {
	var req refreshTokenRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err := uh.svc.Logout(ctx, req.RefreshToken); err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, nil)
}

// verifyEmailRequest confirms the email with the code
type verifyEmailRequest struct {
	Code string `json:"code" binding:"required,len=6,numeric" example:"123456"`
}

// VerifyEmail godoc
//
//	@Summary		Confirm the email with the code
//	@Description	New users get a code by email at signup. Nothing is blocked while the email is not verified.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			verifyEmailRequest	body		verifyEmailRequest	true	"Code"
//	@Success		200					{object}	response			"Email verified"
//	@Failure		400					{object}	errorResponse		"Validation error or expired code"
//	@Failure		401					{object}	errorResponse		"Wrong code"
//	@Router			/users/email/verify [post]
func (uh *UserHandler) VerifyEmail(ctx *gin.Context) {
	var req verifyEmailRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err = uh.svc.VerifyEmail(ctx, *userID, req.Code, requestMeta(ctx)); err != nil {
		handleError(ctx, err)
		return
	}

	handleCustomSuccess(ctx, enums.ConfirmedUser)
}

// SendVerification godoc
//
//	@Summary		Send a new email verification code
//	@Tags			Users
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response		"Code sent (or already verified)"
//	@Failure		429	{object}	errorResponse	"Too many requests"
//	@Router			/users/email/verify/resend [post]
func (uh *UserHandler) SendVerification(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = uh.svc.SendVerification(ctx, *userID, requestMeta(ctx)); err != nil {
		handleError(ctx, err)
		return
	}

	handleCustomSuccess(ctx, enums.ResentConfirmationCode)
}

// changePasswordRequest represents the request to change the password
type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required" example:"Password123!"`
	Password        string `json:"password" binding:"required,min=8,max=40" example:"NewPassword123!"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8,max=40" example:"NewPassword123!"`
}

// ChangePassword godoc
//
//	@Summary		Change the password
//	@Description	Changes the password using the current one. Every other session is closed; new tokens are returned for the current one.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			changePasswordRequest	body		changePasswordRequest			true	"Current and new password"
//	@Success		200						{object}	response{data=authResponse}		"Password changed"
//	@Failure		400						{object}	errorResponse					"Validation error"
//	@Failure		401						{object}	errorResponse					"Wrong current password or invalid new password"
//	@Router			/users/password [put]
func (uh *UserHandler) ChangePassword(ctx *gin.Context) {
	var req changePasswordRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	if err = domain.ConfirmPassword(req.Password, req.ConfirmPassword); err != nil {
		validationError(ctx, err)
		return
	}

	tokens, err := uh.svc.ChangePassword(ctx, *userID, req.CurrentPassword, req.Password, requestMeta(ctx))
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, newAuthResponse(tokens))
}

// GetUser godoc
//
//	@Summary		Get the authenticated user
//	@Tags			Users
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response{data=userResponse}	"User"
//	@Failure		401	{object}	errorResponse				"Unauthorized error"
//	@Router			/users/ [get]
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
//	@Summary		Update the authenticated user
//	@Description	Updates name and last name (also in user_extra)
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			updateUserRequest	body		updateUserRequest			true	"Name and last name"
//	@Success		200					{object}	response{data=userResponse}	"Updated user"
//	@Failure		400					{object}	errorResponse				"Validation error"
//	@Failure		401					{object}	errorResponse				"Unauthorized error"
//	@Router			/users/ [put]
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
