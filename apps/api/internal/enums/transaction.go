package enums

const (
	TransactionsTableName   = "transactions"
	Transactions            = "transactions"
	CategoryPredictionsView = "category_predictions"
)

const (
	CreateTransaction = "create_transaction"
	UpdateTransaction = "update_transaction"
)

var TransactionColumnsMap = map[string]string{
	"id":        "id",
	"category":  "category_id",
	"account":   "account_id",
	"expense":   "expense",
	"amount":    "amount",
	"date":      "date",
	"automated": "automated",
}
