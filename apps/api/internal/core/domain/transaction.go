package domain

import (
	"cash-flow/internal/utils"
	"fmt"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/shopspring/decimal"
)

// InstallmentsFrom is the first purchase date that is spread in the reports and asked about: closed
// months do not change. Older purchases with installments only count by installment in the statements.
var InstallmentsFrom = time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)

// InstallmentPromptMin is the smallest purchase worth asking about, in COP (converted to the user's base
// currency): asking for every purchase would fill the inbox.
const InstallmentPromptMin = 200000

// InstallmentFilter selects a schedule: the installments that fall in a month (the first one is the
// purchase itself, so it is left out) or all the installments of a purchase.
type InstallmentFilter struct {
	Month         *time.Time
	TransactionID *uint64
}

// Installment is one row of the schedule of a purchase (function installment_schedule)
type Installment struct {
	TransactionID uint64
	Description   string
	CategoryID    uint64
	AccountName   string
	Currency      string
	Number        int
	Total         int
	BudgetDate    time.Time
	StatementDate *time.Time
	Amount        decimal.Decimal
	AmountBase    *decimal.Decimal
}

// TransactionType is an enum for payment's type
type TransactionType string

// Transaction is an entity that represents a payment
type Transaction struct {
	ID             uint64
	UserID         string
	Description    string
	RawDescription *string
	Expense        bool
	Amount         float64
	Date           time.Time
	Category       Category
	Account        Account
	Automated      bool
	ShouldVerify   bool
	Checked        bool
	Total          uint64
	News           uint64
	ReadEmail      bool
	// SourceMessageID is the provider message id of the email the transaction was read from
	// (worker). Unique per user: reprocessing an email never duplicates the transaction.
	SourceMessageID *string

	// Multicurrency (migration 000024). Currency is always the account's currency (database
	// trigger). FxRate converts Amount to the user's base currency: AmountBase = Amount × FxRate.
	// Both are nil while there is no rate for the transaction date.
	Currency        string
	FxRate          *decimal.Decimal
	FxRateSource    *string
	AmountBase      *decimal.Decimal
	TransferGroupID *string
	// Installments: a card purchase deferred to N payments (2–120). Informative: the purchase is a
	// full expense on its date. In an update, nil keeps it and 0 or 1 clears it.
	Installments *int16
	// NeedsCounterpart: a card payment read from an email whose outgoing leg is still missing. It
	// already counts as a transfer; the app asks the user which account paid.
	NeedsCounterpart bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

// LegacyDedupeWindow is the time window used to detect transactions already created by the
// previous (AWS) reader, which did not store the source message id.
const LegacyDedupeWindow = 2 * time.Minute

// Reasons why an admin-created transaction was skipped
const (
	SkipDuplicateMessage = "duplicate_message" // same (user_id, source_message_id) already stored
	SkipLegacyDuplicate  = "legacy_duplicate"  // same account, amount, expense and date ±2 min from the legacy reader
)

// SkippedTransaction is a transaction that was not inserted and why
type SkippedTransaction struct {
	SourceMessageID *string
	Reason          string
}

// AdminCreateResult is the result of creating transactions on behalf of a user (worker)
type AdminCreateResult struct {
	Created []Transaction
	Skipped []SkippedTransaction
}

func IsSameTransaction(current, new *Transaction) bool {
	sameCategory := current.Category.ID == new.Category.ID
	sameAccount := current.Account.ID == new.Account.ID
	sameDescription := current.Description == new.Description
	sameExpense := current.Expense == new.Expense
	sameAmount := current.Amount == new.Amount
	sameDate := current.Date.Equal(new.Date)
	sameCheck := current.Checked == new.Checked
	sameFxRate := new.FxRate == nil || (current.FxRate != nil && current.FxRate.Equal(*new.FxRate))
	sameInstallments := new.Installments == nil || InstallmentsOrZero(current.Installments) == InstallmentsOrZero(new.Installments)

	return sameDescription && sameCategory && sameAccount && sameExpense && sameAmount && sameDate && sameCheck &&
		sameFxRate && sameInstallments
}

// InstallmentsOrZero is the number of installments, 0 when there are none (nil, 0 or 1)
func InstallmentsOrZero(n *int16) int16 {
	if n == nil || *n < 2 {
		return 0
	}
	return *n
}

type Transactions []Transaction

func (ts *Transactions) ExtractDescriptions() []string {
	rawDescriptions := make([]string, 0, len(*ts))
	unique := make(map[string]struct{})
	for _, t := range *ts {
		if t.Description == "" {
			continue
		}

		if _, ok := unique[t.Description]; ok {
			continue
		}

		unique[t.Description] = struct{}{}
		rawDescriptions = append(rawDescriptions, t.Description)
	}
	return rawDescriptions
}

func (ts *Transactions) UpdateCategories(predictionsMap map[string]uint64, defaultCategoryID uint64) {
	for idx := range *ts {
		transaction := &(*ts)[idx] // Get a pointer to the transaction
		if id, ok := predictionsMap[transaction.Description]; ok {
			transaction.Category.ID = id
		} else {
			transaction.Category.ID = defaultCategoryID
		}
	}
}

func (ts *Transactions) CalculateNetFlow() float64 {
	var expenseSum, incomeSum float64

	for _, t := range *ts {
		if t.Expense {
			expenseSum += t.Amount
		} else {
			incomeSum += t.Amount
		}
	}

	return incomeSum - expenseSum
}

type TransactionFilters struct {
	UserID       string
	Skip         uint64
	Limit        uint64
	Category     []uint64
	Account      []uint64
	InitDate     time.Time
	EndDate      time.Time
	Keyword      string
	Expense      *bool
	Automated    *bool
	ShouldVerify *bool
	Checked      *bool
	Transfer     *bool // true: solo transferencias entre cuentas propias; false: sin ellas
	// NeedsInstallments: card purchases read from an email that still have to answer how many installments
	NeedsInstallments *bool
	SortBy            string
	SortOrder         string
}

func (f *TransactionFilters) ApplyTransactionsQueryFilters(
	query squirrel.SelectBuilder,
	limits bool,
	order bool,
) squirrel.SelectBuilder {
	if len(f.Category) > 0 {
		query = query.Where(squirrel.Eq{"t.category_id": f.Category})
	}

	if len(f.Account) > 0 {
		query = query.Where(squirrel.Eq{"t.account_id": f.Account})
	}

	if !f.InitDate.IsZero() {
		off := utils.GetUtcOffset(f.InitDate)
		formatedDate := "(t.date + interval '" + fmt.Sprintf("%d hours", off) + "')::date"
		query = query.Where(squirrel.GtOrEq{formatedDate: utils.FormatDate(f.InitDate)})
	}

	if !f.EndDate.IsZero() {
		off := utils.GetUtcOffset(f.EndDate)
		formatedDate := "(t.date + interval '" + fmt.Sprintf("%d hours", off) + "')::date"
		query = query.Where(squirrel.LtOrEq{formatedDate: utils.FormatDate(f.EndDate)})
	}

	if f.Keyword != "" {
		filter := fmt.Sprintf("%%%s%%", f.Keyword)
		query = query.Where(squirrel.ILike{"t.description": filter})
	}

	if f.Expense != nil {
		query = query.Where(squirrel.Eq{"t.expense": f.Expense})
	}

	if f.Automated != nil {
		query = query.Where(squirrel.Eq{"t.automated": f.Automated})
	}

	if f.ShouldVerify != nil {
		if *f.ShouldVerify {
			query = query.Where("(t.should_verify OR t.needs_counterpart)")
		} else {
			query = query.Where(squirrel.Eq{"t.should_verify": false, "t.needs_counterpart": false})
		}
	}

	if f.Checked != nil {
		query = query.Where(squirrel.Eq{"t.checked": f.Checked})
	}

	if f.NeedsInstallments != nil && *f.NeedsInstallments {
		query = query.Where(`t.expense AND t.automated AND t.installments IS NULL AND t.installments_reviewed_at IS NULL
			AND t.transfer_group_id IS NULL AND NOT t.needs_counterpart AND t.date >= ?
			AND t.account_id IN (SELECT a.id FROM accounts a JOIN account_types at ON at.id = a.type_id AND at.class = 'credit')
			AND t.amount_base >= ?::numeric * fx_rate_at('COP', user_base_currency(t.user_id), t.date::date)`,
			InstallmentsFrom, InstallmentPromptMin)
	}

	if f.Transfer != nil {
		if *f.Transfer {
			query = query.Where(squirrel.NotEq{"t.transfer_group_id": nil})
		} else {
			query = query.Where(squirrel.Eq{"t.transfer_group_id": nil})
		}
	}

	if order {
		if f.SortBy != "" && f.SortOrder != "" {
			query = query.OrderBy(f.SortBy + " " + f.SortOrder)
		} else {
			query = query.OrderBy("t.date::date desc, t.created_at desc")
		}
	}

	if limits {
		query = query.Offset(f.Skip).Limit(f.Limit)
	}

	return query
}
