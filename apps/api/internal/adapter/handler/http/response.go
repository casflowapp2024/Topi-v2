package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// =============================================================================
// Handle Errors
// =============================================================================

// errorStatusMap is a map of defined error messages and their corresponding http status codes
var errorStatusMap = map[error]int{
	// User Errors
	domain.ErrDifferentConfirmPassword: http.StatusBadRequest,
	domain.ErrInvalidTokenUse:          http.StatusUnauthorized,

	// User Extra Errors
	domain.ErrInvalidUTCOffset: http.StatusBadRequest,

	// Category Errors
	domain.ErrDefaultCategoryLocked: http.StatusBadRequest,

	// Transaction Errors
	domain.ErrGettingOtherCategoryId: http.StatusNotFound,

	// Social Login Errors
	domain.ErrSocialSignIn:                http.StatusForbidden,
	domain.ErrSocialInvalidGrant:          http.StatusBadRequest,
	domain.ErrParsingAuthURL:              http.StatusBadRequest,
	domain.ErrMobileCallbackNotConfigured: http.StatusNotFound,

	// Email Errors
	domain.ErrEmailAlreadyConfigured:   http.StatusConflict,
	domain.ErrGmailConfigurationFailed: http.StatusInternalServerError,
	domain.ErrUnsupportedEmailProvider: http.StatusBadRequest,
	domain.ErrEmailInvalidCode:         http.StatusBadRequest,
	domain.ErrEmailInvalidClientId:     http.StatusInternalServerError,
	domain.ErrEmailRateLimitExceeded:   http.StatusTooManyRequests,
	domain.ErrEmailAccessDenied:        http.StatusForbidden,
	domain.ErrEmailInvalidRequest:      http.StatusBadRequest,
	domain.ErrAccountsNotFound:         http.StatusNoContent,

	// Analysis Errors
	domain.ErrWrongBalanceFilter: http.StatusBadRequest,
	domain.ErrInvalidDateRange:   http.StatusBadRequest,

	// Account Type Errors
	domain.ErrInvalidAccountType: http.StatusBadRequest,

	// Multicurrency Errors
	domain.ErrInvalidCurrency:           http.StatusBadRequest,
	domain.ErrAccountCurrencyLocked:     http.StatusConflict,
	domain.ErrInvalidTransfer:           http.StatusBadRequest,
	domain.ErrInvalidFxRate:             http.StatusBadRequest,
	domain.ErrTransferLinked:            http.StatusConflict,
	domain.ErrInvalidValuation:          http.StatusBadRequest,
	domain.ErrNotInvestmentAccount:      http.StatusBadRequest,
	domain.ErrValuationBeforeAccount:    http.StatusBadRequest,
	domain.ErrInvalidCurrencyChangeMode: http.StatusBadRequest,
	domain.ErrMissingFxRates:            http.StatusConflict,
	domain.ErrCurrencyChangeNotUndoable: http.StatusConflict,
	domain.ErrInvalidCreditCard:         http.StatusBadRequest,
	domain.ErrNotCreditAccount:          http.StatusBadRequest,

	// Token Errors
	domain.ErrExpiredToken:               http.StatusUnauthorized,
	domain.ErrVerifyingTokenSignature:    http.StatusUnauthorized,
	domain.ErrInvalidTokenClaims:         http.StatusUnauthorized,
	domain.ErrEmptyAuthorizationHeader:   http.StatusUnauthorized,
	domain.ErrInvalidAuthorizationHeader: http.StatusUnauthorized,
	domain.ErrInvalidAuthorizationType:   http.StatusUnauthorized,
	domain.ErrEmptyAccessToken:           http.StatusUnauthorized,
	domain.ErrUnauthorized:               http.StatusUnauthorized,
	domain.ErrForbidden:                  http.StatusForbidden,

	// General Errors
	domain.ErrInternal:                 http.StatusInternalServerError,
	domain.ErrDataNotFound:             http.StatusNotFound,
	domain.ErrNoUpdatedData:            http.StatusBadRequest,
	domain.ErrConflictingData:          http.StatusConflict,
	domain.ErrUniqueConstraintViolated: http.StatusConflict,
	domain.ErrSyntaxError:              http.StatusInternalServerError,
	domain.ErrAmbiguousColumn:          http.StatusInternalServerError,
	domain.ErrValueTooLong:             http.StatusBadRequest,
	domain.ErrInitializingDb:           http.StatusInternalServerError,
	domain.ErrPingDb:                   http.StatusInternalServerError,
	domain.ErrInitializingCache:        http.StatusInternalServerError,
	domain.ErrLoadingEnv:               http.StatusInternalServerError,
	domain.ErrRunningServer:            http.StatusInternalServerError,
	domain.ErrRegisteringValidator:     http.StatusInternalServerError,
	domain.ErrInitializingDriver:       http.StatusInternalServerError,
	domain.ErrInstantiatingMigrator:    http.StatusInternalServerError,
	domain.ErrMigration:                http.StatusInternalServerError,
	domain.ErrRemovingMigration:        http.StatusInternalServerError,
	domain.ErrInvalidConfig:            http.StatusInternalServerError,
	domain.ErrBeginTrx:                 http.StatusInternalServerError,

	// Auth Errors (strings are part of the contract with the front)
	domain.ErrUsernameExistsException:        http.StatusConflict,
	domain.ErrLimitExceededException:         http.StatusTooManyRequests,
	domain.ErrInvalidPasswordException:       http.StatusUnauthorized,
	domain.ErrCodeMismatchException:          http.StatusUnauthorized,
	domain.ErrNotAuthorizedException:         http.StatusUnauthorized,
	domain.ErrExpiredCodeException:           http.StatusBadRequest,
	domain.ErrUserNotFoundException:          http.StatusNotFound,
	domain.ErrUserNotConfirmedException:      http.StatusUnauthorized,
	domain.ErrPasswordResetRequiredException: http.StatusForbidden,
	domain.ErrExpiredTokenException:          http.StatusUnauthorized,
}

