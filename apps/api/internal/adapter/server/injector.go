package server

import (
	"cash-flow/internal/adapter/api"
	"cash-flow/internal/adapter/auth/jwt"
	"cash-flow/internal/adapter/auth/password"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/email"
	"cash-flow/internal/adapter/email/gmail"
	"cash-flow/internal/adapter/email/jobqueue"
	"cash-flow/internal/adapter/email/outlook"
	"cash-flow/internal/adapter/handler/http"
	"cash-flow/internal/adapter/ratelimit"
	"cash-flow/internal/adapter/storage/postgres"
	dbrepository "cash-flow/internal/adapter/storage/postgres/repository"
	dbtransaction "cash-flow/internal/adapter/storage/postgres/transaction"
	"cash-flow/internal/core/service"
	"context"
	"log/slog"
	"time"
)

type Injector struct {
	Handlers  *Handlers
	Resources *Resources
}

type Handlers struct {
	Health                 *http.HealthHandler
	User                   *http.UserHandler
	UserExtra              *http.UserExtraHandler
	Category               *http.CategoryHandler
	Bank                   *http.BankHandler
	Account                *http.AccountHandler
	Transaction            *http.TransactionHandler
	AccountType            *http.AccountTypeHandler
	Analysis               *http.AnalysisHandler
	Fx                     *http.FxHandler
	Valuation              *http.ValuationHandler
	CurrencyChange         *http.CurrencyChangeHandler
	CreditCard             *http.CreditCardHandler
	Email                  *http.EmailHandler
	Initialization         *http.InitDevHandler
	CategoryInitialization *http.InitializationHandler
}

type Resources struct {
	DB *postgres.DB
}

func NewInjector(settings *config.Configuration) *Injector {
	slog.Info("starting the application", "app", settings.App.Name, "env", settings.App.Env)

	// Init database
	ctx := context.Background()

	// Init database
	db := postgres.New(ctx, settings.DB)

	// Migrate database
	db.Migrate()

	// Transaction Manager
	transactionManager := dbtransaction.NewTransactionManager(db)

	// Health
	healthHandler := http.NewHealthHandler(service.NewHealthService(dbrepository.NewHealthRepository(db)))

	// Category
	categoryRepo := dbrepository.NewCategoryRepository(db)
	categoryService := service.NewCategoryService(categoryRepo)
	categoryHandler := http.NewCategoryHandler(categoryService)

	// User (own auth: email + password)
	userRepo := dbrepository.NewUserRepository(db)
	userService := service.NewUserService(
		userRepo,
		jwt.New(settings.Auth),
		dbrepository.NewRefreshTokenRepository(db),
		dbrepository.NewAuthEventRepository(db),
		password.New(password.DefaultParams),
		ratelimit.NewMemory(settings.Auth.RateLimitPerMinute, time.Minute),
		service.AuthSettings{
			RefreshTokenTTL:      settings.Auth.RefreshTokenTTL,
			InitialPasswordUntil: settings.Auth.InitialPasswordUntil,
			InternalAPIKey:       settings.Auth.InternalAPIKey,
		},
	)
	userHandler := http.NewUserHandler(userService)

	// UserExtra
	userExtraRepo := dbrepository.NewUserExtraRepository(db)
	userExtraService := service.NewUserExtraService(userExtraRepo, userRepo)
	userExtraHandler := http.NewUserExtraHandler(userExtraService)

	// Bank
	bankRepo := dbrepository.NewBankRepository(db)
	bankService := service.NewBankService(bankRepo)
	bankHandler := http.NewBankHandler(bankService)

	// AccountType
	accountTypeRepo := dbrepository.NewAccountTypeRepository(db)
	accountTypeService := service.NewAccountTypeService(accountTypeRepo)
	accountTypeHandler := http.NewAccountTypeHandler(accountTypeService)

	// Transaction
	transactionRepo := dbrepository.NewTransactionRepository(db)
	transactionService := service.NewTransactionService(transactionRepo, userService, categoryService)
	transactionHandler := http.NewTransactionHandler(transactionService)

	// Account
	accountRepo := dbrepository.NewAccountRepository(db)
	accountService := service.NewAccountService(accountRepo, transactionRepo)
	accountHandler := http.NewAccountHandler(accountService)

	// Analysis
	analysisRepo := dbrepository.NewAnalysisRepository(db)
	analysisService := service.NewAnalysisService(analysisRepo)
	analysisHandler := http.NewAnalysisHandler(analysisService)

	// Fx: currencies, exchange rates and net worth
	fxRepo := dbrepository.NewFxRepository(db)
	fxService := service.NewFxService(fxRepo)
	fxHandler := http.NewFxHandler(fxService)

	// Valuations of investment accounts and their performance
	valuationRepo := dbrepository.NewValuationRepository(db)
	valuationService := service.NewValuationService(valuationRepo)
	valuationHandler := http.NewValuationHandler(valuationService)

	// Currency changes of accounts and of the user, closing accounts
	currencyChangeRepo := dbrepository.NewCurrencyChangeRepository(db)
	currencyChangeService := service.NewCurrencyChangeService(currencyChangeRepo)
	currencyChangeHandler := http.NewCurrencyChangeHandler(currencyChangeService)

	// Credit cards: terms and billing period
	creditCardRepo := dbrepository.NewCreditCardRepository(db)
	creditCardService := service.NewCreditCardService(creditCardRepo)
	creditCardHandler := http.NewCreditCardHandler(creditCardService)

	// Email
	gmailClient := gmail.NewGmailAPI(settings.Gmail)
	outlookApiClient := api.NewHttpClient(settings.Outlook.Http.Timeout)
	outlookClient := outlook.NewOutlookAPI(outlookApiClient, settings.Outlook)
	emailJobRepo := dbrepository.NewEmailJobRepository(db)
	emailQueue := jobqueue.New(emailJobRepo)
	emailResource := email.NewUserEmail(gmailClient, outlookClient, emailQueue)

	emailRepository := dbrepository.NewEmailRepository(db)
	emailService := service.NewEmailService(emailRepository, emailResource, accountRepo, accountService, transactionManager)
	emailHandler := http.NewEmailHandler(emailService)

	// Initialization Dev
	initDevHandler := http.NewDevHandler(
		categoryService,
		bankService,
		accountTypeService,
		accountService,
		transactionService,
	)

	// Resource Initialization
	InitHandler := http.NewInitializationHandler(categoryService)

	return &Injector{
		Handlers: &Handlers{
			Health:                 healthHandler,
			User:                   userHandler,
			UserExtra:              userExtraHandler,
			Category:               categoryHandler,
			Bank:                   bankHandler,
			Account:                accountHandler,
			AccountType:            accountTypeHandler,
			Transaction:            transactionHandler,
			Analysis:               analysisHandler,
			Fx:                     fxHandler,
			Valuation:              valuationHandler,
			CurrencyChange:         currencyChangeHandler,
			CreditCard:             creditCardHandler,
			Email:                  emailHandler,
			Initialization:         initDevHandler,
			CategoryInitialization: InitHandler,
		},
		Resources: &Resources{
			DB: db,
		},
	}
}
