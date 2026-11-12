package http

import (
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Routes struct {
	HealthHandler         *HealthHandler
	UserHandler           *UserHandler
	UserExtraHandler      *UserExtraHandler
	CategoryHandler       *CategoryHandler
	BankHandler           *BankHandler
	AccountTypeHandler    *AccountTypeHandler
	AccountHandler        *AccountHandler
	TransactionHandler    *TransactionHandler
	AnalysisHandler       *AnalysisHandler
	FxHandler             *FxHandler
	ValuationHandler      *ValuationHandler
	CurrencyChangeHandler *CurrencyChangeHandler
	CreditCardHandler     *CreditCardHandler
	EmailHandler          *EmailHandler
	MailHandler           *MailHandler
	InitDevHandler        *InitDevHandler
	InitializationHandler *InitializationHandler
	AdminHandler          *AdminHandler
	// Activity records the daily activity of the authenticated users (optional)
	Activity port.ActivityTracker
	Router   *gin.Engine
}

// auth is the AuthMiddleware of every authenticated group (records the daily activity)
func (r *Routes) auth() gin.HandlerFunc {
	return AuthMiddleware(r.UserHandler.svc, r.Activity)
}

func (r *Routes) HealthRoutes() {
	health := r.Router.Group("/")
	{
		health.GET("/", r.HealthHandler.CheckHealth)
		health.GET("/health", r.HealthHandler.Health)
	}
}

func (r *Routes) DocRoutes(environment string) {
	if environment != enums.Production {
		doc := r.Router.Group("/docs")
		{
			doc.GET("/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
		}
	}
}

func (r *Routes) UserRoutes() {
	user := r.Router.Group("/users")

	user.POST("/signup", r.UserHandler.Register)
	user.POST("/login", r.UserHandler.Login)
	// closed: always 401 (users without password recover it with a code)
	user.POST("/set-initial-password", r.UserHandler.SetInitialPassword)
	user.POST("/password/forgot", r.UserHandler.ForgotPassword)
	user.POST("/password/reset", r.UserHandler.ResetPassword)
	user.POST("/refresh", r.UserHandler.Refresh)
	user.POST("/logout", r.UserHandler.Logout)
	// no-op 200 kept for compatibility (there is no email verification)
	user.POST("/confirm", r.UserHandler.ConfirmUser)
	user.POST("/resend-confirmation", r.UserHandler.ResendConfirmationCode)

	authUser := user.Group("/").Use(r.auth())
	{
		authUser.GET("/", r.UserHandler.GetUser)
		authUser.PUT("/", r.UserHandler.UpdateUser)
		authUser.PUT("/password", r.UserHandler.ChangePassword)
		authUser.POST("/email/verify", r.UserHandler.VerifyEmail)
		authUser.POST("/email/verify/resend", r.UserHandler.SendVerification)
	}
}

func (r *Routes) CategoryRoutes() {
	AuthCategories := r.Router.Group("/categories").Use(r.auth())
	{
		AuthCategories.POST("/create", r.CategoryHandler.CreateCategory)
		AuthCategories.GET("/:id", r.CategoryHandler.GetCategory)
		AuthCategories.GET("/list", r.CategoryHandler.GetCategories)
		AuthCategories.PUT("/:id", r.CategoryHandler.UpdateCategory)
		AuthCategories.DELETE("/:id", r.CategoryHandler.DeleteCategory)
	}
}

func (r *Routes) BanksRoutes() {
	AuthBanks := r.Router.Group("/banks").Use(r.auth())
	{
		AuthBanks.GET("/:id", r.BankHandler.GetBank)
		AuthBanks.GET("/list", r.BankHandler.GetBanks)
		AuthBanks.POST("/create", r.BankHandler.CreateBank)
		AuthBanks.PUT("/:id", r.BankHandler.UpdateBank)
		AuthBanks.DELETE("/:id", r.BankHandler.DeleteBank)
		AuthBanks.GET("/official", r.BankHandler.GetOfficialBanks)
	}
}

func (r *Routes) AccountTypeRoutes() {
	AuthType := r.Router.Group("/account-types").Use(r.auth())
	{
		AuthType.GET("/:id", r.AccountTypeHandler.GetAccountType)
		AuthType.GET("/list", r.AccountTypeHandler.GetAccountTypes)

		admin := AuthType.Use(AdminMiddleware())
		{
			admin.POST("admin/create", r.AccountTypeHandler.CreateAccountType)
			admin.PUT("admin/:id", r.AccountTypeHandler.UpdateAccountType)
			admin.DELETE("admin/:id", r.AccountTypeHandler.DeleteAccountType)
		}
	}
}

func (r *Routes) AccountsRoutes() {
	AuthAccounts := r.Router.Group("/accounts").Use(r.auth())
	{
		AuthAccounts.POST("/create", r.AccountHandler.CreateAccount)
		AuthAccounts.PUT("/:id/calculate/initial-balance", r.AccountHandler.CalculateInitialBalance)
		AuthAccounts.GET("/:id", r.AccountHandler.GetAccount)
		AuthAccounts.GET("/list", r.AccountHandler.GetAccounts)
		AuthAccounts.PUT("/:id", r.AccountHandler.UpdateAccount)
		AuthAccounts.DELETE("/:id", r.AccountHandler.DeleteAccount)
		AuthAccounts.GET("/:id/valuations", r.ValuationHandler.ListValuations)
		AuthAccounts.POST("/:id/valuations", r.ValuationHandler.SaveValuation)
		AuthAccounts.DELETE("/:id/valuations/:valuation_id", r.ValuationHandler.DeleteValuation)
		AuthAccounts.POST("/:id/currency", r.CurrencyChangeHandler.ChangeAccountCurrency)
		AuthAccounts.GET("/:id/currency-changes", r.CurrencyChangeHandler.ListAccountCurrencyChanges)
		AuthAccounts.POST("/:id/currency-changes/:change_id/undo", r.CurrencyChangeHandler.UndoAccountCurrencyChange)
		AuthAccounts.POST("/:id/close", r.CurrencyChangeHandler.CloseAccount)
		AuthAccounts.POST("/:id/reopen", r.CurrencyChangeHandler.ReopenAccount)
		AuthAccounts.GET("/:id/credit-card", r.CreditCardHandler.GetCreditCard)
		AuthAccounts.PUT("/:id/credit-card", r.CreditCardHandler.SaveCreditCard)
		AuthAccounts.GET("/:id/credit-card/cycles", r.CreditCardHandler.ListCreditCardCycles)
	}

	admin := AuthAccounts.Use(AdminMiddleware())
	{
		admin.GET("admin/list", r.AccountHandler.AdminGetAccounts)
		admin.GET("admin/list/by-bank", r.AccountHandler.AdminGetAccountsByBank)
	}
}

func (r *Routes) TransactionRoutes() {
	AuthTransactions := r.Router.Group("/transactions").Use(r.auth())
	{
		AuthTransactions.POST("/create", r.TransactionHandler.CreateTransaction)
		AuthTransactions.POST("/transfer", r.TransactionHandler.CreateTransfer)
		AuthTransactions.GET("/transfer/candidates", r.TransactionHandler.ListTransferCandidates)
		AuthTransactions.GET("/installments", r.TransactionHandler.ListInstallments)
		AuthTransactions.POST("/:id/installments", r.TransactionHandler.SetInstallments)
		AuthTransactions.POST("/transfer/dismiss", r.TransactionHandler.DismissTransferCandidate)
		AuthTransactions.DELETE("/transfer/:group", r.TransactionHandler.UnlinkTransfer)
		AuthTransactions.POST("/:id/transfer", r.TransactionHandler.LinkTransfer)
		AuthTransactions.POST("/:id/transfer/dismiss", r.TransactionHandler.DismissCounterpart)
		AuthTransactions.GET("/:id/transfer/suggestion", r.TransactionHandler.SuggestCounterpart)
		AuthTransactions.GET("/:id", r.TransactionHandler.GetTransaction)
		AuthTransactions.GET("/list", r.TransactionHandler.ListTransactions)
		AuthTransactions.PUT("/:id", r.TransactionHandler.UpdateTransaction)
		AuthTransactions.DELETE("/:id", r.TransactionHandler.DeleteTransaction)

		admin := AuthTransactions.Use(AdminMiddleware())
		{
			admin.POST("admin/create", r.TransactionHandler.AdminCreateTransactions)
		}
	}
}

func (r *Routes) AnalysisRoutes() {
	AuthAnalysis := r.Router.Group("/analysis").Use(r.auth())
	{
		AuthAnalysis.GET("/financial-report", r.AnalysisHandler.GetFinancialReport)
		AuthAnalysis.GET("/net-worth", r.FxHandler.GetNetWorth)
		AuthAnalysis.GET("/net-worth/history", r.FxHandler.GetNetWorthHistory)
		AuthAnalysis.GET("/investments", r.ValuationHandler.GetInvestments)
		AuthAnalysis.GET("/credit-cards", r.CreditCardHandler.ListCreditCards)
		AuthAnalysis.GET("/accounts-balance", r.AnalysisHandler.GetBalanceByAccount)
		AuthAnalysis.GET("/financial-analysis", r.AnalysisHandler.GetFinancialAnalysis)
		AuthAnalysis.POST("/categories-report", r.AnalysisHandler.GetCategoriesReport)
		AuthAnalysis.GET("/category-analysis", r.AnalysisHandler.GetCategoryAnalysis)
		AuthAnalysis.GET("/card-charges", r.AnalysisHandler.GetCardCharges)
		AuthAnalysis.POST("/accounts-report", r.AnalysisHandler.GetAccountsReport)
		AuthAnalysis.GET("/account-analysis", r.AnalysisHandler.GetAccountAnalysis)
	}
}

func (r *Routes) InitializationRoutes() {
	AuthInit := r.Router.Group("/init").Use(r.auth())
	{
		AuthInit.POST("/data", r.InitDevHandler.Init)
		AuthInit.POST("/resources", r.InitializationHandler.InitializeResources)
	}
}

func (r *Routes) UserExtraRoutes() {
	AuthUserExtra := r.Router.Group("/user-extra").Use(r.auth())
	{
		AuthUserExtra.POST("create", r.UserExtraHandler.CreateUserExtra)
		AuthUserExtra.GET("", r.UserExtraHandler.GetUserExtra)
		AuthUserExtra.PUT("", r.UserExtraHandler.UpdateUserExtra)
		AuthUserExtra.POST("base-currency", r.CurrencyChangeHandler.ChangeBaseCurrency)
	}

	admin := AuthUserExtra.Use(AdminMiddleware())
	{
		admin.DELETE("admin/:id", r.UserExtraHandler.DeleteUserExtra)
		admin.PUT("admin/read-email", r.UserExtraHandler.AdminUpdateReadEmail)
	}
}

func (r *Routes) EmailRoutes() {
	AuthEmail := r.Router.Group("/email").Use(r.auth())
	{
		AuthEmail.GET("/auth-url", r.EmailHandler.GetAuthURL)
		AuthEmail.POST("/register", r.EmailHandler.RegisterEmail)
		AuthEmail.GET("/list", r.EmailHandler.GetListEmail)
		AuthEmail.PUT("/:id", r.EmailHandler.UpdateEmail)
		AuthEmail.DELETE("/:id", r.EmailHandler.DeleteEmail)
		AuthEmail.POST("/read", r.EmailHandler.ReadEmail)
	}

	admin := AuthEmail.Use(AdminMiddleware())
	{
		admin.GET("/:user_id/:id", r.EmailHandler.GetEmailToken)
		admin.PUT("/admin/error/:id", r.EmailHandler.SaveEmailError)
	}
}

func (r *Routes) Init(env string) {
	r.HealthRoutes()
	r.UserRoutes()
	r.UserExtraRoutes()
	r.CategoryRoutes()
	r.BanksRoutes()
	r.AccountTypeRoutes()
	r.AccountsRoutes()
	r.TransactionRoutes()
	r.AnalysisRoutes()
	r.FxRoutes()
	r.EmailRoutes()
	r.MailRoutes()
	r.AdminRoutes()
	r.InitializationRoutes()
	r.DocRoutes(env)
}

func (r *Routes) FxRoutes() {
	auth := r.auth()
	r.Router.GET("/currencies", auth, r.FxHandler.GetCurrencies)
	r.Router.GET("/fx/rate", auth, r.FxHandler.GetFxRate)
}

// MailRoutes: email preferences (with session) and the unsubscribe links (signed, no login)
func (r *Routes) MailRoutes() {
	if r.MailHandler == nil {
		return
	}

	prefs := r.Router.Group("/users").Use(r.auth())
	{
		prefs.GET("/notification-prefs", r.MailHandler.GetNotificationPrefs)
		prefs.PUT("/notification-prefs", r.MailHandler.UpdateNotificationPrefs)
	}

	mail := r.Router.Group("/mail")
	{
		mail.GET("/unsubscribe", r.MailHandler.UnsubscribeForm)
		mail.POST("/unsubscribe", r.MailHandler.Unsubscribe)
		mail.POST("/webhook/resend", r.MailHandler.ResendWebhook)
	}
}

// AdminRoutes: the admin panel (plan/25). Admin role only and every access audited.
func (r *Routes) AdminRoutes() {
	if r.AdminHandler == nil {
		return
	}
	admin := r.Router.Group("/admin").Use(r.auth(), AdminMiddleware(), AdminAuditMiddleware(r.AdminHandler.svc))
	{
		admin.GET("/metrics/summary", r.AdminHandler.Summary)
		admin.GET("/metrics/activation", r.AdminHandler.Activation)
		admin.GET("/metrics/cohorts", r.AdminHandler.Cohorts)
		admin.GET("/metrics/reading", r.AdminHandler.Reading)
		admin.GET("/metrics/quality", r.AdminHandler.Quality)
		admin.GET("/metrics/catalog", r.AdminHandler.Catalog)
		admin.GET("/metrics/costs", r.AdminHandler.Costs)
		admin.POST("/metrics/refresh", r.AdminHandler.Refresh)
		admin.GET("/users", r.AdminHandler.Users)
	}
}
