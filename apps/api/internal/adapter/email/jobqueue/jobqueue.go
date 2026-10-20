// Package jobqueue enqueues email reading requests in the email_jobs table
// (Postgres queue consumed by the worker). It replaces the Saturn/SQS adapter
// and keeps the same payload: domain.ReadEmailBodyRequest as JSON.
package jobqueue

import (
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/pkg/errors"
)

const enqueueTimeout = 5 * time.Second

// Store persists jobs in the queue (implemented by repository.EmailJobRepository)
type Store interface {
	Enqueue(ctx context.Context, payload []byte, priority int16) (int64, error)
}

type Queue struct {
	store Store
}

func New(store Store) *Queue {
	return &Queue{
		store: store,
	}
}

func (q *Queue) ShouldReadEmail(request domain.ReadEmailBodyRequest) bool {
	should := request.Email != "" &&
		request.EmailID != 0 &&
		request.Provider != "" &&
		request.SenderEmail != "" &&
		len(request.Accounts) > 0

	if !should {
		logger.Logger.WithField("sender_email", request.SenderEmail).Debug("skipping email reading request")
	}

	return should
}

// ReadEmail enqueues a high priority job ("leer ahora") and records the result in the resolver.
// The job id is returned as MessageID, as SQS did with its message id.
func (q *Queue) ReadEmail(request domain.ReadEmailBodyRequest, resolver *domain.ReadEmailResolver) {
	defer resolver.WG.Done()

	logFields := logger.Logger.
		WithField("account_ids", request.Accounts).
		WithField("user_id", request.UserID).
		WithField("sender_email", request.SenderEmail)

	logFields.Info("enqueueing email reading job for grouped accounts")

	jobID, err := q.enqueue(request)
	if err != nil {
		logFields.
			WithField("error", err).
			Error("failed to enqueue email reading job")

		resolver.AddRead(domain.Read{
			Accounts:    request.GetAccounts(),
			SenderEmail: request.SenderEmail,
			Error:       err.Error(),
		})

		return
	}

	logFields.
		WithField("job_id", *jobID).
		Info("successfully enqueued email reading job")

	resolver.AddRead(domain.Read{
		Accounts:    request.GetAccounts(),
		SenderEmail: request.SenderEmail,
		MessageID:   jobID,
	})
}

func (q *Queue) enqueue(request domain.ReadEmailBodyRequest) (*string, error) {
	payload, err := json.Marshal(request)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal job payload")
	}

	ctx, cancel := context.WithTimeout(context.Background(), enqueueTimeout)
	defer cancel()

	id, err := q.store.Enqueue(ctx, payload, enums.EmailJobPriorityHigh)
	if err != nil {
		return nil, errors.Wrap(err, "failed to insert email job")
	}

	jobID := strconv.FormatInt(id, 10)
	return &jobID, nil
}
