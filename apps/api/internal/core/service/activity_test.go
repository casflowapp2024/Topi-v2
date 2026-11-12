package service

import (
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
)

func expectDay(t *testing.T, want string) func(context.Context, string, time.Time) error {
	return func(_ context.Context, _ string, day time.Time) error {
		if got := day.Format(time.DateOnly); got != want {
			t.Errorf("day = %s, want %s", got, want)
		}
		return nil
	}
}

func TestActivityService_WritesOncePerUserAndDay(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockActivityRepository(ctrl)
	svc := NewActivityService(repo)

	// 04:30 UTC is still 23:30 of the previous day in Bogota: the day is the Bogota one
	now := time.Date(2026, 11, 12, 4, 30, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }

	repo.EXPECT().MarkActive(gomock.Any(), "u1", gomock.Any()).DoAndReturn(expectDay(t, "2026-11-11")).Times(1)
	repo.EXPECT().MarkActive(gomock.Any(), "u2", gomock.Any()).Return(nil).Times(1)

	for i := 0; i < 100; i++ {
		svc.Touch(context.Background(), "u1")
	}
	svc.Touch(context.Background(), "u2")
	svc.Touch(context.Background(), "u2")
	svc.Touch(context.Background(), "") // no user: nothing

	// next day: one more write per user
	now = now.Add(24 * time.Hour)
	repo.EXPECT().MarkActive(gomock.Any(), "u1", gomock.Any()).DoAndReturn(expectDay(t, "2026-11-12")).Times(1)
	svc.Touch(context.Background(), "u1")
	svc.Touch(context.Background(), "u1")
}

func TestActivityService_RetriesAfterError(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockActivityRepository(ctrl)
	svc := NewActivityService(repo)
	svc.now = func() time.Time { return time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC) }

	gomock.InOrder(
		repo.EXPECT().MarkActive(gomock.Any(), "u1", gomock.Any()).Return(errors.New("db down")),
		repo.EXPECT().MarkActive(gomock.Any(), "u1", gomock.Any()).Return(nil),
	)

	svc.Touch(context.Background(), "u1") // fails: not cached
	svc.Touch(context.Background(), "u1") // writes
	svc.Touch(context.Background(), "u1") // cached
}
