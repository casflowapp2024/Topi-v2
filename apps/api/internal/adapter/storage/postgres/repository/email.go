package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
)

type EmailRepository struct {
	db *postgres.DB
}

func NewEmailRepository(db *postgres.DB) *EmailRepository {
	return &EmailRepository{
		db: db,
	}
}

func (e *EmailRepository) RegisterEmail(ctx context.Context, email *domain.Email) error {
	query := e.db.QueryBuilder.Insert(enums.EmailTableName).
		Columns(
			"user_id",
			"email",
			"access_token",
			"refresh_token",
			"token_type",
			"active",
			"provider",
		).
		Values(
			email.UserID,
			email.Email,
			email.Token.Access,
			email.Token.Refresh,
			email.Token.Type,
			email.Active,
			email.Provider,
		).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = e.db.QueryRow(ctx, sql, args...).Scan(
		&email.ID,
		&email.UserID,
		&email.Email,
		&email.Token.Access,
		&email.Token.Refresh,
		&email.Token.Type,
		&email.Active,
		&email.CreatedAt,
		&email.UpdatedAt,
		&email.Provider,
		&email.Error,
	)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (e *EmailRepository) GetEmail(
	ctx context.Context,
	userID string,
	id uint64,
	isActive *bool,
) (*domain.Email, error) {
	var email domain.Email

	query := e.db.QueryBuilder.Select(
		"id",
		"user_id",
		"email",
		"access_token",
		"refresh_token",
		"token_type",
		"active",
		"provider",
		"error",
	).From(enums.EmailTableName).
		Where(sq.Eq{"user_id": userID}).
		Where(sq.Eq{"id": id}).
		Limit(1)

	if isActive != nil {
		query = query.Where(sq.Eq{"active": *isActive})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = e.db.QueryRow(ctx, sql, args...).Scan(
		&email.ID,
		&email.UserID,
		&email.Email,
		&email.Token.Access,
		&email.Token.Refresh,
		&email.Token.Type,
		&email.Active,
		&email.Provider,
		&email.Error,
	)

	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &email, nil
}

func (e *EmailRepository) ListEmails(
	ctx context.Context,
	userID string,
	skip uint64,
	limit uint64,
) ([]domain.Email, error) {
	total := e.db.QueryBuilder.Select("count(id)").From(enums.EmailTableName)
	totalSql, _, err := total.ToSql()
	if err != nil {
		return nil, err
	}

	query := e.db.QueryBuilder.Select(
		"id",
		"user_id",
		"email",
		"access_token",
		"refresh_token",
		"token_type",
		"active",
		"provider",
		"error",
		"("+totalSql+") AS total",
	).From(enums.EmailTableName).
		Where(sq.Eq{"user_id": userID}).
		OrderBy("id").
		Limit(limit).
		Offset(skip)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := e.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	var emails []domain.Email
	for rows.Next() {
		var email domain.Email

		err = rows.Scan(
			&email.ID,
			&email.UserID,
			&email.Email,
			&email.Token.Access,
			&email.Token.Refresh,
			&email.Token.Type,
			&email.Active,
			&email.Provider,
			&email.Error,
			&email.Total,
		)
		if err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}

		emails = append(emails, email)
	}

	return emails, nil
}

func (e *EmailRepository) UpdateEmail(ctx context.Context, email *domain.Email) error {
	query := e.db.QueryBuilder.Update(enums.EmailTableName).
		Set("active", email.Active).
		Where(sq.Eq{"user_id": email.UserID}).
		Where(sq.Eq{"id": email.ID})

	if email.Verify {
		query = query.Set("error", (*string)(nil))
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	result, err := e.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}

func (e *EmailRepository) SaveEmailError(ctx context.Context, emailID uint64, errorMsg string) error {
	query := e.db.QueryBuilder.Update(enums.EmailTableName).
		Set("error", errorMsg).
		Where(sq.Eq{"id": emailID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	result, err := e.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}

func (e *EmailRepository) DeleteEmailTrx(ctx context.Context, tx pgx.Tx, userID string, id uint64) error {
	deleteQuery := e.db.QueryBuilder.Delete(enums.EmailTableName).
		Where(sq.Eq{"user_id": userID}).
		Where(sq.Eq{"id": id})

	deleteSQL, deleteArgs, err := deleteQuery.ToSql()
	if err != nil {
		return err
	}

	result, err := tx.Exec(ctx, deleteSQL, deleteArgs...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}
