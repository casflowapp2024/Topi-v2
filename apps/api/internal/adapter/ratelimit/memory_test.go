package ratelimit

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMemory_Allow(t *testing.T) {
	now := time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC)
	limiter := NewMemory(3, time.Minute)
	limiter.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		assert.True(t, limiter.Allow("login:ip:1.2.3.4"), "call %d", i+1)
	}
	assert.False(t, limiter.Allow("login:ip:1.2.3.4"), "4th call in the window is rejected")

	// other keys are independent
	assert.True(t, limiter.Allow("login:ip:5.6.7.8"))

	// a new window starts after the period
	now = now.Add(time.Minute)
	assert.True(t, limiter.Allow("login:ip:1.2.3.4"))
}

func TestMemory_Disabled(t *testing.T) {
	limiter := NewMemory(0, time.Minute)
	for i := 0; i < 100; i++ {
		assert.True(t, limiter.Allow("k"))
	}
}

func TestMemory_CleanupBoundsMemory(t *testing.T) {
	now := time.Now()
	limiter := NewMemory(1, time.Minute)
	limiter.now = func() time.Time { return now }

	for i := 0; i < maxKeys; i++ {
		limiter.Allow(strconv.Itoa(i))
	}
	now = now.Add(2 * time.Minute)
	limiter.Allow("new-key")

	assert.Len(t, limiter.windows, 1)
}