// validationError sends an error response for some specific request validation error
func validationError(ctx *gin.Context, err error) {
	errMsgs := parseError(err)
	errRsp := newErrorResponse(errMsgs)
	ctx.JSON(http.StatusBadRequest, errRsp)
}

// handleError determines the status code of an error and returns a JSON response with the error message and status code
func handleError(ctx *gin.Context, err error) {
	statusCode, ok := errorStatusMap[err]
	if !ok {
		statusCode = http.StatusInternalServerError
	}

	errMsg := parseError(err)
	errRsp := newErrorResponse(errMsg)
	ctx.JSON(statusCode, errRsp)
}

// handleAbort sends an error response and aborts the request with the specified status code and error message
func handleAbort(ctx *gin.Context, err error) {
	statusCode, ok := errorStatusMap[err]
	if !ok {
		statusCode = http.StatusInternalServerError
	}

	errMsg := parseError(err)
	errRsp := newErrorResponse(errMsg)
	ctx.AbortWithStatusJSON(statusCode, errRsp)
}

// parseError parses error messages from the error object and returns a slice of error messages
func parseError(err error) []string {
	var errMsgs []string

	if errors.As(err, &validator.ValidationErrors{}) {
		for _, err = range err.(validator.ValidationErrors) {
			errMsgs = append(errMsgs, err.Error())
		}
	} else {
		errMsgs = append(errMsgs, err.Error())
	}

	return errMsgs
}

// errorResponse represents an error response body format
type errorResponse struct {
	Success  bool     `json:"success" example:"false"`
	Messages []string `json:"messages" example:"Error message 1, Error message 2"`
}

// newErrorResponse is a helper function to create an error response body
func newErrorResponse(errMsgs []string) errorResponse {
	return errorResponse{
		Success:  false,
		Messages: errMsgs,
	}
}

// handleSuccess sends a success response with the specified status code and optional data
func handleSuccess(ctx *gin.Context, data any) {
	rsp := newResponse(true, "Success", data)
	ctx.JSON(http.StatusOK, rsp)
}

// handleMultipleStatus sends
func handleMultipleStatus(ctx *gin.Context, data any) {
	ctx.JSON(http.StatusMultiStatus, data)
}

// handleSuccess sends a success response with the specified status code and optional data
func handleCustomSuccess(ctx *gin.Context, message string) {
	rsp := newResponse(true, message, nil)
	ctx.JSON(http.StatusOK, rsp)
}

// handleCreatedSuccess sends a success response with the specified status code and optional data
func handleCreatedSuccess(ctx *gin.Context, data any) {
	rsp := newResponse(true, "Success", data)
	ctx.JSON(http.StatusCreated, rsp)
}

// response represents a response body format
// @Description Standard API response format
type response struct {
	Success bool   `json:"success" example:"true"`
	Message string `json:"message" example:"success"`
	Data    any    `json:"data,omitempty"`
}

// =============================================================================
// Response Helpers
// =============================================================================

// newResponse is a helper function to create a response body
func newResponse(success bool, message string, data any) response {
	return response{
		Success: success,
		Message: message,
		Data:    data,
	}
}

// meta represents metadata for a paginated response
type meta struct {
	Skip  uint64 `json:"skip" example:"0"`
	Limit uint64 `json:"limit" example:"10"`
	Total uint64 `json:"total" example:"100"`
}

// newMeta is a helper function to create metadata for a paginated response
func newMeta(total, limit, skip uint64) meta {
	return meta{
		Skip:  skip,
		Limit: limit,
		Total: total,
	}
}

type transactionMeta struct {
	meta
	News      uint64 `json:"news" example:"10"`
	ReadEmail bool   `json:"read_email_onboarding" example:"false"`
}

func transactionMetadata(total, news, limit, skip uint64, readEmail bool) transactionMeta {
	return transactionMeta{
		meta:      newMeta(total, limit, skip),
		News:      news,
		ReadEmail: readEmail,
	}
}

// toMap is a helper function to add meta and data to a map
func toMap(m any, data any, key string) map[string]any {
	return map[string]any{
		key:    data,
		"meta": m,
	}
}

