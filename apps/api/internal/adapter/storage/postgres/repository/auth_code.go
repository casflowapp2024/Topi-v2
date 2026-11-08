package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// AuthCodeRepository implements port.AuthCodeRepository on auth_codes
type AuthCodeRepository struct {
	db *postgres.DB
}

// NewAuthCodeRepository creates a new AuthCodeRepository instance
func NewAuthCodeRepository(db *postgres.DB) *AuthCodeRepository {
	return &AuthCodeRepository{db: db}
}

// Create stores a new code and invalidates (marks used) the previous active ones of the purpose
func (r *AuthCodeRepository) Create(ctx context.Context, userID, purpose, codeHash string, expiresAt time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err = tx.Exec(ctx, `UPDATE auth_codes SET used_at = now()
WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, userID, purpose); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	if _, err = tx.Exec(ctx, `INSERT INTO auth_codes (user_id, purpose, code_hash, expires_at)
VALUES ($1, $2, $3, $4)`, userID, purpose, codeHash, expiresAt); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	// old codes are not useful: keep the table small
	if _, err = tx.Exec(ctx, `DELETE FROM auth_codes WHERE user_id = $1 AND created_at < now() - interval '30 days'`,
		userID); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return tx.Commit(ctx)
}

// GetLatest returns the latest unused code of the purpose
func (r *AuthCodeRepository) GetLatest(ctx context.Context, userID, purpose string) (*domain.AuthCode, error) {
	var code domain.AuthCode
	err := r.db.QueryRow(ctx, `SELECT id, user_id, purpose, code_hash, attempts, expires_at, used_at, created_at
FROM auth_codes WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL
ORDER BY created_at DESC, id DESC LIMIT 1`, userID, purpose).Scan(
		&code.ID, &code.UserID, &code.Purpose, &code.CodeHash, &code.Attempts, &code.ExpiresAt, &code.UsedAt, &code.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrDataNotFound
	}
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	return &code, nil
}

// IncrementAttempts adds one attempt and returns the new count
func (r *AuthCodeRepository) IncrementAttempts(ctx context.Context, id int64) (int, error) {
	var attempts int
	err := r.db.QueryRow(ctx, `UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`, id).Scan(&attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, domain.ErrDataNotFound
	}
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}
	return attempts, nil
}

// MarkUsed marks the code as used; false when another request used it first
func (r *AuthCodeRepository) MarkUsed(ctx context.Context, id int64) (bool, error) {
	tag, err := r.db.Exec(ctx, `UPDATE auth_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL`, id)
	if err != nil {
		return false, mappers.MapPostgresErrorCode(err)
	}
	return tag.RowsAffected() == 1, nil
}
