// @title           Cash Flow API
// @version         1.0
// @description     API for managing cash flow operations.
// @termsOfService  http://yourdomain.com/terms/

// @contact.name   API Support
// @contact.url    http://yourdomain.com/support
// @contact.email  support@yourdomain.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description "Bearer <access_token>"

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-API-Key
// @description Internal callers (worker): INTERNAL_API_KEY

package main

import (
	_ "cash-flow/docs"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/handler/http"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/adapter/server"
	"cash-flow/internal/core/domain"
	"context"
	"log/slog"
	"os"
	"time"
)

func main() {
	settings := config.New()

	// Fail fast on missing or invalid auth settings (e.g. JWT_SECRET)
	if err := settings.Validate(); err != nil {
		slog.Error(domain.ErrInvalidConfig.Error(), "error", err)
		os.Exit(1)
	}

	injector := server.NewInjector(settings)

	// Defer closing the resources
	defer injector.Resources.DB.Close()

	// Set logger
	logger.Set(settings.App)

	// Bank catalog (plan/33): loaded before serving, refreshed every few minutes
	injector.Resources.BankCatalog.Start(context.Background())
	// Send the emails of the outbox in background
	go injector.Resources.Mail.Run(context.Background(), injector.Resources.MailInterval)
	// Queue the monthly summaries (first days of the month, opt-in)
	go injector.Resources.Notifications.RunScheduler(context.Background(), time.Hour)
	// "Todavía no vemos movimientos de tu banco" (plan/27 §C): once per connection, after 48 h without transactions
	go injector.Resources.Reading.RunScheduler(context.Background(), time.Hour)

	// Start the HTTP server
	router, listenAddr := http.NewRouter(settings.HTTP)

	// Register the routes
	routes := http.Routes{
		HealthHandler:         injector.Handlers.Health,
		UserHandler:           injector.Handlers.User,
		UserExtraHandler:      injector.Handlers.UserExtra,
		CategoryHandler:       injector.Handlers.Category,
		BankHandler:           injector.Handlers.Bank,
		AccountTypeHandler:    injector.Handlers.AccountType,
		AccountHandler:        injector.Handlers.Account,
		TransactionHandler:    injector.Handlers.Transaction,
		AnalysisHandler:       injector.Handlers.Analysis,
		FxHandler:             injector.Handlers.Fx,
		ValuationHandler:      injector.Handlers.Valuation,
		CurrencyChangeHandler: injector.Handlers.CurrencyChange,
		CreditCardHandler:     injector.Handlers.CreditCard,
		EmailHandler:          injector.Handlers.Email,
		Activity:              injector.Handlers.Activity,
		MailHandler:           injector.Handlers.Mail,
		AdminHandler:          injector.Handlers.Admin,
		BillingHandler:        injector.Handlers.Billing,
		ReadingHandler:        injector.Handlers.Reading,
		FeedbackHandler:       injector.Handlers.Feedback,
		ReactivationHandler:   injector.Handlers.Reactivation,
		LaunchHandler:         injector.Handlers.Launch,
		BankCatalogHandler:    injector.Handlers.BankCatalog,
		InitDevHandler:        injector.Handlers.Initialization,
		InitializationHandler: injector.Handlers.CategoryInitialization,
		Router:                router.Router,
	}

	routes.Init(settings.App.Env)
	router.Serve(listenAddr)
}