// =============================================================================
// User Extra
// =============================================================================

// userExtraResponse represents the response body for user extra information
type userExtraResponse struct {
	UserID              string          `json:"user_id,omitempty"`
	Email               string          `json:"email,omitempty"`
	Name                string          `json:"name,omitempty"`
	LastName            string          `json:"last_name,omitempty"`
	UTCOffset           int16           `json:"utc_offset"`
	Whatsapp            string          `json:"whatsapp"`
	WhatsappState       string          `json:"whatsapp_state"`
	OnboardingCompleted bool            `json:"onboarding_completed"`
	ReadEmail           bool            `json:"read_email"`
	Config              json.RawMessage `json:"config,omitempty" swaggertype:"object"`
	BaseCurrency        string          `json:"base_currency" example:"COP"`
}

// newUserExtraResponse creates a new userExtraResponse from a domain.UserExtra
func newUserExtraResponse(userExtra *domain.UserExtra) userExtraResponse {
	offset := enums.ZoneToOffset[userExtra.UTCOffset]
	return userExtraResponse{
		UserID:              userExtra.UserID,
		Email:               userExtra.Email,
		Name:                userExtra.Name,
		LastName:            userExtra.LastName,
		UTCOffset:           offset,
		Whatsapp:            userExtra.Whatsapp,
		WhatsappState:       userExtra.WhatsappState,
		OnboardingCompleted: userExtra.OnboardingCompleted,
		ReadEmail:           userExtra.ReadEmail,
		Config:              userExtra.Config,
		BaseCurrency:        userExtra.BaseCurrency,
	}
}

// authResponse represents an authentication response body
type authResponse struct {
	IdToken      string `json:"id_token"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type" example:"Bearer"`
}

// newAuthResponse is a helper function to create a response body for handling authentication data
func newAuthResponse(tokens *domain.AuthTokens) authResponse {
	if tokens == nil {
		return authResponse{}
	}

	return authResponse{
		IdToken:      tokens.IdToken,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		TokenType:    tokens.TokenType,
	}
}

// signupResponse keeps the previous signup body ({"success", "message": "User created"})
// and adds the tokens (automatic login)
type signupResponse struct {
	Success bool   `json:"success" example:"true"`
	Message string `json:"message" example:"User created"`
	authResponse
}

// newSignupResponse is a helper function to create a response body for user creation
func newSignupResponse(tokens *domain.AuthTokens) signupResponse {
	return signupResponse{
		Success:      true,
		Message:      "User created",
		authResponse: newAuthResponse(tokens),
	}
}

// userResponse represents a user response body
type userResponse struct {
	Name     string `json:"name" example:"John"`
	LastName string `json:"last_name" example:"Doe"`
	Email    string `json:"email" example:"test@example.com"`
	Verified bool   `json:"verified" example:"true"`
}

// newUserResponse is a helper function to create a response body for handling user data
func newUserResponse(user *domain.User) userResponse {
	return userResponse{
		Name:     user.Name,
		LastName: user.LastName,
		Email:    user.Email,
		Verified: user.Verified,
	}
}

// categoryResponse represents an account response body
type categoryResponse struct {
	ID       uint64  `json:"id" example:"1"`
	Name     string  `json:"name" example:"food"`
	Budget   float64 `json:"budget" example:"1000000"`
	Editable bool    `json:"editable" example:"true"`
	Emoji    string  `json:"emoji" example:"🍔"`
	Income   bool    `json:"income" example:"false"`
}

type customCategoryResponse struct {
	ID       uint64  `json:"id,omitempty" example:"1"`
	Name     string  `json:"name,omitempty" example:"food"`
	Budget   float64 `json:"budget,omitempty" example:"1000000"`
	Editable *bool   `json:"editable,omitempty" example:"true"`
	Emoji    string  `json:"emoji,omitempty" example:"🍔"`
	Income   *bool   `json:"income,omitempty" example:"false"`
}

// newCategoryResponse is a helper function to create a response body for handling account data
func newCategoryResponse(category *domain.Category) categoryResponse {
	return categoryResponse{
		ID:       category.ID,
		Name:     category.Name,
		Budget:   category.Budget,
		Editable: category.Editable,
		Emoji:    category.Emoji,
		Income:   category.Income,
	}
}

// bankResponse represents a bank response body
type bankResponse struct {
	ID          uint64  `json:"id" example:"1"`
	Name        string  `json:"name" example:"bancolombia"`
	Email       *string `json:"email" example:"notification@example.com"`
	IsAutomated bool    `json:"is_automated" example:"true"`
}

type customBankResponse struct {
	ID          uint64  `json:"id,omitempty" example:"1"`
	Name        string  `json:"name,omitempty" example:"bancolombia"`
	Email       *string `json:"email,omitempty" example:"notification@example.com"`
	IsAutomated bool    `json:"is_automated,omitempty" example:"true"`
}

// newAccountResponse is a helper function to create a response body for handling account data
func newBankResponse(bank *domain.Bank) bankResponse {
	return bankResponse{
		ID:          bank.ID,
		Name:        bank.Name,
		Email:       bank.Email,
		IsAutomated: isAutomated(bank),
	}
}

