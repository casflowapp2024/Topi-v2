package enums

const (
	AccountTableName = "accounts"
	Accounts         = "accounts"
	UserAccounts     = "user_accounts"
	Savings          = "savings"
	Credits          = "credits"
	Investments      = "investments"
	All              = "all"
)

var (
	SavingTypes              = []uint64{1, 2}
	InvestmentTypes          = []uint64{3}
	CreditTypes              = []uint64{4}
	SavingAndInvestmentTypes = append(SavingTypes, InvestmentTypes...)
	SavingAndCreditTypes     = append(SavingTypes, CreditTypes...)
	AllTypes                 = append(SavingAndCreditTypes, InvestmentTypes...)
)
