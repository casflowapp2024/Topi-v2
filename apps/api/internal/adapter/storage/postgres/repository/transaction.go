package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"time"

	sq "github.com/Masterminds/squirrel"
)

// TransactionRepository implements port.TransactionRepository interface
// and provides access to the postgres database
type TransactionRepository struct {
	db *postgres.DB
}

// NewTransactionRepository creates a new transaction repository instance
func NewTransactionRepository(db *postgres.DB) *TransactionRepository {
	return &TransactionRepository{
		db,
	}
}

// CreateTransaction creates a new transaction record in the database
func (tr *TransactionRepository) CreateTransaction(
	ctx context.Context,
	transaction *domain.Transaction,
) (*domain.Transaction, error) {
	query := tr.db.QueryBuilder.Insert(enums.TransactionsTableName).
		Columns(
			"user_id",
			"category_id",
			"account_id",
			"description",
			"expense",
			"amount",
			"date",
		).Values(
		transaction.UserID,
		transaction.Category.ID,
		transaction.Account.ID,
		transaction.Description,
		transaction.Expense,
		transaction.Amount,
		transaction.Date,
	).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = tr.db.QueryRow(ctx, sql, args...).Scan(
		&transaction.ID,
		&transaction.UserID,
		&transaction.Category.ID,
		&transaction.Account.ID,
		&transaction.Description,
		&transaction.Expense,
		&transaction.Amount,
		&transaction.Date,
		&transaction.Automated,
		&transaction.ShouldVerify,
		&transaction.Checked,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
		&transaction.RawDescription,
	)

	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return transaction, nil
}

