package domain

import "time"

// WorkerStaleAfter is how long without a worker heartbeat before /health reports it as stale.
const WorkerStaleAfter = 10 * time.Minute

const (
	HealthOK    = "ok"
	HealthError = "error"
	HealthStale = "stale"
)

// Health is the state reported by GET /health (monitoring only).
type Health struct {
	Status         string     `json:"status"`
	DB             string     `json:"db"`
	Worker         string     `json:"worker"`
	WorkerLastSeen *time.Time `json:"worker_last_seen"`
}

// NewHealth builds the report. A stale (or never seen) worker does not change the overall
// status: only the database does, because without it the API cannot serve anything.
func NewHealth(dbErr error, workerLastSeen *time.Time, now time.Time) Health {
	health := Health{Status: HealthOK, DB: HealthOK, Worker: HealthOK, WorkerLastSeen: workerLastSeen}
	if dbErr != nil {
		health.Status = HealthError
		health.DB = HealthError
		health.Worker = HealthStale
		health.WorkerLastSeen = nil
		return health
	}
	if workerLastSeen == nil || now.Sub(*workerLastSeen) > WorkerStaleAfter {
		health.Worker = HealthStale
	}
	return health
}
