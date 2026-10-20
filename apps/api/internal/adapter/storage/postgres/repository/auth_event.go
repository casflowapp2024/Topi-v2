package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"
)

// AuthEventRepository implements port.AuthEventRepository on auth_events
type AuthEventRepository struct {
	db *postgres.DB
}

// NewAuthEventRepository creates a new AuthEventRepository instance
func NewAuthEventRepository(db *postgres.DB) *AuthEventRepository {
	return &AuthEventRepository{
		db: db,
	}
}

// Record inserts an audit event. Empty values are stored as NULL.
func (r *AuthEventRepository) Record(ctx context.Context, event domain.AuthEvent) error {
	sql, args, err := r.db.QueryBuilder.Insert(enums.AuthEventsTableName).
		Columns("user_id", "email", "event", "ip", "user_agent").
		Values(nullable(event.UserID), nullable(event.Email), event.Event, nullable(event.IP), nullable(event.UserAgent)).
		ToSql()
	if err != nil {
		return err
	}

	if _, err = r.db.Exec(ctx, sql, args...); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func nullable(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