func isAutomated(bank *domain.Bank) bool {
	return bank != nil && bank.Email != nil && *bank.Email != ""
}

type authURLResponse struct {
	URL string `json:"url"`
}

func newAuthURLResponse(url string) authURLResponse {
	return authURLResponse{
		URL: url,
	}
}

// =============================================================================
// Email Responses
// =============================================================================

type emailTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
}

func newEmailTokenResponse(email *domain.Email) emailTokenResponse {
	return emailTokenResponse{
		AccessToken:  email.Token.Access,
		RefreshToken: email.Token.Refresh,
		TokenType:    email.Token.Type,
	}
}

type emailListResponse struct {
	Emails   []EmailResponse `json:"emails"`
	Metadata meta            `json:"meta"`
}

type EmailResponse struct {
	ID       *uint64 `json:"id" example:"1"`
	Email    string  `json:"email" example:"jhondoe@example.com"`
	Active   bool    `json:"active" example:"true"`
	Provider string  `json:"provider,omitempty" example:"gmail"`
	Error    *string `json:"error" example:"connection_failed"`
}

type CustomEmailResponse struct {
	ID       *uint64 `json:"id" example:"1"`
	Email    string  `json:"email" example:"jhondoe@example.com"`
	Provider string  `json:"provider" example:"gmail"`
	Active   bool    `json:"active" example:"true"`
	Error    *string `json:"error" example:"connection_failed"`
}

func newEmailListResponse(emails []domain.Email, limit, skip uint64) emailListResponse {
	var (
		emailList []EmailResponse
		total     uint64
	)

	for i, email := range emails {
		if i == 0 {
			total = email.Total
		}

		emailList = append(emailList, EmailResponse{
			ID:       email.ID,
			Email:    email.Email,
			Active:   email.Active,
			Provider: email.Provider,
			Error:    email.Error,
		})

	}

	return emailListResponse{
		Metadata: newMeta(total, limit, skip),
		Emails:   emailList,
	}
}

// =============================================================================
// Account Type
// =============================================================================

type accountTypeResponse struct {
	ID   uint64 `json:"id,omitempty" example:"1"`
	Type string `json:"name,omitempty" example:"savings"`
	// Class: deposit | investment | credit
	Class string `json:"class,omitempty" example:"deposit"`
}

func newAccountTypeResponse(account *domain.AccountType) accountTypeResponse {
	return accountTypeResponse{
		ID:    account.ID,
		Type:  account.Name,
		Class: account.ClassOrDefault(),
	}
}

type accountResponse struct {
	ID             uint64  `json:"id" example:"1"`
	Name           string  `json:"name" example:"account name"`
	LastFourDigits string  `json:"last_four_digits" example:"1234"`
	InitialBalance float64 `json:"initial_balance" example:"1000000"`
	Currency       string  `json:"currency" example:"COP"`
	// HasTransactions: the currency is locked
	HasTransactions bool `json:"has_transactions" example:"true"`
	// ClosedAt: closed accounts take no new movements (null = open)
	ClosedAt   *string             `json:"closed_at" example:"2026-10-28T20:00:00Z"`
	Bank       customBankResponse  `json:"bank"`
	Type       accountTypeResponse `json:"type"`
	Email      CustomEmailResponse `json:"email"`
	Automation *automationResponse `json:"automation,omitempty"`
}

type automationResponse struct {
	Configured bool `json:"configured"`
}

func newAccountResponse(account *domain.Account, create bool) accountResponse {
	accountR := accountResponse{
		ID:              account.ID,
		Name:            account.Name,
		LastFourDigits:  account.LastFourDigits,
		InitialBalance:  account.InitialBalance,
		Currency:        account.Currency,
		HasTransactions: account.HasTransactions,
		ClosedAt:        timeString(account.ClosedAt),
		Bank: customBankResponse{
			ID:   account.Bank.ID,
			Name: account.Bank.Name,
		},
		Type: accountTypeResponse{
			ID:    account.Type.ID,
			Type:  account.Type.Name,
			Class: account.Type.ClassOrDefault(),
		},
		Email: CustomEmailResponse{
			ID:       account.Email.ID,
			Email:    account.Email.Email,
			Active:   account.Email.Active,
			Provider: account.Email.Provider,
			Error:    account.Email.Error,
		},
	}

	if !create {
		accountR.Automation = &automationResponse{
			Configured: account.GetConfiguredState(),
		}
	}

	return accountR
}

type customAccountResponse struct {
	ID             uint64               `json:"id,omitempty" example:"1"`
	Name           string               `json:"name,omitempty" example:"account name"`
	LastFourDigits string               `json:"last_four_digits,omitempty" example:"1234"`
	InitialBalance *float64             `json:"initial_balance,omitempty" example:"1000000"`
	Currency       string               `json:"currency,omitempty" example:"COP"`
	Bank           *customBankResponse  `json:"bank,omitempty"`
	Type           *accountTypeResponse `json:"type,omitempty"`
	EmailID        *uint64              `json:"email_id"`
	*customAutomationResponse
}

