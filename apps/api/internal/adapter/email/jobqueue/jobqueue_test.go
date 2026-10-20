package jobqueue

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

type fakeStore struct {
	mu       sync.Mutex
	payloads [][]byte
	priority []int16
	nextID   int64
	err      error
}

func (f *fakeStore) Enqueue(_ context.Context, payload []byte, priority int16) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return 0, f.err
	}
	f.payloads = append(f.payloads, payload)
	f.priority = append(f.priority, priority)
	f.nextID++
	return f.nextID, nil
}

func validRequest() domain.ReadEmailBodyRequest {
	return domain.ReadEmailBodyRequest{
		UserID:      "user-123",
		Email:       "user@example.com",
		EmailID:     7,
		Provider:    enums.Gmail,
		SenderEmail: "alertas@banco.com",
		Accounts:    map[string]string{"1234": "10"},
		Onboarding:  true,
	}
}

func TestQueue_ReadEmail(t *testing.T) {
	logger.Set(&config.App{Env: "test"})

	t.Run("should enqueue the SQS payload with high priority", func(t *testing.T) {
		store := &fakeStore{nextID: 41}
		queue := New(store)
		request := validRequest()

		resolver := domain.NewReadEmailResolver(nil)
		resolver.WG.Add(1)
		queue.ReadEmail(request, resolver)
		resolver.WG.Wait()

		assert.Len(t, store.payloads, 1)
		assert.Equal(t, enums.EmailJobPriorityHigh, store.priority[0])

		// payload is exactly the JSON that used to go to SQS
		expected, err := json.Marshal(request)
		assert.NoError(t, err)
		assert.JSONEq(t, string(expected), string(store.payloads[0]))

		var raw map[string]any
		assert.NoError(t, json.Unmarshal(store.payloads[0], &raw))
		for _, key := range []string{"user_id", "user_mail", "email_id", "user_provider", "sender_email", "accounts", "onboarding"} {
			assert.Contains(t, raw, key)
		}

		assert.Len(t, resolver.Reads.Reads, 1)
		read := resolver.Reads.Reads[0]
		assert.Equal(t, "42", *read.MessageID)
		assert.Empty(t, read.Error)
		assert.Equal(t, request.SenderEmail, read.SenderEmail)
		assert.Equal(t, []string{"10"}, read.Accounts)
	})

	t.Run("should report the error when the insert fails", func(t *testing.T) {
		store := &fakeStore{err: errors.New("db down")}
		queue := New(store)

		resolver := domain.NewReadEmailResolver(nil)
		resolver.WG.Add(1)
		queue.ReadEmail(validRequest(), resolver)
		resolver.WG.Wait()

		assert.Len(t, resolver.Reads.Reads, 1)
		read := resolver.Reads.Reads[0]
		assert.Nil(t, read.MessageID)
		assert.Contains(t, read.Error, "db down")
	})
}

func TestQueue_ShouldReadEmail(t *testing.T) {
	logger.Set(&config.App{Env: "test"})
	queue := New(&fakeStore{})

	assert.True(t, queue.ShouldReadEmail(validRequest()))

	missingSender := validRequest()
	missingSender.SenderEmail = ""
	assert.False(t, queue.ShouldReadEmail(missingSender))

	noAccounts := validRequest()
	noAccounts.Accounts = nil
	assert.False(t, queue.ShouldReadEmail(noAccounts))
}