// GetTransactionByID retrieves a transaction record from the database by id
func (tr *TransactionRepository) GetTransactionByID(
	ctx context.Context,
	userID string,
	id uint64,
) (*domain.Transaction, error) {
	var transaction domain.Transaction

	query := tr.db.QueryBuilder.Select(
		"t.*, c.name, c.emoji, a.name, a.last_four_digits, b.id, b.name, at.id, at.name").
		From(enums.TransactionsTableName + " t").
		LeftJoin(enums.CategoryTableName + " c ON c.id = t.category_id").
		LeftJoin(enums.AccountTableName + " a ON a.id = t.account_id").
		LeftJoin(enums.AccountTypeTableName + " at ON at.id = a.type_id").
		LeftJoin(enums.BankTableName + " b ON b.id = a.bank_id").
		Where(sq.Eq{"t.id": id}).
		Where(sq.Eq{"t.user_id": userID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = tr.db.QueryRow(ctx, sql, args...).Scan(
		&transaction.ID,
		&transaction.UserID,
		&transaction.Category.ID,
		&transaction.Account.ID,
		&transaction.Description,
		&transaction.Expense,
		&transaction.Amount,
		&transaction.Date,
		&transaction.Automated,
		&transaction.ShouldVerify,
		&transaction.Checked,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
		&transaction.RawDescription,
		&transaction.Category.Name,
		&transaction.Category.Emoji,
		&transaction.Account.Name,
		&transaction.Account.LastFourDigits,
		&transaction.Account.Bank.ID,
		&transaction.Account.Bank.Name,
		&transaction.Account.Type.ID,
		&transaction.Account.Type.Name,
	)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &transaction, nil
}

// ListTransactions retrieves a list of transactions from the database
func (tr *TransactionRepository) ListTransactions(
	ctx context.Context,
	filters domain.TransactionFilters,
) ([]domain.Transaction, error) {
	var transactions []domain.Transaction

	total := tr.db.QueryBuilder.Select(
		"count(t.id)",
	).From(enums.TransactionsTableName + " as t").
		Where(sq.Eq{"t.user_id": filters.UserID})

	total = filters.ApplyTransactionsQueryFilters(total, false, false)

	totalSQL, _, err := total.ToSql()
	if err != nil {
		return transactions, err
	}

	newsCount := tr.db.QueryBuilder.Select("count(id)").
		From(enums.TransactionsTableName).
		Where(sq.Eq{"user_id": filters.UserID}).
		Where("checked is false")

	newsSQL, _, err := newsCount.ToSql()
	if err != nil {
		return transactions, err
	}

	query := tr.db.QueryBuilder.Select(
		"t.*",
		"c.name",
		"c.emoji",
		"a.name",
		"a.last_four_digits",
		"b.id",
		"b.name",
		"at.id",
		"at.name",
		"ue.read_email",
		"("+totalSQL+") as total",
		"("+newsSQL+") as news_count",
	).
		From(enums.TransactionsTableName + " t").
		LeftJoin(enums.CategoryTableName + " c ON c.id = t.category_id").
		LeftJoin(enums.AccountTableName + " a ON a.id = t.account_id").
		LeftJoin(enums.AccountTypeTableName + " at ON at.id = a.type_id").
		LeftJoin(enums.BankTableName + " b ON b.id = a.bank_id").
		LeftJoin(enums.UserExtraTableName + " ue ON ue.user_id = t.user_id").
		Where(sq.Eq{"t.user_id": filters.UserID})

	query = filters.ApplyTransactionsQueryFilters(query, true, true)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := tr.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var transaction domain.Transaction

		err = rows.Scan(
			&transaction.ID,
			&transaction.UserID,
			&transaction.Category.ID,
			&transaction.Account.ID,
			&transaction.Description,
			&transaction.Expense,
			&transaction.Amount,
			&transaction.Date,
			&transaction.Automated,
			&transaction.ShouldVerify,
			&transaction.Checked,
			&transaction.CreatedAt,
			&transaction.UpdatedAt,
			&transaction.RawDescription,
			&transaction.Category.Name,
			&transaction.Category.Emoji,
			&transaction.Account.Name,
			&transaction.Account.LastFourDigits,
			&transaction.Account.Bank.ID,
			&transaction.Account.Bank.Name,
			&transaction.Account.Type.ID,
			&transaction.Account.Type.Name,
			&transaction.ReadEmail,
			&transaction.Total,
			&transaction.News,
		)
		if err != nil {
			return nil, err
		}

		transactions = append(transactions, transaction)
	}

	return transactions, nil
}

// UpdateTransaction updates a transaction record in the database
func (tr *TransactionRepository) UpdateTransaction(ctx context.Context, transaction *domain.Transaction) error {
	categoryID := utils.NullUint64(transaction.Category.ID)
	accountID := utils.NullUint64(transaction.Account.ID)
	description := utils.NullString(transaction.Description)
	amount := utils.NullFloat64(transaction.Amount)
	date := utils.NullDate(transaction.Date)

	query := tr.db.QueryBuilder.Update(enums.TransactionsTableName).
		Set("category_id", sq.Expr("COALESCE(?, category_id)", categoryID)).
		Set("account_id", sq.Expr("COALESCE(?, account_id)", accountID)).
		Set("description", sq.Expr("COALESCE(?, description)", description)).
		Set("expense", sq.Expr("COALESCE(?, expense)", transaction.Expense)).
		Set("amount", sq.Expr("COALESCE(?, amount)", amount)).
		Set("date", sq.Expr("COALESCE(?, date)", date)).
		Set("should_verify", sq.Expr("COALESCE(?, should_verify)", transaction.ShouldVerify)).
		Set("checked", sq.Expr("COALESCE(?, checked)", transaction.Checked)).
		Set("updated_at", time.Now()).
		Where(sq.Eq{"id": transaction.ID}).
		Where(sq.Eq{"user_id": transaction.UserID}).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = tr.db.QueryRow(ctx, sql, args...).Scan(
		&transaction.ID,
		&transaction.UserID,
		&transaction.Category.ID,
		&transaction.Account.ID,
		&transaction.Description,
		&transaction.Expense,
		&transaction.Amount,
		&transaction.Date,
		&transaction.Automated,
		&transaction.ShouldVerify,
		&transaction.Checked,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
		&transaction.RawDescription,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

// DeleteTransaction deletes a transaction record from the database by id
func (tr *TransactionRepository) DeleteTransaction(ctx context.Context, id uint64, userID string) error {
	query := tr.db.QueryBuilder.Delete(enums.TransactionsTableName).
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"user_id": userID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	_, err = tr.db.Exec(ctx, sql, args...)
	if err != nil {
		return err
	}

	return nil
}

// AdminCreateTransactions creates a new transaction record in the database
func (tr *TransactionRepository) AdminCreateTransactions(
	ctx context.Context,
	transactions []domain.Transaction,
) ([]domain.Transaction, error) {
	query := tr.db.QueryBuilder.Insert(enums.TransactionsTableName).
		Columns("user_id",
			"category_id",
			"account_id",
			"description",
			"raw_description",
			"expense",
			"amount",
			"date",
			"automated",
			"should_verify",
			"checked",
		)

	for _, transaction := range transactions {
		query = query.Values(
			transaction.UserID,
			transaction.Category.ID,
			transaction.Account.ID,
			transaction.Description,
			transaction.Description,
			transaction.Expense,
			transaction.Amount,
			transaction.Date,
			transaction.Automated,
			transaction.ShouldVerify,
			transaction.Checked,
		)
	}

	query = query.Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := tr.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	var createdTransactions []domain.Transaction
	for rows.Next() {
		var transaction domain.Transaction
		err = rows.Scan(
			&transaction.ID,
			&transaction.UserID,
			&transaction.Category.ID,
			&transaction.Account.ID,
			&transaction.Description,
			&transaction.Expense,
			&transaction.Amount,
			&transaction.Date,
			&transaction.Automated,
			&transaction.ShouldVerify,
			&transaction.Checked,
			&transaction.CreatedAt,
			&transaction.UpdatedAt,
			&transaction.RawDescription,
		)
		if err != nil {
			return nil, err
		}

		createdTransactions = append(createdTransactions, transaction)
	}

	// Check for any error that occurred during iteration
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return createdTransactions, nil
}

// PredictTransactionCategory receives a list of raw descriptions and returns a map
// raw_description -> category_id, only when relative_frequency_percent > 90 to reduce false positives.
// It queries the materialized view TRANSACTION_CATEGORIZATION_ANALYSIS created in migration 000013.
func (tr *TransactionRepository) PredictTransactionCategory(
	ctx context.Context,
	descriptions []string,
	cpr *domain.CategoryPredictionResolver,
) {
	defer cpr.Wg.Done()

	if len(descriptions) == 0 {
		cpr.PredictionErr = domain.ErrEmptyData
		return
	}

	// Build query against materialized view filtering by user, descriptions and threshold
	// We pick the top (highest frequency) row per raw_description implicitly because the
	// materialized view is ordered when created, and we will aggregate client-side by the first occurrence.
	// To be explicit, we use DISTINCT ON to ensure one row per raw_description choosing the highest relative frequency.
	query := tr.db.QueryBuilder.
		Select(
			"distinct on (raw_description) raw_description",
			"category_id",
		).
		From(enums.CategoryPredictionsView).
		Where(sq.Eq{"user_id": cpr.UserID}).
		Where(sq.Eq{"raw_description": descriptions}).
		Where("relative_frequency_percent > 60").
		OrderBy("raw_description", "relative_frequency_percent desc")

	sql, args, err := query.ToSql()
	if err != nil {
		cpr.PredictionErr = err
		return
	}

	rows, err := tr.db.Query(ctx, sql, args...)
	if err != nil {
		cpr.PredictionErr = mappers.MapPostgresErrorCode(err)
		return
	}

	defer rows.Close()

	var predictionsMap = make(map[string]uint64)

	for rows.Next() {
		var (
			rawDescription string
			categoryID     uint64
		)

		var err = rows.Scan(
			&rawDescription,
			&categoryID,
		)

		if err != nil {
			cpr.PredictionErr = err
			return
		}

		predictionsMap[rawDescription] = categoryID
	}

	defer cpr.Mu.Unlock()
	cpr.Mu.Lock()
	cpr.PredictionsMap = predictionsMap

	return
}
