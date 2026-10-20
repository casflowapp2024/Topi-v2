package port

import (
	"context"

	"github.com/jackc/pgx/v5"
)

//go:generate mockgen -source=trx_manager.go -destination=mock/trx_manager.go -package=mock

// TransactionManager is an interface for managing database transactions
type TransactionManager interface {
	// WithTransaction executes a function within a transaction context
	WithTransaction(ctx context.Context, fn func(ctx context.Context, tx pgx.Tx) error) error
	// BeginTrx starts a new transaction
	BeginTrx(ctx context.Context) (pgx.Tx, error)
}
