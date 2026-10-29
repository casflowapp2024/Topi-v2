package repository

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// transferLeg is one side of a transfer to insert
type transferLeg struct {
	UserID      string
	AccountID   uint64
	CategoryID  uint64
	Description string
	Expense     bool
	Amount      decimal.Decimal
	Date        time.Time
	// AmountBase is shared by both legs (nil: the trigger computes it at the market rate)
	AmountBase *decimal.Decimal
	GroupID    string
}

// insertTransferLeg inserts a leg inside tx. Its fx_rate is amount_base / amount (source
// 'transfer'), so both legs keep the same value in the base currency.
func insertTransferLeg(ctx context.Context, tx pgx.Tx, leg transferLeg) (domain.Transaction, error) {
	var (
		created          domain.Transaction
		fxRate, fxSource *string
	)
	if leg.AmountBase != nil {
		rate := leg.AmountBase.DivRound(leg.Amount, 12)
		fxRate = decimalText(&rate)
		source := "transfer"
		fxSource = &source
	}
	sql, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Insert(enums.TransactionsTableName).
		Columns("user_id", "category_id", "account_id", "description", "expense", "amount", "date",
			"automated", "should_verify", "checked", "transfer_group_id", "fx_rate", "fx_rate_source", "amount_base").
		Values(leg.UserID, leg.CategoryID, leg.AccountID, leg.Description, leg.Expense, leg.Amount.String(),
			leg.Date, false, false, true, leg.GroupID, fxRate, fxSource, decimalText(leg.AmountBase)).
		Suffix("RETURNING " + transactionColumns).
		ToSql()
	if err != nil {
		return created, err
	}
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
		&created.Currency,
		scanDecimal(&created.FxRate),
		&created.FxRateSource,
		scanDecimal(&created.AmountBase),
		&created.TransferGroupID,
		&created.Installments,
	)
	return created, mappers.MapPostgresErrorCode(err)
}

