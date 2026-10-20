package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
)

// RefreshTokenRepository implements port.RefreshTokenRepository on refresh_tokens
type RefreshTokenRepository struct {
	db *postgres.DB
}

// NewRefreshTokenRepository creates a new RefreshTokenRepository instance
func NewRefreshTokenRepository(db *postgres.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{
		db: db,
	}
}

// Create stores the hash of a new refresh token
func (r *RefreshTokenRepository) Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	sql, args, err := r.db.QueryBuilder.Insert(enums.RefreshTokensTableName).
		Columns("user_id", "token_hash", "expires_at").
		Values(userID, tokenHash, expiresAt).
		ToSql()
	if err != nil {
		return err
	}

	if _, err = r.db.Exec(ctx, sql, args...); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

// GetByHash returns the token or domain.ErrDataNotFound
func (r *RefreshTokenRepository) GetByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	sql, args, err := r.db.QueryBuilder.Select("id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at").
		From(enums.RefreshTokensTableName).
		Where(sq.Eq{"token_hash": tokenHash}).
		ToSql()
	if err != nil {
		return nil, err
	}

	var token domain.RefreshToken
	err = r.db.QueryRow(ctx, sql, args...).Scan(
		&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &token.RevokedAt, &token.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrDataNotFound
	}
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &token, nil
}

// Revoke marks the token as revoked if it was still active.
// Returns false when it was already revoked (used for atomic rotation).
func (r *RefreshTokenRepository) Revoke(ctx context.Context, id int64) (bool, error) {
	sql, args, err := r.db.QueryBuilder.Update(enums.RefreshTokensTableName).
		Set("revoked_at", sq.Expr("now()")).
		Where(sq.Eq{"id": id}).
		Where("revoked_at IS NULL").
		ToSql()
	if err != nil {
		return false, err
	}

	tag, err := r.db.Exec(ctx, sql, args...)
	if err != nil {
		return false, mappers.MapPostgresErrorCode(err)
	}

	return tag.RowsAffected() == 1, nil
}

// RevokeAllForUser revokes every active refresh token of the user
func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userID string) error {
	sql, args, err := r.db.QueryBuilder.Update(enums.RefreshTokensTableName).
		Set("revoked_at", sq.Expr("now()")).
		Where(sq.Eq{"user_id": userID}).
		Where("revoked_at IS NULL").
		ToSql()
	if err != nil {
		return err
	}

	if _, err = r.db.Exec(ctx, sql, args...); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}
