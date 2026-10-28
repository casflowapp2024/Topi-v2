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

// accountTypeColumns are scanned by scanAccountType, in this order (explicit, not "*")
const accountTypeColumns = "id, name, created_at, updated_at, class"

type accountTypeScanner interface {
	Scan(dest ...any) error
}

func scanAccountType(row accountTypeScanner, accountType *domain.AccountType) error {
	return row.Scan(
		&accountType.ID,
		&accountType.Name,
		&accountType.CreatedAt,
		&accountType.UpdatedAt,
		&accountType.Class,
	)
}

type AccountTypeRepository struct {
	db *postgres.DB
}

func NewAccountTypeRepository(db *postgres.DB) *AccountTypeRepository {
	return &AccountTypeRepository{
		db,
	}
}

func (at AccountTypeRepository) CreateAccountType(ctx context.Context, accountType *domain.AccountType) error {
	query := at.db.QueryBuilder.Insert(enums.AccountTypeTableName).
		Columns("name", "class").
		Values(accountType.Name, accountType.ClassOrDefault()).
		Suffix("RETURNING " + accountTypeColumns)

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = scanAccountType(at.db.QueryRow(ctx, sql, args...), accountType)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (at AccountTypeRepository) GetAccountType(ctx context.Context, id uint64) (*domain.AccountType, error) {
	var accountType domain.AccountType

	query := at.db.QueryBuilder.Select(accountTypeColumns).
		From(enums.AccountTypeTableName).
		Where(sq.Eq{"id": id}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = scanAccountType(at.db.QueryRow(ctx, sql, args...), &accountType)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &accountType, nil
}

func (at AccountTypeRepository) GetAccountTypeList(ctx context.Context, skip uint64, limit uint64) ([]domain.AccountType, error) {
	var accountTypes []domain.AccountType

	query := at.db.QueryBuilder.Select(accountTypeColumns).
		From(enums.AccountTypeTableName).
		OrderBy("id").
		Limit(limit).
		Offset(skip)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := at.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var accountType domain.AccountType

		err = scanAccountType(rows, &accountType)
		if err != nil {
			return nil, err
		}

		accountTypes = append(accountTypes, accountType)
	}

	return accountTypes, nil
}

func (at AccountTypeRepository) UpdateAccountType(ctx context.Context, accountType *domain.AccountType) error {
	typeString := utils.NullString(accountType.Name)

	query := at.db.QueryBuilder.Update(enums.AccountTypeTableName).
		Set("name", sq.Expr("COALESCE(?, name)", typeString)).
		Set("updated_at", time.Now()).
		Where(sq.Eq{"id": accountType.ID}).
		Suffix("RETURNING " + accountTypeColumns)

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = scanAccountType(at.db.QueryRow(ctx, sql, args...), accountType)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (at AccountTypeRepository) DeleteAccountType(ctx context.Context, id uint64) error {
	query := at.db.QueryBuilder.Delete(enums.AccountTypeTableName).
		Where(sq.Eq{"id": id})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	_, err = at.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}
