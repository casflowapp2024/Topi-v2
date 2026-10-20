package domain

import (
	"cash-flow/internal/utils"
	"fmt"
	"time"

	"github.com/Masterminds/squirrel"
)

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
	CreatedAt       time.Time
	UpdatedAt       time.Time
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

	return sameDescription && sameCategory && sameAccount && sameExpense && sameAmount && sameDate && sameCheck
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
	SortBy       string
	SortOrder    string
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
		query = query.Where(squirrel.Eq{"t.should_verify": f.ShouldVerify})
	}

	if f.Checked != nil {
		query = query.Where(squirrel.Eq{"t.checked": f.Checked})
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
