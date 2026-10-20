package http

import (
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
	EmailHandler          *EmailHandler
	InitDevHandler        *InitDevHandler
	InitializationHandler *InitializationHandler
	Router                *gin.Engine
}

func (r *Routes) HealthRoutes() {
	health := r.Router.Group("/")
	{
		health.GET("/", r.HealthHandler.CheckHealth)
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
	// no-op 200 kept for compatibility (there is no email verification)
	user.POST("/confirm", r.UserHandler.ConfirmUser)
	user.POST("/resend-confirmation", r.UserHandler.ResendConfirmationCode)

	authUser := user.Group("/").Use(AuthMiddleware(r.UserHandler.svc))
	{
		authUser.GET("/", r.UserHandler.GetUser)
		authUser.PUT("/", r.UserHandler.UpdateUser)
	}
}

func (r *Routes) CategoryRoutes() {
	AuthCategories := r.Router.Group("/categories").Use(AuthMiddleware(r.UserHandler.svc))
	{
		AuthCategories.POST("/create", r.CategoryHandler.CreateCategory)
		AuthCategories.GET("/:id", r.CategoryHandler.GetCategory)
		AuthCategories.GET("/list", r.CategoryHandler.GetCategories)
		AuthCategories.PUT("/:id", r.CategoryHandler.UpdateCategory)
		AuthCategories.DELETE("/:id", r.CategoryHandler.DeleteCategory)
	}
}

func (r *Routes) BanksRoutes() {
	AuthBanks := r.Router.Group("/banks").Use(AuthMiddleware(r.UserHandler.svc))
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
	AuthType := r.Router.Group("/account-types").Use(AuthMiddleware(r.UserHandler.svc))
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
	AuthAccounts := r.Router.Group("/accounts").Use(AuthMiddleware(r.UserHandler.svc))
	{
		AuthAccounts.POST("/create", r.AccountHandler.CreateAccount)
		AuthAccounts.PUT("/:id/calculate/initial-balance", r.AccountHandler.CalculateInitialBalance)
		AuthAccounts.GET("/:id", r.AccountHandler.GetAccount)
		AuthAccounts.GET("/list", r.AccountHandler.GetAccounts)
		AuthAccounts.PUT("/:id", r.AccountHandler.UpdateAccount)
		AuthAccounts.DELETE("/:id", r.AccountHandler.DeleteAccount)
	}

	admin := AuthAccounts.Use(AdminMiddleware())
	{
		admin.GET("admin/list", r.AccountHandler.AdminGetAccounts)
		admin.GET("admin/list/by-bank", r.AccountHandler.AdminGetAccountsByBank)
	}
}

func (r *Routes) TransactionRoutes() {
	AuthTransactions := r.Router.Group("/transactions").Use(AuthMiddleware(r.UserHandler.svc))
	{
		AuthTransactions.POST("/create", r.TransactionHandler.CreateTransaction)
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
	AuthAnalysis := r.Router.Group("/analysis").Use(AuthMiddleware(r.UserHandler.svc))
	{
		AuthAnalysis.GET("/financial-report", r.AnalysisHandler.GetFinancialReport)
		AuthAnalysis.GET("/accounts-balance", r.AnalysisHandler.GetBalanceByAccount)
		AuthAnalysis.GET("/financial-analysis", r.AnalysisHandler.GetFinancialAnalysis)
		AuthAnalysis.POST("/categories-report", r.AnalysisHandler.GetCategoriesReport)
		AuthAnalysis.GET("/category-analysis", r.AnalysisHandler.GetCategoryAnalysis)
		AuthAnalysis.POST("/accounts-report", r.AnalysisHandler.GetAccountsReport)
		AuthAnalysis.GET("/account-analysis", r.AnalysisHandler.GetAccountAnalysis)
	}
}

func (r *Routes) InitializationRoutes() {
	AuthInit := r.Router.Group("/init").Use(AuthMiddleware(r.UserHandler.svc))
	{
		AuthInit.POST("/data", r.InitDevHandler.Init)
		AuthInit.POST("/resources", r.InitializationHandler.InitializeResources)
	}
}

func (r *Routes) UserExtraRoutes() {
	AuthUserExtra := r.Router.Group("/user-extra").Use(AuthMiddleware(r.UserHandler.svc))
	{
		AuthUserExtra.POST("create", r.UserExtraHandler.CreateUserExtra)
		AuthUserExtra.GET("", r.UserExtraHandler.GetUserExtra)
		AuthUserExtra.PUT("", r.UserExtraHandler.UpdateUserExtra)
	}

	admin := AuthUserExtra.Use(AdminMiddleware())
	{
		admin.DELETE("admin/:id", r.UserExtraHandler.DeleteUserExtra)
		admin.PUT("admin/read-email", r.UserExtraHandler.AdminUpdateReadEmail)
	}
}

func (r *Routes) EmailRoutes() {
	AuthEmail := r.Router.Group("/email").Use(AuthMiddleware(r.UserHandler.svc))
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
	r.EmailRoutes()
	r.InitializationRoutes()
	r.DocRoutes(env)
}