type customAutomationResponse struct {
	Email      string `json:"user_email"`
	Provider   string `json:"user_provider,omitempty"`
	Sender     string `json:"sender_email"`
	Configured bool   `json:"configured"`
}

func newAdminAccountResponse(account *domain.Account) customAccountResponse {
	var automation customAutomationResponse

	if account.Bank.Email != nil {
		automation.Sender = *account.Bank.Email
	}

	automation.Configured = account.GetConfiguredState()
	automation.Email = account.Email.Email
	automation.Provider = account.Email.Provider

	return customAccountResponse{
		ID:                       account.ID,
		Name:                     account.Name,
		LastFourDigits:           account.LastFourDigits,
		Currency:                 account.Currency,
		customAutomationResponse: &automation,
		EmailID:                  account.Email.ID,
	}
}

func newAdminAccountsResponse(accounts []domain.Account) map[string][]customAccountResponse {
	rsp := make(map[string][]customAccountResponse)

	for _, account := range accounts {
		var accountRsp = newAdminAccountResponse(&account)

		if accountList, ok := rsp[account.UserID]; ok {
			accountList = append(accountList, accountRsp)
			rsp[account.UserID] = accountList
		} else {
			var newAccounts = make([]customAccountResponse, 0)
			newAccounts = append(newAccounts, accountRsp)
			rsp[account.UserID] = newAccounts
		}
	}

	return rsp
}

// =============================================================================
// Admin Accounts By Bank
// =============================================================================

type accountBasicInfo struct {
	ID             uint64 `json:"id" example:"59"`
	Name           string `json:"name" example:"Cuenta Ahorros - Bancolombia"`
	LastFourDigits string `json:"last_four_digits" example:"1809"`
}

type usersAccountsByBankResponse struct {
	AccountsByBank map[string][]accountsByBankResponse `json:"accounts_by_bank"`
}

type accountsByBankResponse struct {
	Bank         string             `json:"bank" example:"Bancolombia"`
	EmailID      uint64             `json:"email_id" example:"37"`
	UserEmail    string             `json:"user_email" example:"user@example.com"`
	UserProvider string             `json:"user_provider" example:"outlook"`
	SenderEmails []string           `json:"sender_emails"`
	Accounts     []accountBasicInfo `json:"accounts"`
}

func newAdminAccountsByBankResponse(groups []domain.BankAccountGroup) usersAccountsByBankResponse {
	rsp := make(map[string][]accountsByBankResponse)

	for _, group := range groups {
		// Convert domain.AccountBasicInfo to response accountBasicInfo
		accounts := make([]accountBasicInfo, len(group.Accounts))
		for i, acc := range group.Accounts {
			accounts[i] = accountBasicInfo{
				ID:             acc.ID,
				Name:           acc.Name,
				LastFourDigits: acc.LastFourDigits,
			}
		}

		bankResp := accountsByBankResponse{
			Bank:         group.BankName,
			EmailID:      group.EmailID,
			UserEmail:    group.UserEmail,
			UserProvider: group.UserProvider,
			SenderEmails: group.SenderEmails,
			Accounts:     accounts,
		}

		rsp[group.UserID] = append(rsp[group.UserID], bankResp)
	}

	return usersAccountsByBankResponse{
		AccountsByBank: rsp,
	}
}

// =============================================================================
// Transaction
// =============================================================================

// transactionResponse represents a transaction response body
type transactionResponse struct {
	ID           uint64                 `json:"id" example:"1"`
	Description  string                 `json:"description" example:"transaction for the order"`
	Expense      bool                   `json:"expense" example:"false"`
	Amount       float64                `json:"amount" example:"100000"`
	Date         string                 `json:"date" example:"2021-01-01T00:00:00Z"`
	Automated    bool                   `json:"automated" example:"false"`
	ShouldVerify bool                   `json:"should_verify" example:"false"`
	Checked      bool                   `json:"checked" example:"false"`
	Category     customCategoryResponse `json:"category"`
	Account      customAccountResponse  `json:"account"`
	// Multicurrency: amount is in currency (the account's); amount_base = amount × fx_rate in the
	// user's base currency. Decimals as strings; null while there is no rate for the date.
	Currency        string  `json:"currency" example:"USD"`
	FxRate          *string `json:"fx_rate" example:"3870.41"`
	FxRateSource    *string `json:"fx_rate_source" example:"SFC_TRM"`
	AmountBase      *string `json:"amount_base" example:"387041"`
	TransferGroupID *string `json:"transfer_group_id" example:"0b8f..."`
	// Installments: card purchase deferred to N payments (null = none)
	Installments *int16 `json:"installments" example:"6"`
}

