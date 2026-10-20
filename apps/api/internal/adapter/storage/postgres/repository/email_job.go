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

// Enqueue inserts a pending job with the given JSON payload and returns its id.
// There is at most one pending/running job per dedupe key (email_jobs_active_dedupe): if one
// exists, it is reused and promoted (higher priority, run now; a pending job also takes the
// new payload) instead of creating a duplicate.
func (r *EmailJobRepository) Enqueue(ctx context.Context, payload []byte, priority int16, dedupeKey string) (int64, error) {
	query := r.db.QueryBuilder.Insert(enums.EmailJobsTable).
		Columns("payload", "priority", "dedupe_key").
		Values(string(payload), priority, dedupeKey).
		Suffix(`ON CONFLICT (dedupe_key) WHERE status IN ('pending','running') AND dedupe_key IS NOT NULL
DO UPDATE SET
  priority = GREATEST(email_jobs.priority, EXCLUDED.priority),
  run_after = LEAST(email_jobs.run_after, now()),
  payload = CASE WHEN email_jobs.status = 'pending' THEN EXCLUDED.payload ELSE email_jobs.payload END,
  updated_at = now()
RETURNING id`)

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
