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

const bankReturning = "id, name, email, created_at, updated_at, user_id, catalog_id"

var bankColumns = []string{"b.id", "b.name", "b.email", "b.created_at", "b.updated_at", "b.user_id", "b.catalog_id", "c.color", "l.etag"}

// setBankLogo: the public logo of the catalog bank, when it has one
func setBankLogo(bank *domain.Bank, etag *string) {
	if bank.CatalogID == nil || etag == nil {
		return
	}
	bank.LogoURL = domain.CatalogBank{ID: *bank.CatalogID, LogoETag: etag}.LogoPath()
}

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
		Columns("user_id", "name", "email", "catalog_id").
		Values(
			bank.UserID,
			bank.Name,
			bank.Email,
			bank.CatalogID,
		).
		Suffix("RETURNING " + bankReturning)

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
		&bank.CatalogID,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (br BankRepository) GetBank(ctx context.Context, userID string, id uint64) (*domain.Bank, error) {
	var bank domain.Bank
	var logoETag *string

	query := br.db.QueryBuilder.Select(bankColumns...).
		From(enums.BankTableName + " b").
		LeftJoin("bank_catalog c ON c.id = b.catalog_id").
		LeftJoin("bank_logos l ON l.bank_id = b.catalog_id").
		Where(sq.Eq{"b.id": id, "b.user_id": userID}).
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
		&bank.CatalogID,
		&bank.Color,
		&logoETag,
	)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	setBankLogo(&bank, logoETag)

	return &bank, nil
}

func (br BankRepository) GetBanksList(ctx context.Context, userID string, skip uint64, limit uint64) ([]domain.Bank, error) {
	var banks []domain.Bank

	query := br.db.QueryBuilder.Select(bankColumns...).
		From(enums.BankTableName + " b").
		LeftJoin("bank_catalog c ON c.id = b.catalog_id").
		LeftJoin("bank_logos l ON l.bank_id = b.catalog_id").
		Where(sq.Eq{"b.user_id": userID}).
		OrderBy("b.id").
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

		var logoETag *string
		err = rows.Scan(
			&bank.ID,
			&bank.Name,
			&bank.Email,
			&bank.CreatedAt,
			&bank.UpdatedAt,
			&bank.UserID,
			&bank.CatalogID,
			&bank.Color,
			&logoETag,
		)
		if err != nil {
			return nil, err
		}

		setBankLogo(&bank, logoETag)
		banks = append(banks, bank)
	}

	return banks, nil
}

func (br BankRepository) UpdateBank(ctx context.Context, bank *domain.Bank) error {
	name := utils.NullString(bank.Name)

	query := br.db.QueryBuilder.Update(enums.BankTableName).
		Set("name", sq.Expr("COALESCE(?, name)", name)).
		Set("email", bank.Email).
		Set("catalog_id", bank.CatalogID).
		Where(sq.Eq{"id": bank.ID, "user_id": bank.UserID}).
		Set("updated_at", time.Now()).
		Suffix("RETURNING " + bankReturning)

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
		&bank.CatalogID,
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