// newTransactionResponse is a helper function to create a response body for handling transaction data
func newTransactionResponse(transaction *domain.Transaction) transactionResponse {
	var newBank *customBankResponse
	var newType *accountTypeResponse

	if transaction.Account.Bank.ID != 0 || transaction.Account.Bank.Name != "" {
		bank := transaction.Account.Bank
		newBank = &customBankResponse{
			ID:   bank.ID,
			Name: bank.Name,
		}
	}

	if transaction.Account.Type.ID != 0 || transaction.Account.Type.Name != "" {
		accountType := transaction.Account.Type
		newType = &accountTypeResponse{
			ID:    accountType.ID,
			Type:  accountType.Name,
			Class: accountType.ClassOrDefault(),
		}
	}

	return transactionResponse{
		ID:           transaction.ID,
		Description:  transaction.Description,
		Expense:      transaction.Expense,
		Amount:       transaction.Amount,
		Date:         transaction.Date.In(enums.BogotaLocation).Format(enums.DateTimeUtc),
		Automated:    transaction.Automated,
		ShouldVerify: transaction.ShouldVerify,
		Checked:      transaction.Checked,
		Category: customCategoryResponse{
			ID:     transaction.Category.ID,
			Name:   transaction.Category.Name,
			Budget: transaction.Category.Budget,
			Emoji:  transaction.Category.Emoji,
			Income: &transaction.Category.Income,
		},
		Account: customAccountResponse{
			ID:             transaction.Account.ID,
			Name:           transaction.Account.Name,
			LastFourDigits: transaction.Account.LastFourDigits,
			Currency:       transaction.Account.Currency,
			Bank:           newBank,
			Type:           newType,
		},
		Currency:        transaction.Currency,
		FxRate:          decimalString(transaction.FxRate),
		FxRateSource:    transaction.FxRateSource,
		AmountBase:      decimalString(transaction.AmountBase),
		TransferGroupID: transaction.TransferGroupID,
		Installments:    transaction.Installments,
	}
}

type financialReportResponse struct {
	SavingsBalance metricResponse `json:"savings_balance"`
	CreditsBalance metricResponse `json:"credits_balance"`
	Income         metricResponse `json:"income"`
	Expenses       metricResponse `json:"expenses"`
}

type metricResponse struct {
	Value       float64  `json:"value" example:"1000000"`
	VsPastMonth *float64 `json:"vs_past_month" example:"70"`
}

func newFinancialReportResponse(report *domain.FinancialReport) financialReportResponse {
	return financialReportResponse{
		SavingsBalance: metricResponse{
			Value:       report.SavingsBalance.Value,
			VsPastMonth: report.SavingsBalance.Percentage,
		},
		CreditsBalance: metricResponse{
			Value:       report.CreditsBalance.Value,
			VsPastMonth: report.CreditsBalance.Percentage,
		},
		Income: metricResponse{
			Value:       report.Income.Value,
			VsPastMonth: report.Income.Percentage,
		},
		Expenses: metricResponse{
			Value:       report.Expenses.Value,
			VsPastMonth: report.Expenses.Percentage,
		},
	}
}

type balanceByAccountResponse struct {
	BalanceByAccount []domain.BalanceByAccount `json:"balance_by_account"`
}

func newBalanceByAccountResponse(balanceByAccount []domain.BalanceByAccount) balanceByAccountResponse {
	return balanceByAccountResponse{
		BalanceByAccount: balanceByAccount,
	}
}

type categoryReportResponse struct {
	Income  FlowReportResponse `json:"income"`
	Expense FlowReportResponse `json:"expense"`
}

type FlowReportResponse struct {
	Value  float64          `json:"value"`
	Budget float64          `json:"budget"`
	Left   float64          `json:"left"`
	Report []CategoryMetric `json:"report"`
}

type CategoryMetric struct {
	CategoryID uint64   `json:"category_id"`
	Name       string   `json:"name"`
	Emoji      string   `json:"emoji"`
	Value      float64  `json:"value"`
	Budget     float64  `json:"budget"`
	Usage      *float64 `json:"usage"`
	Left       *float64 `json:"left"`
}

func newCategoryExpenseReportResponse(report domain.CategoriesReport) categoryReportResponse {
	var (
		income  = make([]CategoryMetric, len(report.Income.Report))
		expense = make([]CategoryMetric, len(report.Expenses.Report))
	)

	for idx, category := range report.Income.Report {
		newIncome := CategoryMetric{
			CategoryID: category.CategoryID,
			Name:       category.Name,
			Emoji:      category.Emoji,
			Value:      category.Value,
			Budget:     category.Budget,
			Usage:      category.Usage,
			Left:       category.Left,
		}

		income[idx] = newIncome
	}

	for idx, category := range report.Expenses.Report {
		newExpense := CategoryMetric{
			CategoryID: category.CategoryID,
			Name:       category.Name,
			Emoji:      category.Emoji,
			Value:      category.Value,
			Budget:     category.Budget,
			Usage:      category.Usage,
			Left:       category.Left,
		}

		expense[idx] = newExpense
	}

	return categoryReportResponse{
		Income: FlowReportResponse{
			Value:  report.Income.Value,
			Budget: report.Income.Budget,
			Left:   report.Income.Left,
			Report: income,
		},
		Expense: FlowReportResponse{
			Value:  report.Expenses.Value,
			Budget: report.Expenses.Budget,
			Left:   report.Expenses.Left,
			Report: expense,
		},
	}
}

