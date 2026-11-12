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
	"cash-flow/internal/adapter/mail/logmailer"
	"cash-flow/internal/adapter/mail/resend"
	"cash-flow/internal/adapter/mail/templates"
	"cash-flow/internal/adapter/ratelimit"
	"cash-flow/internal/adapter/storage/postgres"
	dbrepository "cash-flow/internal/adapter/storage/postgres/repository"
	dbtransaction "cash-flow/internal/adapter/storage/postgres/transaction"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/core/service"
	"cash-flow/internal/enums"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"log/slog"
	"os"
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
	Mail                   *http.MailHandler
	Initialization         *http.InitDevHandler
	CategoryInitialization *http.InitializationHandler
	// Activity records the daily activity in AuthMiddleware
	Activity port.ActivityTracker
}

type Resources struct {
	DB *postgres.DB
	// Mail processes email_outbox in background (started by main)
	Mail *service.MailOutboxService
	// Notifications queues the monthly summaries in background (started by main)
	Notifications *service.NotificationPrefsService
	// MailInterval is how often the outbox is processed
	MailInterval time.Duration
}

func NewInjector(settings *config.Configuration) *Injector {
	slog.Info("starting the application", "app", settings.App.Name, "env", settings.App.Env)

	// Init database
	ctx := context.Background()

	// Init database
	db := postgres.New(ctx, settings.DB)

	// Migrate database
	db.Migrate()

	// Founders: users created before FOUNDER_CUTOFF are eligible (never unmarked, nobody is deleted)
	markFounderEligible(ctx, settings.Metrics, dbrepository.NewFounderRepository(db))

	// Mail: every email goes through the Mailer port and email_outbox
	mailService := newMailService(settings, db)

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
	// codes by email: at most 3 per email every 15 minutes (plus the general limit per IP)
	userService.SetMail(mailService, dbrepository.NewAuthCodeRepository(db), ratelimit.NewMemory(3, 15*time.Minute))
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

	// Email preferences, unsubscribe links and monthly summary (numbers computed at send time)
	notificationService := service.NewNotificationService(
		dbrepository.NewNotificationRepository(db),
		mailService,
		analysisService,
		service.NotificationSettings{
			UnsubscribeSecret: deriveKey(settings.Auth.JWTSecret, "topi-unsubscribe-v1"),
			APIBaseURL:        settings.Mail.APIBaseURL,
		},
	)
	mailService.SetUnsubscribeLinker(notificationService)
	mailService.SetEnricher(domain.TemplateMonthlySummary, notificationService)
	mailHandler := http.NewMailHandler(notificationService, mailService,
		resend.NewWebhookParser(settings.Mail.ResendWebhookSecret), settings.Mail.AppBaseURL)

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
	emailService.SetMail(mailService)
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
			Mail:                   mailHandler,
			Initialization:         initDevHandler,
			CategoryInitialization: InitHandler,
			Activity:               service.NewActivityService(dbrepository.NewActivityRepository(db)),
		},
		Resources: &Resources{
			DB:            db,
			Mail:          mailService,
			Notifications: notificationService,
			MailInterval:  settings.Mail.OutboxInterval,
		},
	}
}

// newMailService wires the mailer chosen by MAIL_PROVIDER (log by default: nothing is sent)
func newMailService(settings *config.Configuration, db *postgres.DB) *service.MailOutboxService {
	renderer, err := templates.New()
	if err != nil {
		slog.Error("mail templates are broken", "error", err)
		os.Exit(1)
	}

	var mailer port.Mailer
	switch settings.Mail.Provider {
	case config.MailProviderResend:
		mailer = resend.New(settings.Mail.ResendAPIKey, "")
	default:
		// only local logs the body (it may carry a code); development/prod log metadata only
		mailer = logmailer.New(settings.App.Env == enums.Local)
	}
	slog.Info("mail provider", "provider", settings.Mail.Provider, "only_to", len(settings.Mail.OnlyTo) > 0)

	return service.NewMailService(
		dbrepository.NewOutboxRepository(db),
		mailer,
		renderer,
		service.MailSettings{
			From:       settings.Mail.From,
			ReplyTo:    settings.Mail.ReplyTo,
			DailyQuota: settings.Mail.DailyQuota,
			OnlyTo:     settings.Mail.OnlyTo,
			AppBaseURL: settings.Mail.AppBaseURL,
			APIBaseURL: settings.Mail.APIBaseURL,
		},
	)
}

// deriveKey derives a purpose specific key from a secret (HMAC-SHA256), so one variable signs
// different things without reusing the same key
func deriveKey(secret, purpose string) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(purpose))
	return mac.Sum(nil)
}

// markFounderEligible applies FOUNDER_CUTOFF at startup. It is idempotent and only adds the mark.
func markFounderEligible(ctx context.Context, settings *config.Metrics, repo port.FounderRepository) {
	if settings == nil || settings.FounderCutoff == nil {
		slog.Info("founders: FOUNDER_CUTOFF not set, nobody is marked as eligible")
		return
	}
	marked, err := repo.MarkEligible(ctx, *settings.FounderCutoff)
	if err != nil {
		slog.Error("founders: could not mark the eligible users", "error", err)
		return
	}
	slog.Info("founders: eligible users marked", "cutoff", settings.FounderCutoff.Format(time.RFC3339), "new", marked)
}
