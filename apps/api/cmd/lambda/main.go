package main

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/handler/http"
	"cash-flow/internal/adapter/handler/lambda"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/adapter/server"
	"sync"
)

// AppInstance holds the initialized application components
type AppInstance struct {
	Injector *server.Injector
	Router   *http.Router
}

var (
	app  *AppInstance
	once sync.Once
)

func init() {
	once.Do(func() {
		settings := config.New()
		injector := server.NewInjector(settings)

		// Start the HTTP router
		router, _ := http.NewRouter(settings.HTTP)

		// Set logger
		logger.Set(settings.App)

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
			EmailHandler:          injector.Handlers.Email,
			InitDevHandler:        injector.Handlers.Initialization,
			InitializationHandler: injector.Handlers.CategoryInitialization,
			Router:                router.Router,
		}

		routes.Init(settings.App.Env)

		app = &AppInstance{
			Injector: injector,
			Router:   router,
		}
	})
}

func main() {
	// Defer closing the resources
	defer app.Injector.Resources.DB.Close()

	// Adapt the router to the lambda
	lambdaAdapter := lambda.NewHttpLambdaAdapter(app.Router.Router)

	// Serve the lambda
	lambdaAdapter.Serve()
}
