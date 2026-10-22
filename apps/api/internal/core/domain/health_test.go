package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewHealth(t *testing.T) {
	now := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	recent := now.Add(-2 * time.Minute)
	old := now.Add(-11 * time.Minute)

	h := NewHealth(nil, &recent, now)
	assert.Equal(t, Health{Status: HealthOK, DB: HealthOK, Worker: HealthOK, WorkerLastSeen: &recent}, h)

	h = NewHealth(nil, &old, now)
	assert.Equal(t, HealthOK, h.Status, "un worker stale no cambia el estado general")
	assert.Equal(t, HealthStale, h.Worker)
	assert.Equal(t, &old, h.WorkerLastSeen)

	h = NewHealth(nil, nil, now)
	assert.Equal(t, HealthOK, h.Status)
	assert.Equal(t, HealthStale, h.Worker)
	assert.Nil(t, h.WorkerLastSeen)

	h = NewHealth(errors.New("db down"), &recent, now)
	assert.Equal(t, Health{Status: HealthError, DB: HealthError, Worker: HealthStale}, h)
}
