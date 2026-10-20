// Package ratelimit implements port.RateLimiter in memory (single API instance).
package ratelimit

import (
	"sync"
	"time"
)

// maxKeys triggers a cleanup of expired windows to bound memory
const maxKeys = 10000

type window struct {
	start time.Time
	count int
}

// Memory is a fixed-window rate limiter: at most `limit` calls per key per `period`
type Memory struct {
	mu      sync.Mutex
	limit   int
	period  time.Duration
	windows map[string]*window
	now     func() time.Time
}

// NewMemory creates a limiter. limit <= 0 disables it.
func NewMemory(limit int, period time.Duration) *Memory {
	return &Memory{
		limit:   limit,
		period:  period,
		windows: make(map[string]*window),
		now:     time.Now,
	}
}

// Allow registers a call for the key and reports whether it is within the limit
func (m *Memory) Allow(key string) bool {
	if m.limit <= 0 {
		return true
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.now()

	w, ok := m.windows[key]
	if !ok || now.Sub(w.start) >= m.period {
		if !ok && len(m.windows) >= maxKeys {
			m.cleanup(now)
		}
		m.windows[key] = &window{start: now, count: 1}
		return true
	}

	w.count++

	return w.count <= m.limit
}

func (m *Memory) cleanup(now time.Time) {
	for key, w := range m.windows {
		if now.Sub(w.start) >= m.period {
			delete(m.windows, key)
		}
	}
}
