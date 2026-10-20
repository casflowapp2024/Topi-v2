package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"time"

	sq "github.com/Masterminds/squirrel"
)

// UserExtraRepository implements the port.UserExtraRepository interface
type UserExtraRepository struct {
	db *postgres.DB
}

// NewUserExtraRepository creates a new UserExtraRepository instance
func NewUserExtraRepository(db *postgres.DB) port.UserExtraRepository {
	return &UserExtraRepository{
		db: db,
	}
}

// Create creates a new user extra information record
func (ur *UserExtraRepository) Create(ctx context.Context, userExtra *domain.UserExtra) error {
	query := ur.db.QueryBuilder.Insert(enums.UserExtraTableName).
		Columns(
			"user_id",
			"utc_offset",
			"whatsapp",
			"onboarding_completed",
			"email",
			"name",
			"last_name",
			"read_email",
			"config",
		).
		Values(
			userExtra.UserID,
			userExtra.UTCOffset,
			userExtra.Whatsapp,
			userExtra.OnboardingCompleted,
			userExtra.Email,
			userExtra.Name,
			userExtra.LastName,
			userExtra.ReadEmail,
			userExtra.Config,
		).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = ur.db.QueryRow(ctx, sql, args...).Scan(
		&userExtra.ID,
		&userExtra.UserID,
		&userExtra.UTCOffset,
		&userExtra.Whatsapp,
		&userExtra.WhatsappState,
		&userExtra.CreatedAt,
		&userExtra.UpdatedAt,
		&userExtra.OnboardingCompleted,
		&userExtra.OnboardingCreatedAt,
		&userExtra.Email,
		&userExtra.Name,
		&userExtra.LastName,
		&userExtra.ReadEmail,
		&userExtra.Config,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

// GetByUserID retrieves user extra information by user ID
func (ur *UserExtraRepository) GetByUserID(ctx context.Context, userID string) (*domain.UserExtra, error) {
	var userExtra domain.UserExtra

	query := ur.db.QueryBuilder.Select("*").
		From(enums.UserExtraTableName).
		Where(sq.Eq{"user_id": userID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = ur.db.QueryRow(ctx, sql, args...).Scan(
		&userExtra.ID,
		&userExtra.UserID,
		&userExtra.UTCOffset,
		&userExtra.Whatsapp,
		&userExtra.WhatsappState,
		&userExtra.CreatedAt,
		&userExtra.UpdatedAt,
		&userExtra.OnboardingCompleted,
		&userExtra.OnboardingCreatedAt,
		&userExtra.Email,
		&userExtra.Name,
		&userExtra.LastName,
		&userExtra.ReadEmail,
		&userExtra.Config,
	)

	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &userExtra, nil
}

// GetByID retrieves user extra information by user ID
func (ur *UserExtraRepository) GetByID(ctx context.Context, ID uint64) (*domain.UserExtra, error) {
	var userExtra domain.UserExtra

	query := ur.db.QueryBuilder.Select("*").
		From(enums.UserExtraTableName).
		Where(sq.Eq{"id": ID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = ur.db.QueryRow(ctx, sql, args...).Scan(
		&userExtra.ID,
		&userExtra.UserID,
		&userExtra.UTCOffset,
		&userExtra.Whatsapp,
		&userExtra.WhatsappState,
		&userExtra.CreatedAt,
		&userExtra.UpdatedAt,
		&userExtra.OnboardingCompleted,
		&userExtra.OnboardingCreatedAt,
		&userExtra.Email,
		&userExtra.Name,
		&userExtra.LastName,
		&userExtra.ReadEmail,
		&userExtra.Config,
	)

	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &userExtra, nil
}

// Update updates user extra information
func (ur *UserExtraRepository) Update(ctx context.Context, userExtra *domain.UserExtra) error {
	whatsapp := utils.NullString(userExtra.Whatsapp)
	whatsappState := utils.NullString(userExtra.WhatsappState)
	email := utils.NullString(userExtra.Email)
	name := utils.NullString(userExtra.Name)
	lastName := utils.NullString(userExtra.LastName)

	query := ur.db.QueryBuilder.Update(enums.UserExtraTableName).
		Set("email", sq.Expr("COALESCE(?, email)", email)).
		Set("name", sq.Expr("COALESCE(?, name)", name)).
		Set("last_name", sq.Expr("COALESCE(?, last_name)", lastName)).
		Set("utc_offset", userExtra.UTCOffset).
		Set("whatsapp", sq.Expr("COALESCE(?, whatsapp)", whatsapp)).
		Set("whatsapp_state", sq.Expr("COALESCE(?, whatsapp_state)", whatsappState)).
		Set("onboarding_completed", userExtra.OnboardingCompleted).
		Set("read_email", userExtra.ReadEmail).
		Set("config", userExtra.Config).
		Set("updated_at", time.Now()).
		Where(sq.Eq{"user_id": userExtra.UserID}).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = ur.db.QueryRow(ctx, sql, args...).Scan(
		&userExtra.ID,
		&userExtra.UserID,
		&userExtra.UTCOffset,
		&userExtra.Whatsapp,
		&userExtra.WhatsappState,
		&userExtra.CreatedAt,
		&userExtra.UpdatedAt,
		&userExtra.OnboardingCompleted,
		&userExtra.OnboardingCreatedAt,
		&userExtra.Email,
		&userExtra.Name,
		&userExtra.LastName,
		&userExtra.ReadEmail,
		&userExtra.Config,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

// Delete deletes user extra information
func (ur *UserExtraRepository) Delete(ctx context.Context, ID uint64) error {
	query := ur.db.QueryBuilder.Delete(enums.UserExtraTableName).
		Where(sq.Eq{"id": ID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	result, err := ur.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}

// GetAll retrieves all user extra information records
func (ur *UserExtraRepository) GetAll(ctx context.Context) ([]*domain.UserExtra, error) {
	query := ur.db.QueryBuilder.Select("*").
		From(enums.UserExtraTableName)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := ur.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	userExtras := make([]*domain.UserExtra, 0)
	for rows.Next() {
		var userExtra domain.UserExtra
		err = rows.Scan(
			&userExtra.ID,
			&userExtra.UserID,
			&userExtra.UTCOffset,
			&userExtra.Whatsapp,
			&userExtra.WhatsappState,
			&userExtra.CreatedAt,
			&userExtra.UpdatedAt,
			&userExtra.OnboardingCompleted,
			&userExtra.OnboardingCreatedAt,
			&userExtra.Email,
			&userExtra.Name,
			&userExtra.LastName,
			&userExtra.ReadEmail,
			&userExtra.Config,
		)

		if err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}

		userExtras = append(userExtras, &userExtra)
	}

	return userExtras, nil
}

// UpdateReadEmailByUserID updates only the read_email field for a specific user extra record by user_id
func (ur *UserExtraRepository) UpdateReadEmailByUserID(ctx context.Context, userID string, readEmail bool) error {
	query := ur.db.QueryBuilder.Update(enums.UserExtraTableName).
		Set("read_email", readEmail).
		Set("updated_at", time.Now()).
		Where(sq.Eq{"user_id": userID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	result, err := ur.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if result.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}

	return nil
}
