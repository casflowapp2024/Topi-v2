//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/enums"
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Runs against a real database (migrated to version >= 18):
//
//	DB_HOST=localhost DB_PORT=5432 DB_USER=... DB_PASSWORD=... DB_NAME=... \
//	  go test -tags integration ./internal/adapter/storage/postgres/repository/
func TestEmailJobRepository_Enqueue(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)

	repo := repository.NewEmailJobRepository(db)
	payload := []byte(`{"user_id":"it-test","user_mail":"user@example.com","email_id":1,"user_provider":"gmail","sender_email":"alertas@banco.com","accounts":{"1234":"10"},"onboarding":true}`)

	id, err := repo.Enqueue(ctx, payload, enums.EmailJobPriorityHigh, "")
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM email_jobs WHERE id = $1", id) })

	var (
		status   string
		priority int16
		userID   string
	)
	err = db.QueryRow(ctx, "SELECT status, priority, payload->>'user_id' FROM email_jobs WHERE id = $1", id).
		Scan(&status, &priority, &userID)
	require.NoError(t, err)

	assert.Equal(t, "pending", status)
	assert.Equal(t, enums.EmailJobPriorityHigh, priority)
	assert.Equal(t, "it-test", userID)
}
