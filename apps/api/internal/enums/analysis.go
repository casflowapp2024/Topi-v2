package enums

const (
	// DailyAccountTotalsTableName tiene una fila por (cuenta, categoría, día local) mantenida por
	// trigger; las funciones de análisis reciben el user_id (migración 000024).
	DailyAccountTotalsTableName = "daily_account_totals"
	DailyAnalysisFunction       = "analysis_daily"
	MonthlyAnalysisFunction     = "analysis_monthly"
	MonthlyAccountsFunction     = "analysis_monthly_accounts"
)

const (
	Amount = "amount"
)