// LinkTransactions links two existing transactions of the user as the legs of one transfer: an
// expense and an income in different accounts, neither already linked.
func (tr *TransactionRepository) LinkTransactions(ctx context.Context, link *domain.TransferLink) error {
	tx, err := tr.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	rows, err := tx.Query(ctx, `
		SELECT account_id, expense, transfer_group_id IS NOT NULL
		FROM `+enums.TransactionsTableName+`
		WHERE user_id = $1 AND id IN ($2, $3)
		FOR UPDATE`, link.UserID, link.TransactionID, link.CounterpartTransactionID)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	var (
		accounts         []uint64
		expenses, linked int
	)
	for rows.Next() {
		var (
			accountID         uint64
			expense, isLinked bool
		)
		if err = rows.Scan(&accountID, &expense, &isLinked); err != nil {
			rows.Close()
			return err
		}
		accounts = append(accounts, accountID)
		if expense {
			expenses++
		}
		if isLinked {
			linked++
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if len(accounts) != 2 {
		return domain.ErrDataNotFound
	}
	if accounts[0] == accounts[1] || expenses != 1 || linked != 0 {
		return domain.ErrTransferLinked
	}

	groupID := uuid.NewString()
	if _, err = tx.Exec(ctx, `
		UPDATE `+enums.TransactionsTableName+` SET transfer_group_id = $4, updated_at = now()
		WHERE user_id = $1 AND id IN ($2, $3)`,
		link.UserID, link.TransactionID, link.CounterpartTransactionID, groupID); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	link.GroupID = groupID
	return tr.fillLink(ctx, link, link.CounterpartTransactionID)
}

// CreateTransferCounterpart creates the missing leg of a transfer in link.CounterpartAccountID
// (the opposite direction of the existing transaction, same date, description and category) and
// links both. The new leg gets the amount_base of the existing one.
func (tr *TransactionRepository) CreateTransferCounterpart(ctx context.Context, link *domain.TransferLink) error {
	tx, err := tr.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		accountID, categoryID uint64
		expense, isLinked     bool
		amount, amountBase    *decimal.Decimal
		currency, description string
		date                  time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT account_id, category_id, expense, transfer_group_id IS NOT NULL, amount::text,
		       amount_base::text, currency, description, date
		FROM `+enums.TransactionsTableName+`
		WHERE user_id = $1 AND id = $2
		FOR UPDATE`, link.UserID, link.TransactionID).
		Scan(&accountID, &categoryID, &expense, &isLinked, scanDecimal(&amount), scanDecimal(&amountBase),
			&currency, &description, &date)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if isLinked {
		return domain.ErrTransferLinked
	}
	if accountID == link.CounterpartAccountID {
		return domain.ErrInvalidTransfer
	}

	var (
		counterpartCurrency string
		minorUnits          int32
		marketRate          *decimal.Decimal
	)
	err = tx.QueryRow(ctx, `
		SELECT a.currency, c.minor_units,
		       fx_rate_at($3, a.currency, (($4::timestamptz) at time zone user_timezone($1))::date)::text
		FROM `+enums.AccountTableName+` a
		JOIN currencies c ON c.code = a.currency
		WHERE a.user_id = $1 AND a.id = $2`,
		link.UserID, link.CounterpartAccountID, currency, date).
		Scan(&counterpartCurrency, &minorUnits, scanDecimal(&marketRate))
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	counterpartAmount := *amount
	switch {
	case counterpartCurrency == currency:
		if link.CounterpartAmount != nil && !link.CounterpartAmount.Equal(*amount) {
			return domain.ErrInvalidTransfer
		}
	case link.CounterpartAmount != nil:
		counterpartAmount = *link.CounterpartAmount
	case marketRate != nil:
		counterpartAmount = amount.Mul(*marketRate).Round(minorUnits)
	default:
		return domain.ErrInvalidFxRate
	}

	groupID := uuid.NewString()
	counterpart, err := insertTransferLeg(ctx, tx, transferLeg{
		UserID: link.UserID, AccountID: link.CounterpartAccountID, CategoryID: categoryID,
		Description: description, Expense: !expense, Amount: counterpartAmount, Date: date,
		AmountBase: amountBase, GroupID: groupID,
	})
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE `+enums.TransactionsTableName+` SET transfer_group_id = $3, updated_at = now()
		WHERE user_id = $1 AND id = $2`, link.UserID, link.TransactionID, groupID); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	link.GroupID = groupID
	return tr.fillLink(ctx, link, counterpart.ID)
}

// fillLink reads both legs after linking (with their category and account)
func (tr *TransactionRepository) fillLink(ctx context.Context, link *domain.TransferLink, counterpartID uint64) error {
	transaction, err := tr.GetTransactionByID(ctx, link.UserID, link.TransactionID)
	if err != nil {
		return err
	}
	counterpart, err := tr.GetTransactionByID(ctx, link.UserID, counterpartID)
	if err != nil {
		return err
	}
	link.Transaction, link.Counterpart = *transaction, *counterpart
	return nil
}

// UnlinkTransfer turns both legs of a transfer back into ordinary transactions
func (tr *TransactionRepository) UnlinkTransfer(ctx context.Context, userID, groupID string) error {
	if _, err := uuid.Parse(groupID); err != nil {
		return domain.ErrDataNotFound
	}
	var rows int
	if err := tr.db.QueryRow(ctx, "SELECT unlink_transfer($1, $2::uuid)", userID, groupID).Scan(&rows); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if rows == 0 {
		return domain.ErrDataNotFound
	}
	return nil
}

// ListTransferCandidates returns pairs that look like transfers (view transfer_link_candidates),
// most confident and most recent first
func (tr *TransactionRepository) ListTransferCandidates(
	ctx context.Context,
	userID string,
	limit uint64,
) ([]domain.TransferCandidate, error) {
	candidates := make([]domain.TransferCandidate, 0)
	rows, err := tr.db.Query(ctx, `
		SELECT out_transaction_id, in_transaction_id, out_account_id, in_account_id,
		       out_amount::text, in_amount::text, out_currency, in_currency,
		       out_description, in_description, out_date, in_date, day_gap, confidence
		FROM transfer_link_candidates
		WHERE user_id = $1
		ORDER BY CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
		         out_date DESC, out_transaction_id, in_transaction_id
		LIMIT $2`, userID, limit)
	if err != nil {
		err = mappers.MapPostgresErrorCode(err)
		if errors.Is(err, domain.ErrDataNotFound) {
			return candidates, nil
		}
		return candidates, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			c                   domain.TransferCandidate
			outAmount, inAmount *decimal.Decimal
		)
		if err = rows.Scan(&c.OutTransactionID, &c.InTransactionID, &c.OutAccountID, &c.InAccountID,
			scanDecimal(&outAmount), scanDecimal(&inAmount), &c.OutCurrency, &c.InCurrency,
			&c.OutDescription, &c.InDescription, &c.OutDate, &c.InDate, &c.DayGap, &c.Confidence); err != nil {
			return candidates, err
		}
		c.OutAmount, c.InAmount = *outAmount, *inAmount
		candidates = append(candidates, c)
	}
	return candidates, mappers.MapPostgresErrorCode(rows.Err())
}

// DismissTransferCandidate hides a candidate pair so it is not proposed again
func (tr *TransactionRepository) DismissTransferCandidate(ctx context.Context, userID string, outID, inID uint64) error {
	tag, err := tr.db.Exec(ctx, `
		INSERT INTO transfer_candidate_dismissals (user_id, out_transaction_id, in_transaction_id)
		SELECT $1::varchar, o.id, i.id
		FROM `+enums.TransactionsTableName+` o, `+enums.TransactionsTableName+` i
		WHERE o.id = $2 AND i.id = $3 AND o.user_id = $1 AND i.user_id = $1
		ON CONFLICT DO NOTHING`, userID, outID, inID)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err = tr.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM transfer_candidate_dismissals
			WHERE user_id = $1 AND out_transaction_id = $2 AND in_transaction_id = $3)`,
			userID, outID, inID).Scan(&exists); err != nil {
			return mappers.MapPostgresErrorCode(err)
		}
		if !exists {
			return domain.ErrDataNotFound
		}
	}
	return nil
}
