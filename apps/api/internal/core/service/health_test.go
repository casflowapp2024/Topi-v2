package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestHealthService_Check(t *testing.T) {
	now := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	recent := now.Add(-time.Minute)

	tests := []struct {
		name  string
		setup func(m *mock.MockHealthRepository)
		want  domain.Health
	}{
		{
			name: "db y worker ok",
			setup: func(m *mock.MockHealthRepository) {
				m.EXPECT().Ping(gomock.Any()).Return(nil)
				m.EXPECT().WorkerLastSeen(gomock.Any()).Return(&recent, nil)
			},
			want: domain.Health{Status: "ok", DB: "ok", Worker: "ok", WorkerLastSeen: &recent},
		},
		{
			name: "worker sin heartbeat",
			setup: func(m *mock.MockHealthRepository) {
				m.EXPECT().Ping(gomock.Any()).Return(nil)
				m.EXPECT().WorkerLastSeen(gomock.Any()).Return(nil, nil)
			},
			want: domain.Health{Status: "ok", DB: "ok", Worker: "stale"},
		},
		{
			name: "db caída",
			setup: func(m *mock.MockHealthRepository) {
				m.EXPECT().Ping(gomock.Any()).Return(errors.New("connection refused"))
			},
			want: domain.Health{Status: "error", DB: "error", Worker: "stale"},
		},
		{
			name: "falla la consulta del heartbeat",
			setup: func(m *mock.MockHealthRepository) {
				m.EXPECT().Ping(gomock.Any()).Return(nil)
				m.EXPECT().WorkerLastSeen(gomock.Any()).Return(nil, errors.New("timeout"))
			},
			want: domain.Health{Status: "error", DB: "error", Worker: "stale"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockHealthRepository(ctrl)
			tc.setup(repo)
			svc := NewHealthService(repo)
			svc.now = func() time.Time { return now }

			assert.Equal(t, tc.want, svc.Check(context.Background()))
		})
	}
}
