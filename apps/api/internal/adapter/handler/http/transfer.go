package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type linkTransferURI struct {
	ID uint64 `uri:"id" binding:"required,min=1" example:"1"`
}

// linkTransferRequest: counterpart_transaction_id links with an existing transaction; otherwise
// counterpart_account_id creates the other leg (counterpart_amount only between currencies).
type linkTransferRequest struct {
	CounterpartTransactionID uint64  `json:"counterpart_transaction_id" binding:"omitempty,min=1" example:"42"`
	CounterpartAccountID     uint64  `json:"counterpart_account_id" binding:"omitempty,min=1" example:"2"`
	CounterpartAmount        *string `json:"counterpart_amount" binding:"omitempty" example:"387041"`
}

type linkTransferResponse struct {
	TransferGroupID string              `json:"transfer_group_id"`
	Transaction     transactionResponse `json:"transaction"`
	Counterpart     transactionResponse `json:"counterpart"`
}

// LinkTransfer godoc
//
//	@Summary		Mark a transaction as a transfer
//	@Description	Links the transaction with its other leg: an existing transaction of the opposite direction (counterpart_transaction_id) or a new one created in counterpart_account_id with the same date, description and category. Linked legs leave income and expenses; categories and budgets still count them.
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			id		path		uint64								true	"Transaction ID"
//	@Param			request	body		linkTransferRequest					true	"Counterpart"
//	@Success		201		{object}	response{data=linkTransferResponse}	"Transfer linked"
//	@Failure		400		{object}	errorResponse						"Validation error"
//	@Failure		404		{object}	errorResponse						"Transaction or account not found"
//	@Failure		409		{object}	errorResponse						"Already linked or not linkable"
//	@Router			/transactions/{id}/transfer [post]
//	@Security		BearerAuth
func (ph *TransactionHandler) LinkTransfer(ctx *gin.Context) {
	var (
		uri linkTransferURI
		req linkTransferRequest
	)

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	link := &domain.TransferLink{
		UserID:                   *userID,
		TransactionID:            uri.ID,
		CounterpartTransactionID: req.CounterpartTransactionID,
		CounterpartAccountID:     req.CounterpartAccountID,
	}
	if req.CounterpartAmount != nil {
		amount, aErr := decimal.NewFromString(*req.CounterpartAmount)
		if aErr != nil {
			handleError(ctx, domain.ErrInvalidTransfer)
			return
		}
		link.CounterpartAmount = &amount
	}

	if err = ph.svc.LinkTransfer(ctx, link); err != nil {
		handleError(ctx, err)
		return
	}

	handleCreatedSuccess(ctx, linkTransferResponse{
		TransferGroupID: link.GroupID,
		Transaction:     newTransactionResponse(&link.Transaction),
		Counterpart:     newTransactionResponse(&link.Counterpart),
	})
}

// DismissCounterpart godoc
//
//	@Summary		Stop asking for the other leg of a card payment
//	@Description	The payment did not come from an account of the user: it stays as an income of the card.
//	@Tags			Transactions
//	@Produce		json
//	@Param			id	path		uint64			true	"Transaction ID"
//	@Success		200	{object}	response		"Dismissed"
//	@Failure		404	{object}	errorResponse	"Transaction not found or not waiting"
//	@Router			/transactions/{id}/transfer/dismiss [post]
//	@Security		BearerAuth
func (ph *TransactionHandler) DismissCounterpart(ctx *gin.Context) {
	var uri linkTransferURI

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	if err = ph.svc.DismissCounterpart(ctx, *userID, uri.ID); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, nil)
}

type counterpartSuggestionResponse struct {
	AccountID *uint64 `json:"account_id" example:"2"`
}

// SuggestCounterpart godoc
//
//	@Summary		Most likely account for the other leg
//	@Description	The account the user most often transferred from to the account of this transaction (null without history).
//	@Tags			Transactions
//	@Produce		json
//	@Param			id	path		uint64											true	"Transaction ID"
//	@Success		200	{object}	response{data=counterpartSuggestionResponse}	"Suggestion"
//	@Router			/transactions/{id}/transfer/suggestion [get]
//	@Security		BearerAuth
func (ph *TransactionHandler) SuggestCounterpart(ctx *gin.Context) {
	var uri linkTransferURI

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	accountID, err := ph.svc.SuggestCounterpartAccount(ctx, *userID, uri.ID)
	if err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, counterpartSuggestionResponse{AccountID: accountID})
}

type unlinkTransferURI struct {
	GroupID string `uri:"group" binding:"required,uuid" example:"5b1c0c4e-3f0e-4c55-9d3a-0f6f1f1e2a10"`
}

