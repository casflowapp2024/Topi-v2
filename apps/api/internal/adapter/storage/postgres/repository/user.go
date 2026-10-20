package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"
	"errors"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
)

var userColumns = []string{
	"id", "email", "password_hash", "name", "last_name", "role",
	"migrated", "password_set_at", "token_version", "created_at", "updated_at",
}

// UserRepository implements port.UserRepository on the users table
type UserRepository struct {
	db *postgres.DB
}

// NewUserRepository creates a new UserRepository instance
func NewUserRepository(db *postgres.DB) *UserRepository {
	return &UserRepository{
		db: db,
	}
}

// CreateUser inserts a new user. A duplicated email returns domain.ErrUsernameExistsException
func (ur *UserRepository) CreateUser(ctx context.Context, user *domain.User) error {
	query := ur.db.QueryBuilder.Insert(enums.UsersTableName).
		Columns("id", "email", "password_hash", "name", "last_name", "role", "password_set_at").
		Values(user.ID, user.Email, user.PasswordHash, user.Name, user.LastName, user.Role, user.PasswordSetAt).
		Suffix("RETURNING created_at, updated_at")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = ur.db.QueryRow(ctx, sql, args...).Scan(&user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		mapped := mappers.MapPostgresErrorCode(err)
		if errors.Is(mapped, domain.ErrConflictingData) {
			return domain.ErrUsernameExistsException
		}
		return mapped
	}

	return nil
}

// GetUserByID returns the user or domain.ErrUserNotFoundException
func (ur *UserRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	return ur.getOne(ctx, sq.Eq{"id": id})
}

// GetUserByEmail returns the user (case-insensitive email) or domain.ErrUserNotFoundException
func (ur *UserRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	return ur.getOne(ctx, sq.Expr("lower(email) = lower(?)", email))
}

// SetInitialPassword sets the password only if the user has none.
// The condition is part of the UPDATE so concurrent requests cannot both succeed:
// when no row is updated it returns domain.ErrNotAuthorizedException.
func (ur *UserRepository) SetInitialPassword(ctx context.Context, id string, passwordHash string) error {
	query := ur.db.QueryBuilder.Update(enums.UsersTableName).
		Set("password_hash", passwordHash).
		Set("password_set_at", sq.Expr("now()")).
		Set("updated_at", sq.Expr("now()")).
		Where(sq.Eq{"id": id}).
		Where("password_hash IS NULL")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	tag, err := ur.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if tag.RowsAffected() == 0 {
		return domain.ErrNotAuthorizedException
	}

	return nil
}

// UpdatePassword replaces the password and increments token_version (invalidates sessions).
// Returns the new token_version.
func (ur *UserRepository) UpdatePassword(ctx context.Context, id string, passwordHash string) (int, error) {
	query := ur.db.QueryBuilder.Update(enums.UsersTableName).
		Set("password_hash", passwordHash).
		Set("password_set_at", sq.Expr("now()")).
		Set("token_version", sq.Expr("token_version + 1")).
		Set("updated_at", sq.Expr("now()")).
		Where(sq.Eq{"id": id}).
		Suffix("RETURNING token_version")

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, err
	}

	var version int
	err = ur.db.QueryRow(ctx, sql, args...).Scan(&version)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, domain.ErrUserNotFoundException
	}
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}

	return version, nil
}

// UpdateProfile updates name and last name in users and keeps user_extra in sync (same transaction)
func (ur *UserRepository) UpdateProfile(ctx context.Context, id, name, lastName string) error {
	tx, err := ur.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	usersSQL, args, err := ur.db.QueryBuilder.Update(enums.UsersTableName).
		Set("name", name).
		Set("last_name", lastName).
		Set("updated_at", sq.Expr("now()")).
		Where(sq.Eq{"id": id}).
		ToSql()
	if err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, usersSQL, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFoundException
	}

	extraSQL, args, err := ur.db.QueryBuilder.Update(enums.UserExtraTableName).
		Set("name", name).
		Set("last_name", lastName).
		Set("updated_at", sq.Expr("now()")).
		Where(sq.Eq{"user_id": id}).
		ToSql()
	if err != nil {
		return err
	}

	if _, err = tx.Exec(ctx, extraSQL, args...); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return tx.Commit(ctx)
}

func (ur *UserRepository) getOne(ctx context.Context, where sq.Sqlizer) (*domain.User, error) {
	sql, args, err := ur.db.QueryBuilder.Select(userColumns...).
		From(enums.UsersTableName).
		Where(where).
		Limit(1).
		ToSql()
	if err != nil {
		return nil, err
	}

	var user domain.User
	err = ur.db.QueryRow(ctx, sql, args...).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.LastName,
		&user.Role,
		&user.Migrated,
		&user.PasswordSetAt,
		&user.TokenVersion,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrUserNotFoundException
	}
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	// There is no email verification anymore: every stored user is verified
	user.Verified = true

	return &user, nil
}
