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

type BankRepository struct {
	db *postgres.DB
}

func NewBankRepository(db *postgres.DB) *BankRepository {
	return &BankRepository{
		db,
	}
}

func (br BankRepository) CreateBank(ctx context.Context, bank *domain.Bank) error {
	query := br.db.QueryBuilder.Insert(enums.BankTableName).
		Columns("user_id", "name", "email").
		Values(
			bank.UserID,
			bank.Name,
			bank.Email,
		).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = br.db.QueryRow(ctx, sql, args...).Scan(
		&bank.ID,
		&bank.Name,
		&bank.Email,
		&bank.CreatedAt,
		&bank.UpdatedAt,
		&bank.UserID,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (br BankRepository) GetBank(ctx context.Context, userID string, id uint64) (*domain.Bank, error) {
	var bank domain.Bank

	query := br.db.QueryBuilder.Select("*").
		From(enums.BankTableName).
		Where(sq.Eq{"id": id, "user_id": userID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = br.db.QueryRow(ctx, sql, args...).Scan(
		&bank.ID,
		&bank.Name,
		&bank.Email,
		&bank.CreatedAt,
		&bank.UpdatedAt,
		&bank.UserID,
	)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &bank, nil
}

func (br BankRepository) GetBanksList(ctx context.Context, userID string, skip uint64, limit uint64) ([]domain.Bank, error) {
	var banks []domain.Bank

	query := br.db.QueryBuilder.Select("*").
		From(enums.BankTableName).
		Where(sq.Eq{"user_id": userID}).
		OrderBy("id").
		Offset(skip).
		Limit(limit)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := br.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var bank domain.Bank

		err = rows.Scan(
			&bank.ID,
			&bank.Name,
			&bank.Email,
			&bank.CreatedAt,
			&bank.UpdatedAt,
			&bank.UserID,
		)
		if err != nil {
			return nil, err
		}

		banks = append(banks, bank)
	}

	return banks, nil
}

func (br BankRepository) UpdateBank(ctx context.Context, bank *domain.Bank) error {
	name := utils.NullString(bank.Name)

	query := br.db.QueryBuilder.Update(enums.BankTableName).
		Set("name", sq.Expr("COALESCE(?, name)", name)).
		Set("email", bank.Email).
		Where(sq.Eq{"id": bank.ID, "user_id": bank.UserID}).
		Set("updated_at", time.Now()).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = br.db.QueryRow(ctx, sql, args...).Scan(
		&bank.ID,
		&bank.Name,
		&bank.Email,
		&bank.CreatedAt,
		&bank.UpdatedAt,
		&bank.UserID,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (br BankRepository) DeleteBank(ctx context.Context, userID string, id uint64) error {
	query := br.db.QueryBuilder.Delete(enums.BankTableName).
		Where(sq.Eq{"id": id, "user_id": userID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	_, err = br.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}