// UnlinkTransfer godoc
//
//	@Summary		Unlink a transfer
//	@Description	Both legs become ordinary transactions again (they count as income and expense). Nothing is deleted.
//	@Tags			Transactions
//	@Produce		json
//	@Param			group	path		string			true	"transfer_group_id"
//	@Success		200		{object}	response		"Transfer unlinked"
//	@Failure		404		{object}	errorResponse	"Transfer not found"
//	@Router			/transactions/transfer/{group} [delete]
//	@Security		BearerAuth
func (ph *TransactionHandler) UnlinkTransfer(ctx *gin.Context) {
	var uri unlinkTransferURI

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindUri(&uri); err != nil {
		validationError(ctx, err)
		return
	}
	if err = ph.svc.UnlinkTransfer(ctx, *userID, uri.GroupID); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, nil)
}

type transferCandidatesRequest struct {
	Limit uint64 `form:"limit" binding:"omitempty,min=1" example:"50"`
}

type transferCandidateResponse struct {
	OutTransactionID uint64 `json:"out_transaction_id" example:"10"`
	InTransactionID  uint64 `json:"in_transaction_id" example:"11"`
	OutAccountID     uint64 `json:"out_account_id" example:"1"`
	InAccountID      uint64 `json:"in_account_id" example:"2"`
	OutAmount        string `json:"out_amount" example:"500000"`
	InAmount         string `json:"in_amount" example:"500000"`
	OutCurrency      string `json:"out_currency" example:"COP"`
	InCurrency       string `json:"in_currency" example:"COP"`
	OutDescription   string `json:"out_description" example:"Transferencia a Nequi"`
	InDescription    string `json:"in_description" example:"Recibiste dinero"`
	OutDate          string `json:"out_date" example:"2026-10-27T15:04:05Z"`
	InDate           string `json:"in_date" example:"2026-10-27T15:05:00Z"`
	DayGap           int    `json:"day_gap" example:"0"`
	Confidence       string `json:"confidence" example:"high"`
}

// ListTransferCandidates godoc
//
//	@Summary		Possible transfers
//	@Description	Pairs of an expense and an income in different accounts of the user that look like a transfer and are not linked or dismissed. confidence: high (same amount and currency, ≤1 day), medium (same amount, 2–3 days), low (different currencies, similar value in the base currency).
//	@Tags			Transactions
//	@Produce		json
//	@Param			limit	query		int												false	"Max pairs (default and max 200)"
//	@Success		200		{object}	response{data=[]transferCandidateResponse}	"Candidates"
//	@Router			/transactions/transfer/candidates [get]
//	@Security		BearerAuth
func (ph *TransactionHandler) ListTransferCandidates(ctx *gin.Context) {
	var req transferCandidatesRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindQuery(&req); err != nil {
		validationError(ctx, err)
		return
	}

	candidates, err := ph.svc.ListTransferCandidates(ctx, *userID, req.Limit)
	if err != nil {
		handleError(ctx, err)
		return
	}

	out := make([]transferCandidateResponse, 0, len(candidates))
	for _, c := range candidates {
		out = append(out, transferCandidateResponse{
			OutTransactionID: c.OutTransactionID,
			InTransactionID:  c.InTransactionID,
			OutAccountID:     c.OutAccountID,
			InAccountID:      c.InAccountID,
			OutAmount:        c.OutAmount.String(),
			InAmount:         c.InAmount.String(),
			OutCurrency:      c.OutCurrency,
			InCurrency:       c.InCurrency,
			OutDescription:   c.OutDescription,
			InDescription:    c.InDescription,
			OutDate:          c.OutDate.UTC().Format(time.RFC3339),
			InDate:           c.InDate.UTC().Format(time.RFC3339),
			DayGap:           c.DayGap,
			Confidence:       c.Confidence,
		})
	}
	handleSuccess(ctx, out)
}

type dismissTransferCandidateRequest struct {
	OutTransactionID uint64 `json:"out_transaction_id" binding:"required,min=1" example:"10"`
	InTransactionID  uint64 `json:"in_transaction_id" binding:"required,min=1" example:"11"`
}

// DismissTransferCandidate godoc
//
//	@Summary		Dismiss a possible transfer
//	@Description	The pair is not proposed again. The transactions do not change.
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Param			request	body		dismissTransferCandidateRequest	true	"Pair"
//	@Success		200		{object}	response						"Dismissed"
//	@Failure		404		{object}	errorResponse					"Transaction not found"
//	@Router			/transactions/transfer/dismiss [post]
//	@Security		BearerAuth
func (ph *TransactionHandler) DismissTransferCandidate(ctx *gin.Context) {
	var req dismissTransferCandidateRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}
	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}
	if err = ph.svc.DismissTransferCandidate(ctx, *userID, req.OutTransactionID, req.InTransactionID); err != nil {
		handleError(ctx, err)
		return
	}
	handleSuccess(ctx, nil)
}
