package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/enums"
	"context"
)

// EmailJobRepository persists email reading jobs in the email_jobs table.
// The table is the queue consumed by the worker (replaces SQS).
type EmailJobRepository struct {
	db *postgres.DB
}

func NewEmailJobRepository(db *postgres.DB) *EmailJobRepository {
	return &EmailJobRepository{
		db: db,
	}
}

// Enqueue inserts a pending job with the given JSON payload and returns its id
func (r *EmailJobRepository) Enqueue(ctx context.Context, payload []byte, priority int16) (int64, error) {
	query := r.db.QueryBuilder.Insert(enums.EmailJobsTable).
		Columns("payload", "priority").
		Values(string(payload), priority).
		Suffix("RETURNING id")

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, err
	}

	var id int64
	err = r.db.QueryRow(ctx, sql, args...).Scan(&id)
	if err != nil {
		return 0, err
	}

	return id, nil
}
