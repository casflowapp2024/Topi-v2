package server

import (
	"cash-flow/internal/adapter/api"
	"cash-flow/internal/adapter/auth/cognito"
	cognitorepo "cash-flow/internal/adapter/auth/cognito/repository"
	"cash-flow/internal/adapter/auth/jwt"
	"cash-flow/internal/adapter/auth/social"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/email"
	"cash-flow/internal/adapter/email/gmail"
	"cash-flow/internal/adapter/email/outlook"
	"cash-flow/internal/adapter/email/saturn"
	"cash-flow/internal/adapter/handler/http"
	"cash-flow/internal/adapter/sqs"
	"cash-flow/internal/adapter/storage/postgres"
	dbrepository "cash-flow/internal/adapter/storage/postgres/repository"
	dbtransaction "cash-flow/internal/adapter/storage/postgres/transaction"
	"cash-flow/internal/core/service"
	"context"
	"log/slog"
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

	// Init token resource
	token := jwt.New(settings.Token)

	// Init cognito client
	auth := cognito.New(settings.Auth)

	// Transaction Manager
	transactionManager := dbtransaction.NewTransactionManager(db)

	// Health
	healthHandler := http.NewHealthHandler()

	// Category
	categoryRepo := dbrepository.NewCategoryRepository(db)
	categoryService := service.NewCategoryService(categoryRepo)
	categoryHandler := http.NewCategoryHandler(categoryService)

	// Social Auth
	socialAuthClient := api.NewHttpClient(settings.Social.Http.Timeout)
	socialAuthRepo := social.NewSocialAuthRepository(socialAuthClient, settings.Social)

	// User
	userRepo := cognitorepo.NewUserRepository(auth)
	userService := service.NewUserService(userRepo, token, socialAuthRepo)
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

	// Email
	gmailClient := gmail.NewGmailAPI(settings.Gmail)
	outlookApiClient := api.NewHttpClient(settings.Social.Http.Timeout)
	outlookClient := outlook.NewOutlookAPI(outlookApiClient, settings.Outlook)
	sqsClient := sqs.NewSQSClient(settings.SQS.Region, settings.SQS.QueueURL)
	saturnClient := saturn.NewSaturnAPI(sqsClient, settings.Saturn)
	emailResource := email.NewUserEmail(gmailClient, outlookClient, saturnClient)

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
			Email:                  emailHandler,
			Initialization:         initDevHandler,
			CategoryInitialization: InitHandler,
		},
		Resources: &Resources{
			DB: db,
		},
	}
}
