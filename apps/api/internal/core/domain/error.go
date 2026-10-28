package domain

import (
	"errors"
)

// User Errors
var (
	// ErrDifferentConfirmPassword is an error for when the confirmation password is different
	ErrDifferentConfirmPassword = errors.New("confirm password is different")
	// ErrInvalidTokenUse is an error for when the token use is invalid
	ErrInvalidTokenUse = errors.New("invalid token use")
)

// User Extra Errors
var (
	// ErrInvalidUTCOffset is an error for when the UTC offset is invalid
	ErrInvalidUTCOffset = errors.New("invalid UTC offset, should be in the format -12 to +14")
	// ErrEmptyUserInfo is an error for when the user extra information is empty
	ErrEmptyUserInfo = errors.New("user extra information is empty")
)

// Category Errors
var (
	// ErrDefaultCategoryLocked is an error where the category cannot be updated or deleted
	ErrDefaultCategoryLocked = errors.New("cannot be update name or delete defaults categories")
	ErrNilCategory           = errors.New("category is nil")
)

// Transaction Errors
var (
	// ErrGettingOtherCategoryId is an error for when it is not possible to get the other category id
	ErrGettingOtherCategoryId = errors.New("error getting the other category id: admin flow")
)

// Social Login Errors
var (
	// ErrSocialSignIn is an error for when the social sign in fails
	ErrSocialSignIn = errors.New("error signing in with social account")
	// ErrSocialInvalidGrant is an error for when the social grant is invalid
	ErrSocialInvalidGrant = errors.New("invalid code provided")
	// ErrParsingAuthURL is an error for when the authentication URL fails to parse
	ErrParsingAuthURL = errors.New("error parsing authentication URL")
	// ErrMobileCallbackNotConfigured is an error for when the mobile callback URL is not configured
	ErrMobileCallbackNotConfigured = errors.New("mobile callback URL is not configured")
)

// Email Errors
var (
	// ErrEmailAlreadyConfigured is an error for when the email is already configured
	ErrEmailAlreadyConfigured = errors.New("email is already configured")
	// ErrGmailConfigurationFailed is an error for when the gmail configuration failed
	ErrGmailConfigurationFailed = errors.New("error configuring gmail api resource")
	// ErrUnsupportedEmailProvider is an error for when the email provider is not supported
	ErrUnsupportedEmailProvider = errors.New("unsupported email provider")
	// ErrEmailInvalidCode is an error for when the email code is invalid
	ErrEmailInvalidCode = errors.New("invalid email code")
	// ErrEmailInvalidClientId is an error for when the gmail client id is invalid
	ErrEmailInvalidClientId = errors.New("invalid email client id, check your configuration")
	// ErrEmailRateLimitExceeded is an error for when the gmail rate limit is exceeded
	ErrEmailRateLimitExceeded = errors.New("email rate limit exceeded, try again later")
	// ErrEmailAccessDenied is an error for when the gmail access is denied
	ErrEmailAccessDenied = errors.New("email access denied or user denied access")
	// ErrEmailInvalidRequest is an error for when the gmail request is invalid
	ErrEmailInvalidRequest = errors.New("invalid email request, check your configuration")
)

// Analysis Errors
var (
	// ErrWrongBalanceFilter is an error for when the balance filter is wrong
	ErrWrongBalanceFilter = errors.New("wrong balance filter in balance history request")
	// ErrInvalidDateRange is an error for when the provided date range is invalid
	ErrInvalidDateRange = errors.New("invalid date range, start date must be before end date")
)

