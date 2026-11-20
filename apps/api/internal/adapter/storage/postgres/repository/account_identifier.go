package repository

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// identifierUniqueConstraint: the same digits recognise one account per user and bank (migration 000053)
const identifierUniqueConstraint = "account_identifiers_digits_unique"

// identifiersColumn are the digits of the account, oldest first ('{}' when it has none)
const identifiersColumn = "coalesce((select array_agg(ai.digits order by ai.id) from account_identifiers ai " +
	"where ai.account_id = a.id), '{}') as identifiers"

func (ar *AccountRepository) ListIdentifiers(ctx context.Context, userID string, accountID uint64) ([]domain.AccountIdentifier, error) {
	rows, err := ar.db.Query(ctx, `
		SELECT id, user_id, bank_id, account_id, digits, source, created_at
		FROM account_identifiers WHERE user_id = $1 AND account_id = $2 ORDER BY id`, userID, accountID)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	identifiers := make([]domain.AccountIdentifier, 0)
	for rows.Next() {
		var i domain.AccountIdentifier
		if err = rows.Scan(&i.ID, &i.UserID, &i.BankID, &i.AccountID, &i.Digits, &i.Source, &i.CreatedAt); err != nil {
			return nil, err
		}
		identifiers = append(identifiers, i)
	}
	return identifiers, rows.Err()
}

// CreateIdentifier adds digits to an account of the user. Digits the account already has are returned as they are;
// digits of another account of the same bank are ErrIdentifierTaken.
func (ar *AccountRepository) CreateIdentifier(ctx context.Context, identifier *domain.AccountIdentifier) error {
	accountID := identifier.AccountID
	var found domain.AccountIdentifier
	err := ar.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO account_identifiers (user_id, bank_id, account_id, digits, source)
			SELECT a.user_id, a.bank_id, a.id, $3, $4 FROM accounts a WHERE a.id = $2 AND a.user_id = $1
			ON CONFLICT (user_id, bank_id, digits) DO NOTHING
			RETURNING id, user_id, bank_id, account_id, digits, source, created_at
		)
		SELECT id, user_id, bank_id, account_id, digits, source, created_at FROM inserted
		UNION ALL
		SELECT ai.id, ai.user_id, ai.bank_id, ai.account_id, ai.digits, ai.source, ai.created_at
		FROM account_identifiers ai JOIN accounts a ON a.user_id = ai.user_id AND a.bank_id = ai.bank_id
		WHERE a.id = $2 AND a.user_id = $1 AND ai.digits = $3 AND NOT EXISTS (SELECT 1 FROM inserted)`,
		identifier.UserID, identifier.AccountID, identifier.Digits, identifier.Source,
	).Scan(&found.ID, &found.UserID, &found.BankID, &found.AccountID, &found.Digits, &found.Source, &found.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrDataNotFound // not an account of the user
	}
	if err != nil {
		return mapAccountError(err)
	}
	if found.AccountID != accountID {
		return domain.ErrIdentifierTaken
	}
	*identifier = found
	return nil
}

// DeleteIdentifier removes digits from an account. When they were the number the user typed, the account is left
// without a typed number.
func (ar *AccountRepository) DeleteIdentifier(ctx context.Context, userID string, accountID, id uint64) error {
	tx, err := ar.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var digits string
	err = tx.QueryRow(ctx, `DELETE FROM account_identifiers WHERE id = $1 AND account_id = $2 AND user_id = $3
		RETURNING digits`, id, accountID, userID).Scan(&digits)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if _, err = tx.Exec(ctx, `UPDATE accounts SET last_four_digits = '', updated_at = now()
		WHERE id = $1 AND user_id = $2 AND last_four_digits = $3`, accountID, userID, digits); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return tx.Commit(ctx)
}

// LearnAccountIdentifier: the user moved an email transaction to toAccountID. The digits the email had become an
// identifier of that account when they are free in its bank, and the other transactions waiting for review with the
// same digits move there too. Nothing is learned when the account is an investment, is of another bank than the
// email (fromBankID) or the digits already recognise another account.
func (tr *TransactionRepository) LearnAccountIdentifier(
	ctx context.Context, userID, hint string, fromBankID, toAccountID uint64,
) (*domain.LearnedIdentifiers, error) {
	result := &domain.LearnedIdentifiers{}
	if !domain.IsAccountDigits(hint) {
		return result, nil
	}

	tx, err := tr.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		bankID   uint64
		class    string
		currency string
	)
	err = tx.QueryRow(ctx, `
		SELECT a.bank_id, coalesce(at.class, ''), a.currency FROM accounts a
		LEFT JOIN account_types at ON at.id = a.type_id
		WHERE a.id = $1 AND a.user_id = $2`, toAccountID, userID).Scan(&bankID, &class, &currency)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	if class == domain.AccountClassInvestment || (fromBankID != 0 && bankID != fromBankID) {
		return result, nil
	}

	var inserted bool
	err = tx.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO account_identifiers (user_id, bank_id, account_id, digits, source)
			VALUES ($1, $2, $3, $4, 'learned')
			ON CONFLICT (user_id, bank_id, digits) DO NOTHING
			RETURNING id
		)
		SELECT EXISTS (SELECT 1 FROM ins)`, userID, bankID, toAccountID, hint).Scan(&inserted)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	if !inserted {
		var owner uint64
		err = tx.QueryRow(ctx, `SELECT account_id FROM account_identifiers WHERE user_id = $1 AND bank_id = $2
			AND digits = $3`, userID, bankID, hint).Scan(&owner)
		if err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}
		if owner != toAccountID {
			return result, nil // the digits recognise another account: a one-off correction
		}
	}

	// the pending ones read with the same digits from the same bank (same currency: amounts stay as read)
	tag, err := tx.Exec(ctx, `
		UPDATE transactions t SET account_id = $3, should_verify = false, updated_at = now()
		FROM accounts a
		WHERE t.user_id = $1 AND t.source_account_hint = $4 AND t.should_verify AND t.automated
		  AND t.account_id <> $3 AND t.transfer_group_id IS NULL
		  AND a.id = t.account_id AND a.user_id = t.user_id AND a.bank_id = $2 AND a.currency = $5`,
		userID, bankID, toAccountID, hint, currency)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	result.Learned = inserted
	result.Digits = hint
	result.Moved = int(tag.RowsAffected())
	return result, nil
}
