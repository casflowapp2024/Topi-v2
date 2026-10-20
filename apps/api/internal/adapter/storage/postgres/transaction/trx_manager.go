package transaction

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"context"

	"github.com/jackc/pgx/v5"
)

// Manager implements port.TransactionManager interface
// and provides transaction management capabilities for postgres DB
type Manager struct {
	db *postgres.DB
}

// NewTransactionManager creates a new transaction manager instance
func NewTransactionManager(db *postgres.DB) *Manager {
	return &Manager{
		db: db,
	}
}

// WithTransaction executes the given function within a transaction
// If the function returns an error, the transaction is rolled back
// If no error is returned, the transaction is committed
func (tm *Manager) WithTransaction(ctx context.Context, fn func(ctx context.Context, tx pgx.Tx) error) error {
	tx, err := tm.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	if err = fn(ctx, tx); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// BeginTrx starts a new transaction
func (tm *Manager) BeginTrx(ctx context.Context) (pgx.Tx, error) {
	tx, err := tm.db.Begin(ctx)
	if err != nil {
		return nil, domain.ErrBeginTrx
	}

	return tx, nil
}