// Multicurrency Errors
var (
	// ErrInvalidCurrency is an error for when the currency is not a supported ISO 4217 code
	ErrInvalidCurrency = errors.New("invalid currency")
	// ErrAccountCurrencyLocked is an error for when the currency of an account with transactions is changed
	ErrAccountCurrencyLocked = errors.New("account currency cannot change after its first transaction")
	// ErrInvalidTransfer is an error for when a transfer has wrong accounts or amounts
	ErrInvalidTransfer = errors.New("invalid transfer: two different accounts and positive amounts are required")
	// ErrInvalidFxRate is an error for when an exchange rate is not a positive number
	ErrInvalidFxRate = errors.New("invalid exchange rate")
	// ErrTransferLinked is an error for when a transaction is already a leg of a transfer, or the
	// pair to link is not an expense and an income in different accounts
	ErrTransferLinked = errors.New("the transactions cannot be linked as a transfer")
	// ErrInvalidValuation is an error for when a valuation has a negative value or a future date
	ErrInvalidValuation = errors.New("invalid valuation: a value of zero or more and a date until today are required")
	// ErrNotInvestmentAccount is an error for when a valuation is for an account that is not an investment
	ErrNotInvestmentAccount = errors.New("only investment accounts have valuations")
	// ErrValuationBeforeAccount is an error for when a valuation is older than its account
	ErrValuationBeforeAccount = errors.New("the valuation date is before the account was created")
)

// Account Type Errors
var (
	// ErrInvalidAccountType is an error for when the account type is invalid
	ErrInvalidAccountType = errors.New("invalid account type")
	// ErrAccountsNotFound is an error for when the account is not found
	ErrAccountsNotFound = errors.New("accounts not found")
)

// Token Errors
var (
	// ErrExpiredToken is an error for when the access token is expired
	ErrExpiredToken = errors.New("access token has expired")
	// ErrVerifyingTokenSignature is an error for when the token signature is invalid
	ErrVerifyingTokenSignature = errors.New("error verifying token signature")
	// ErrInvalidTokenClaims is an error for when the token claims are invalid
	ErrInvalidTokenClaims = errors.New("error with invalid token claims")
	// ErrEmptyAuthorizationHeader is an error for when the auth header is empty
	ErrEmptyAuthorizationHeader = errors.New("auth header is not provided")
	// ErrInvalidAuthorizationHeader is an error for when the auth header is invalid
	ErrInvalidAuthorizationHeader = errors.New("auth header format is invalid")
	// ErrInvalidAuthorizationType is an error for when the auth type is invalid
	ErrInvalidAuthorizationType = errors.New("auth type is not supported")
	// ErrEmptyAccessToken is an error for when the access token is empty
	ErrEmptyAccessToken = errors.New("token is empty")
	// ErrUnauthorized is an error for when the user is unauthorized
	ErrUnauthorized = errors.New("user is unauthorized to access the resource")
	// ErrForbidden is an error for when the user is forbidden to access the resource
	ErrForbidden = errors.New("user is forbidden to access the resource")
)

// General Errors
var (
	// ErrInternal is an error for when an internal service fails to process the request
	ErrInternal = errors.New("internal error")
	// ErrDataNotFound is an error for when requested data is not found
	ErrDataNotFound = errors.New("data not found")
	// ErrNoUpdatedData is an error for when no data is provided to update
	ErrNoUpdatedData = errors.New("no data to update")
	// ErrEmptyData is an error for when no data is provided
	ErrEmptyData = errors.New("no data is provided")
	// ErrConflictingData is an error for when data conflicts with existing data
	ErrConflictingData = errors.New("data conflicts with existing data in unique column")
	// ErrUniqueConstraintViolated is an error for when data conflicts with existing data
	ErrUniqueConstraintViolated = errors.New("unique constraint violated")
	// ErrSyntaxError is an error for when there is a syntax error in the query
	ErrSyntaxError = errors.New("syntax error in query")
	// ErrAmbiguousColumn is an error for when there is an ambiguous column in the query
	ErrAmbiguousColumn = errors.New("ambiguous column in query")
	// ErrValueTooLong is an error for when the value is too long for the type character varying
	ErrValueTooLong = errors.New("value too long for type character varying")
	// ErrInitializingDb is an error for when the database fails to initialize
	ErrInitializingDb = errors.New("error initializing database connection")
	// ErrPingDb is an error for when the database fails to ping
	ErrPingDb = errors.New("error pinging database")
	// ErrInitializingCache is an error for when the database fails to migrate
	ErrInitializingCache = errors.New("error initializing cache connection")
	// ErrLoadingEnv is an error for when the environment variables fail to load
	ErrLoadingEnv = errors.New("error loading environment variables")
	// ErrRunningServer is an error for when the server fails to run
	ErrRunningServer = errors.New("error running the server")
	// ErrRegisteringValidator is an error for when the user registration fails
	ErrRegisteringValidator = errors.New("error registering validator")
	// ErrInitializingDriver is an error for when the database migration driver fails to initialize
	ErrInitializingDriver = errors.New("error initializing migration driver")
	// ErrInstantiatingMigrator is an error for when the database migration fails
	ErrInstantiatingMigrator = errors.New("error instantiating migrator")
	// ErrMigration is an error for when the database migration fails
	ErrMigration = errors.New("error migrating database")
	//ErrRemovingMigration is an error for when the database migration fails
	ErrRemovingMigration = errors.New("error removing migration")
	// ErrInvalidConfig is an error for when the configuration is invalid
	ErrInvalidConfig = errors.New("invalid configuration")
	// ErrBeginTrx is an error for when the transaction fails to begin
	ErrBeginTrx = errors.New("error beginning transaction")
)

