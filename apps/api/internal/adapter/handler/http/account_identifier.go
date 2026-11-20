package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"strconv"

	"github.com/gin-gonic/gin"
)

type addIdentifierRequest struct {
	Digits string `json:"digits" binding:"required" example:"1234"`
}

// ListIdentifiers godoc
//
//	@Summary		List account identifiers
//	@Description	The digits that recognise the account in bank emails: typed by the user or learned from the user's corrections (plan/32)
//	@Tags			Accounts
//	@Produce		json
//	@Param			id	path		int	true	"Account ID"
//	@Success		200	{object}	response{data=[]accountIdentifierResponse}	"Identifiers, oldest first"
//	@Failure		404	{object}	errorResponse	"Data not found error"
//	@Router			/accounts/{id}/identifiers [get]
//	@Security		BearerAuth
func (ah *AccountHandler) ListIdentifiers(ctx *gin.Context) {
	userID, accountID, ok := identifierPath(ctx)
	if !ok {
		return
	}
	identifiers, err := ah.svc.ListIdentifiers(ctx, userID, accountID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	rsp := make([]accountIdentifierResponse, 0, len(identifiers))
	for _, identifier := range identifiers {
		rsp = append(rsp, newAccountIdentifierResponse(identifier))
	}
	handleSuccess(ctx, rsp)
}

// AddIdentifier godoc
//
//	@Summary		Add account identifier
//	@Description	Adds digits that recognise the account (an additional or renewed card). 409 when they belong to another account of the bank; 400 for investments.
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int						true	"Account ID"
//	@Param			request	body		addIdentifierRequest	true	"Digits"
//	@Success		200		{object}	response{data=accountIdentifierResponse}	"Identifier"
//	@Failure		400		{object}	errorResponse	"Validation error"
//	@Failure		409		{object}	errorResponse	"Data conflict error"
//	@Router			/accounts/{id}/identifiers [post]
//	@Security		BearerAuth
func (ah *AccountHandler) AddIdentifier(ctx *gin.Context) {
	userID, accountID, ok := identifierPath(ctx)
	if !ok {
		return
	}
	var req addIdentifierRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	identifier, err := ah.svc.AddIdentifier(ctx, userID, accountID, req.Digits)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, newAccountIdentifierResponse(*identifier))
}

// DeleteIdentifier godoc
//
//	@Summary		Delete account identifier
//	@Description	Removes digits from the account. When they were the number the user typed, the account is left without one.
//	@Tags			Accounts
//	@Produce		json
//	@Param			id				path	int	true	"Account ID"
//	@Param			identifier_id	path	int	true	"Identifier ID"
//	@Success		200	{object}	response	"Deleted"
//	@Failure		404	{object}	errorResponse	"Data not found error"
//	@Router			/accounts/{id}/identifiers/{identifier_id} [delete]
//	@Security		BearerAuth
func (ah *AccountHandler) DeleteIdentifier(ctx *gin.Context) {
	userID, accountID, ok := identifierPath(ctx)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(ctx.Param("identifier_id"), 10, 64)
	if err != nil {
		validationError(ctx, err)
		return
	}
	if err = ah.svc.DeleteIdentifier(ctx, userID, accountID, id); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, nil)
}

func identifierPath(ctx *gin.Context) (string, uint64, bool) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return "", 0, false
	}
	accountID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		validationError(ctx, err)
		return "", 0, false
	}
	return *userID, accountID, true
}
