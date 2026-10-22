package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"errors"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
)

// transactionColumns are the columns scanned by scanTransaction-like code, in this order.
// Explicit (not "*") so adding columns to the table does not break the scans.
const transactionColumns = "id, user_id, category_id, account_id, description, expense, amount, date, " +
	"automated, should_verify, checked, created_at, updated_at, raw_description"

const transactionColumnsT = "t.id, t.user_id, t.category_id, t.account_id, t.description, t.expense, t.amount, t.date, " +
	"t.automated, t.should_verify, t.checked, t.created_at, t.updated_at, t.raw_description"

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
		Suffix("RETURNING " + transactionColumns)

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
		transactionColumnsT + ", c.name, c.emoji, a.name, a.last_four_digits, b.id, b.name, at.id, at.name").
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
		transactionColumnsT,
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
		Suffix("RETURNING " + transactionColumns)

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

// AdminCreateTransactions inserts transactions created on behalf of a user (email worker).
// Transactions with SourceMessageID are idempotent:
//   - ON CONFLICT (user_id, source_message_id) DO NOTHING: reprocessing an email never duplicates;
//   - legacy dedupe: skipped if the previous reader already stored an automated transaction
//     (source_message_id IS NULL) with the same account, amount, expense and date ±2 min.
//
// Everything runs in one database transaction.
func (tr *TransactionRepository) AdminCreateTransactions(
	ctx context.Context,
	transactions []domain.Transaction,
) (*domain.AdminCreateResult, error) {
	tx, err := tr.db.Begin(ctx)
	if err != nil {
		return nil, domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	result := &domain.AdminCreateResult{
		Created: []domain.Transaction{},
		Skipped: []domain.SkippedTransaction{},
	}

	for _, transaction := range transactions {
		if transaction.SourceMessageID != nil {
			legacy, lErr := tr.hasLegacyDuplicate(ctx, tx, transaction)
			if lErr != nil {
				return nil, lErr
			}
			if legacy {
				result.Skipped = append(result.Skipped, domain.SkippedTransaction{
					SourceMessageID: transaction.SourceMessageID,
					Reason:          domain.SkipLegacyDuplicate,
				})
				continue
			}
		}

		query := tr.db.QueryBuilder.Insert(enums.TransactionsTableName).
			Columns(
				"user_id",
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
				"source_message_id",
			).
			Values(
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
				transaction.SourceMessageID,
			).
			Suffix("ON CONFLICT (user_id, source_message_id) WHERE source_message_id IS NOT NULL DO NOTHING " +
				"RETURNING " + transactionColumns + ", source_message_id")

		sql, args, qErr := query.ToSql()
		if qErr != nil {
			return nil, qErr
		}

		var created domain.Transaction
		err = tx.QueryRow(ctx, sql, args...).Scan(
			&created.ID,
			&created.UserID,
			&created.Category.ID,
			&created.Account.ID,
			&created.Description,
			&created.Expense,
			&created.Amount,
			&created.Date,
			&created.Automated,
			&created.ShouldVerify,
			&created.Checked,
			&created.CreatedAt,
			&created.UpdatedAt,
			&created.RawDescription,
			&created.SourceMessageID,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			result.Skipped = append(result.Skipped, domain.SkippedTransaction{
				SourceMessageID: transaction.SourceMessageID,
				Reason:          domain.SkipDuplicateMessage,
			})
			continue
		}
		if err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}

		result.Created = append(result.Created, created)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return result, nil
}

// hasLegacyDuplicate reports whether the legacy reader already stored this transaction
func (tr *TransactionRepository) hasLegacyDuplicate(
	ctx context.Context,
	tx pgx.Tx,
	transaction domain.Transaction,
) (bool, error) {
	sql, args, err := tr.db.QueryBuilder.Select("1").
		From(enums.TransactionsTableName).
		Where(sq.Eq{
			"user_id":    transaction.UserID,
			"account_id": transaction.Account.ID,
			"expense":    transaction.Expense,
			"automated":  true,
		}).
		Where("amount = ?", transaction.Amount).
		Where("source_message_id IS NULL").
		Where("date BETWEEN ? AND ?",
			transaction.Date.Add(-domain.LegacyDedupeWindow),
			transaction.Date.Add(domain.LegacyDedupeWindow)).
		Limit(1).
		ToSql()
	if err != nil {
		return false, err
	}

	var found int
	err = tx.QueryRow(ctx, sql, args...).Scan(&found)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, mappers.MapPostgresErrorCode(err)
	}

	return true, nil
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