type FinancialAnalysisResponse struct {
	IncomeBudget  float64                 `json:"income_budget"`
	ExpenseBudget float64                 `json:"expense_budget"`
	SavingsBudget float64                 `json:"savings_budget"`
	Daily         DailyAnalysisResponse   `json:"daily"`
	Monthly       MonthlyAnalysisResponse `json:"monthly"`
}

type DailyAnalysisResponse struct {
	Income          []float64 `json:"income"`
	Expense         []float64 `json:"expense"`
	MTDIncome       []float64 `json:"mtd_income"`
	MTDExpense      []float64 `json:"mtd_expense"`
	MTDSavings      []float64 `json:"mtd_savings"`
	RSavingsBalance []float64 `json:"running_savings_balance"`
	RCreditsBalance []float64 `json:"running_credits_balance"`
	Date            []string  `json:"date"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type MonthlyAnalysisResponse struct {
	Income          []MonthlyAnalysisMetrics `json:"income"`
	Expense         []MonthlyAnalysisMetrics `json:"expense"`
	Savings         []MonthlyAnalysisMetrics `json:"savings"`
	RSavingsBalance []MonthlyAnalysisMetrics `json:"running_savings_balance"`
	RCreditsBalance []MonthlyAnalysisMetrics `json:"running_credits_balance"`
	Year            []uint16                 `json:"year"`
	Month           []uint16                 `json:"month"`
	UpdatedAt       time.Time                `json:"updated_at"`
}

type MonthlyAnalysisMetrics struct {
	Value      float64  `json:"value"`
	Diff       float64  `json:"diff"`
	Percentage *float64 `json:"percentage"`
	Usage      *float64 `json:"usage"`
	Left       *float64 `json:"left"`
}

func newFinancialAnalysisResponse(analysis *domain.FinancialAnalysis) FinancialAnalysisResponse {
	var (
		income   = make([]MonthlyAnalysisMetrics, len(analysis.Monthly.Income))
		expense  = make([]MonthlyAnalysisMetrics, len(analysis.Monthly.Expense))
		savings  = make([]MonthlyAnalysisMetrics, len(analysis.Monthly.Savings))
		rSavings = make([]MonthlyAnalysisMetrics, len(analysis.Monthly.RSavingsBalance))
		rCredits = make([]MonthlyAnalysisMetrics, len(analysis.Monthly.RCreditsBalance))
	)

	// TODO: validate i is index instead of value
	for i, _ := range analysis.Monthly.Month {
		income[i] = MonthlyAnalysisMetrics{
			Value:      analysis.Monthly.Income[i].Value,
			Diff:       analysis.Monthly.Income[i].Diff,
			Percentage: analysis.Monthly.Income[i].Percentage,
			Usage:      analysis.Monthly.Income[i].Usage,
			Left:       analysis.Monthly.Income[i].Left,
		}

		expense[i] = MonthlyAnalysisMetrics{
			Value:      analysis.Monthly.Expense[i].Value,
			Diff:       analysis.Monthly.Expense[i].Diff,
			Percentage: analysis.Monthly.Expense[i].Percentage,
			Usage:      analysis.Monthly.Expense[i].Usage,
			Left:       analysis.Monthly.Expense[i].Left,
		}

		savings[i] = MonthlyAnalysisMetrics{
			Value:      analysis.Monthly.Savings[i].Value,
			Diff:       analysis.Monthly.Savings[i].Diff,
			Percentage: analysis.Monthly.Savings[i].Percentage,
			Usage:      analysis.Monthly.Savings[i].Usage,
			Left:       analysis.Monthly.Savings[i].Left,
		}

		rSavings[i] = MonthlyAnalysisMetrics{
			Value:      analysis.Monthly.RSavingsBalance[i].Value,
			Diff:       analysis.Monthly.RSavingsBalance[i].Diff,
			Percentage: analysis.Monthly.RSavingsBalance[i].Percentage,
		}

		rCredits[i] = MonthlyAnalysisMetrics{
			Value:      analysis.Monthly.RCreditsBalance[i].Value,
			Diff:       analysis.Monthly.RCreditsBalance[i].Diff,
			Percentage: analysis.Monthly.RCreditsBalance[i].Percentage,
		}
	}

	return FinancialAnalysisResponse{
		IncomeBudget:  analysis.IncomeBudget,
		ExpenseBudget: analysis.ExpenseBudget,
		SavingsBudget: analysis.SavingsBudget,
		Daily: DailyAnalysisResponse{
			Income:          analysis.Daily.Income,
			Expense:         analysis.Daily.Expense,
			MTDIncome:       analysis.Daily.MTDIncome,
			MTDExpense:      analysis.Daily.MTDExpense,
			MTDSavings:      analysis.Daily.MTDSavings,
			RSavingsBalance: analysis.Daily.RSavingsBalance,
			RCreditsBalance: analysis.Daily.RCreditsBalance,
			Date:            analysis.Daily.Date,
			UpdatedAt:       analysis.Daily.UpdatedAt,
		},
		Monthly: MonthlyAnalysisResponse{
			Income:          income,
			Expense:         expense,
			Savings:         savings,
			RSavingsBalance: rSavings,
			RCreditsBalance: rCredits,
			Year:            analysis.Monthly.Year,
			Month:           analysis.Monthly.Month,
			UpdatedAt:       analysis.Monthly.UpdatedAt,
		},
	}
}

type CategoryAnalysisResponse struct {
	Budget  float64                 `json:"budget"`
	Monthly MonthlyCategoryResponse `json:"monthly"`
}

type MonthlyCategoryResponse struct {
	Expense []MonthlyCategoryMetrics `json:"expense"`
	Year    []uint16                 `json:"year"`
	Month   []uint16                 `json:"month"`
}

type MonthlyCategoryMetrics struct {
	Value float64  `json:"value"`
	Usage *float64 `json:"usage"`
	Left  *float64 `json:"left"`
}

func newCategoryAnalysisResponse(analysis *domain.CategoryAnalysis) CategoryAnalysisResponse {
	monthly := make([]MonthlyCategoryMetrics, len(analysis.Monthly))

	for i, metric := range analysis.Monthly {
		monthly[i] = MonthlyCategoryMetrics{
			Value: metric.Value,
			Usage: metric.Usage,
			Left:  metric.Left,
		}
	}

	return CategoryAnalysisResponse{
		Budget: analysis.Budget,
		Monthly: MonthlyCategoryResponse{
			Expense: monthly,
			Year:    analysis.Year,
			Month:   analysis.Month,
		},
	}
}

type AdminTransaction struct {
	ID              uint64  `json:"id" example:"1"`
	SourceMessageID *string `json:"source_message_id,omitempty" example:"18c2f0a1b2c3d4e5"`
}

// AdminSkippedTransaction is a transaction that was not inserted (idempotency or legacy dedupe)
type AdminSkippedTransaction struct {
	SourceMessageID *string `json:"source_message_id,omitempty" example:"18c2f0a1b2c3d4e5"`
	Reason          string  `json:"reason" example:"duplicate_message" enums:"duplicate_message,legacy_duplicate"`
}

type AdminTransactions struct {
	Transactions []AdminTransaction        `json:"transactions"`
	Skipped      []AdminSkippedTransaction `json:"skipped"`
}

func newAdminTransactionResponse(result *domain.AdminCreateResult) AdminTransactions {
	rsp := AdminTransactions{
		Transactions: []AdminTransaction{},
		Skipped:      []AdminSkippedTransaction{},
	}

	for _, transaction := range result.Created {
		rsp.Transactions = append(rsp.Transactions, AdminTransaction{
			ID:              transaction.ID,
			SourceMessageID: transaction.SourceMessageID,
		})
	}

	for _, skipped := range result.Skipped {
		rsp.Skipped = append(rsp.Skipped, AdminSkippedTransaction{
			SourceMessageID: skipped.SourceMessageID,
			Reason:          skipped.Reason,
		})
	}

	return rsp
}

// =============================================================================
// Accounts Report
// =============================================================================

type AccountsReportResponse struct {
	Balance  metricARResponse `json:"balance"`
	Income   metricARResponse `json:"income"`
	Expenses metricARResponse `json:"expenses"`
	Savings  metricARResponse `json:"savings"`
}

type metricARResponse struct {
	Value float64 `json:"value" example:"1000000"`
}

func newAccountsResponse(report *domain.AccountsReport) AccountsReportResponse {
	return AccountsReportResponse{
		Balance: metricARResponse{
			Value: report.Balance.Value,
		},
		Income: metricARResponse{
			Value: report.Income.Value,
		},
		Expenses: metricARResponse{
			Value: report.Expenses.Value,
		},
		Savings: metricARResponse{
			Value: report.Savings.Value,
		},
	}
}

// =============================================================================
// Accounts Analysis
// =============================================================================

type AccountAnalysisResponse struct {
	AccountID   uint64                 `json:"account_id"`
	AccountName string                 `json:"account_name"`
	Monthly     MonthlyAccountResponse `json:"monthly"`
}

type MonthlyAccountResponse struct {
	Balance []MonthlyAccountMetrics `json:"balance"`
	Year    []uint16                `json:"year"`
	Month   []uint16                `json:"month"`
}

type MonthlyAccountMetrics struct {
	Value      float64  `json:"value"`
	Diff       float64  `json:"diff"`
	Percentage *float64 `json:"percentage"`
}

func newAccountAnalysisResponse(analysis *domain.AccountAnalysis) AccountAnalysisResponse {
	balance := make([]MonthlyAccountMetrics, len(analysis.Balance))

	for i, metric := range analysis.Balance {
		balance[i] = MonthlyAccountMetrics{
			Value:      metric.Value,
			Diff:       metric.Diff,
			Percentage: metric.Percentage,
		}
	}

	return AccountAnalysisResponse{
		AccountID:   analysis.AccountID,
		AccountName: analysis.AccountName,
		Monthly: MonthlyAccountResponse{
			Balance: balance,
			Year:    analysis.Year,
			Month:   analysis.Month,
		},
	}
}
