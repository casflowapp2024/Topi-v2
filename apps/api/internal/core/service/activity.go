package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"log/slog"
	"sync"
	"time"
)

// activityWriteTimeout bounds the only write of the day of a user (it runs inside a request)
const activityWriteTimeout = 2 * time.Second

// ActivityService implements port.ActivityTracker with a cache in memory: the first request of a user in
// a day writes user_activity_days (ON CONFLICT DO NOTHING), the rest of the day nothing. With several API
// instances each one writes once at most, and the table keeps one row.
type ActivityService struct {
	repo port.ActivityRepository
	now  func() time.Time

	mu  sync.Mutex
	day time.Time
	// seen holds the users already written today; it is emptied when the day changes
	seen map[string]struct{}
}

// NewActivityService creates an ActivityService
func NewActivityService(repo port.ActivityRepository) *ActivityService {
	return &ActivityService{repo: repo, now: time.Now, seen: map[string]struct{}{}}
}

// Touch marks the user as active today. Errors are logged and the next request tries again.
func (s *ActivityService) Touch(ctx context.Context, userID string) {
	if userID == "" {
		return
	}
	day := domain.ActivityDay(s.now())

	s.mu.Lock()
	if !day.Equal(s.day) {
		s.day = day
		s.seen = map[string]struct{}{}
	}
	if _, ok := s.seen[userID]; ok {
		s.mu.Unlock()
		return
	}
	s.seen[userID] = struct{}{}
	s.mu.Unlock()

	writeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), activityWriteTimeout)
	defer cancel()
	if err := s.repo.MarkActive(writeCtx, userID, day); err != nil {
		slog.Warn("could not record user activity", "error", err)
		s.mu.Lock()
		if day.Equal(s.day) {
			delete(s.seen, userID)
		}
		s.mu.Unlock()
	}
}