// Auth Errors (codes and messages kept from the previous identity provider: the front compares them)
var (
	// UsernameExistsException is an error for when the user already exists
	UsernameExistsException = "UsernameExistsException"
	// ErrUsernameExistsException is an error for when the user already exists
	ErrUsernameExistsException = errors.New("user already exists")

	// LimitExceededException is an error for when the limit to confirm a forgotten request is exceeded
	LimitExceededException = "LimitExceededException"
	// ErrLimitExceededException is an error for when the limit to confirm a forgotten request is exceeded
	ErrLimitExceededException = errors.New("limit exceeded, too many requests")

	// InvalidPasswordException is an error for when the password doesn't meet the requirements
	InvalidPasswordException = "InvalidPasswordException"
	// ErrInvalidPasswordException is an error for when the password is invalid
	ErrInvalidPasswordException = errors.New("password doesnt meet the requirements")

	// CodeMismatchException is an error for when the confirmation code is wrong
	CodeMismatchException = "CodeMismatchException"
	// ErrCodeMismatchException is an error for when the confirmation code is wrong
	ErrCodeMismatchException = errors.New("invalid verification code provided")

	// NotAuthorizedException is an error for when the user is not authorized
	NotAuthorizedException = "NotAuthorizedException"
	// ErrNotAuthorizedException is an error for when the user is not authorized
	ErrNotAuthorizedException = errors.New("user is not authorized, incorrect username or password")

	// ExpiredCodeException is an error for when the confirmation code is expired
	ExpiredCodeException = "ExpiredCodeException"
	// ErrExpiredCodeException is an error for when the confirmation code is expired
	ErrExpiredCodeException = errors.New("confirmation code has expired")

	// UserNotFoundException is an error for when the user is not found
	UserNotFoundException = "UserNotFoundException"
	// ErrUserNotFoundException is an error for when the user is not found
	ErrUserNotFoundException = errors.New("user not found")

	// UserNotConfirmedException is an error for when the user is not confirmed
	UserNotConfirmedException = "UserNotConfirmedException"
	// ErrUserNotConfirmedException is an error for when the user is not confirmed
	ErrUserNotConfirmedException = errors.New("user is not confirmed")

	// PasswordResetRequiredException is an error for when the user needs to reset the password
	PasswordResetRequiredException = "PasswordResetRequiredException"
	// ErrPasswordResetRequiredException is an error for when the user needs to reset the password
	ErrPasswordResetRequiredException = errors.New("user needs to reset the password")

	// ExpiredTokenException is an error for when the token credential is expired
	ExpiredTokenException = "ExpiredTokenException"
	// ErrExpiredTokenException is an error for when the token credential is expired
	ErrExpiredTokenException = errors.New("token credential has expired")
)
