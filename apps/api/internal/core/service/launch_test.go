package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLaunch_Report(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 11, 20, 15, 0, 0, 0, time.UTC)

	setup := func(t *testing.T, stages []domain.LaunchStage, wantFrom time.Time) *LaunchAppService {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockLaunchRepository(ctrl)
		metrics := mock.NewMockAdminMetricsRepository(ctrl)
		admin := mock.NewMockAdminService(ctrl)
		feedback := mock.NewMockFeedbackRepository(ctrl)
		repo.EXPECT().Stages(gomock.Any()).Return(stages, nil)
		metrics.EXPECT().Activation(gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, from time.Time) (domain.ActivationRates, error) {
			assert.True(t, from.Equal(wantFrom), "activation measured from %s, want %s", from, wantFrom)
			return domain.ActivationRates{Signups: 10, Connection24hPct: 70, FirstAuto48hPct: 50}, nil
		})
		admin.EXPECT().Summary(gomock.Any()).Return(&domain.AdminSummary{NorthStar: 12,
			NorthStarTrend: []domain.DayValue{{Day: "2026-11-13", Value: 8}, {Day: "2026-11-20", Value: 12}}}, nil)
		metrics.EXPECT().Cohorts(gomock.Any(), 26).Return([]domain.Cohort{
			{Week: "2026-11-09", W4Eligible: 4, W4: 1}, {Week: "2026-11-16", W4Eligible: 0}, {Week: "2026-10-05", W4Eligible: 10, W4: 9},
		}, nil)
		repo.EXPECT().GmailGrants(gomock.Any(), gomock.Any()).Return(domain.GmailGrants{Total: 21}, nil)
		repo.EXPECT().GmailConnections(gomock.Any()).Return(int64(19), nil)
		metrics.EXPECT().Reading(gomock.Any()).Return(domain.ReadingHealth{Reconnect: domain.ReconnectStats{Open: 1}}, nil)
		feedback.EXPECT().CountUnread(gomock.Any()).Return(int64(2), nil)
		svc := NewLaunchService(repo, metrics, admin, feedback, NewGmailQuotaService(repo, nil, admin, domain.GmailQuotaSettings{}, ""))
		svc.now = func() time.Time { return now }
		return svc
	}

	t.Run("since the current stage started", func(t *testing.T) {
		bogota := domain.MetricsLocation()
		svc := setup(t, []domain.LaunchStage{{Stage: domain.StageI1, StartedAt: "2026-11-09"}},
			time.Date(2026, 11, 9, 0, 0, 0, 0, bogota))
		report, err := svc.Report(ctx)
		require.NoError(t, err)
		assert.Equal(t, domain.StageI1, report.Current)
		assert.Equal(t, "2026-11-09", report.ActivationFrom)
		require.NotNil(t, report.RetentionW4Pct)
		assert.InDelta(t, 25.0, *report.RetentionW4Pct, 0.01, "only the cohorts since the stage started")
		assert.Equal(t, int64(19), report.Gmail.Connected)
		assert.Equal(t, int64(21), report.Gmail.Used, "the accounts that ever connected, not only today's")
		assert.Equal(t, int64(20), report.Gmail.Threshold)
		assert.Equal(t, int64(2), report.FeedbackUnread)
		assert.NotEmpty(t, report.Criteria)
	})

	t.Run("no stage yet: last 30 days", func(t *testing.T) {
		svc := setup(t, nil, now.Add(-domain.LaunchDefaultWindow))
		report, err := svc.Report(ctx)
		require.NoError(t, err)
		assert.Equal(t, "", report.Current)
	})
}

func TestLaunch_SetStageAudits(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockLaunchRepository(ctrl)
	admin := mock.NewMockAdminService(ctrl)
	svc := NewLaunchService(repo, nil, admin, nil, nil)
	svc.now = func() time.Time { return time.Date(2026, 11, 20, 15, 0, 0, 0, time.UTC) }

	repo.EXPECT().SetStage(gomock.Any(), domain.LaunchStage{Stage: "I.1", StartedAt: "2026-11-15", Note: "cercanos", SetBy: "a1"}).Return(nil)
	admin.EXPECT().Audit(gomock.Any(), domain.AdminAudit{AdminID: "a1", Action: domain.AdminActionLaunchStageSet,
		Target: "stage:I.1", Detail: map[string]any{"started_at": "2026-11-15"}}).Return(nil)
	require.NoError(t, svc.SetStage(context.Background(), "a1", domain.LaunchStage{Stage: "I.1", StartedAt: "2026-11-15", Note: "cercanos"}))

	assert.ErrorIs(t, svc.SetStage(context.Background(), "a1", domain.LaunchStage{Stage: "I.1", StartedAt: "2027-01-01"}), domain.ErrInvalidLaunchStage)
}
