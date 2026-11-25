package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"time"
)

// LaunchAppService implements port.LaunchService: the criteria of each stage of the rollout against the real
// numbers of the panel (plan/27 §I). Reuses the precomputed metrics (metrics_daily, admin_user_stats).
type LaunchAppService struct {
	repo     port.LaunchRepository
	metrics  port.AdminMetricsRepository
	admin    port.AdminService
	feedback port.FeedbackRepository
	quota    port.GmailQuotaService
	now      func() time.Time
}

// NewLaunchService creates the launch service
func NewLaunchService(repo port.LaunchRepository, metrics port.AdminMetricsRepository, admin port.AdminService,
	feedback port.FeedbackRepository, quota port.GmailQuotaService) *LaunchAppService {
	return &LaunchAppService{repo: repo, metrics: metrics, admin: admin, feedback: feedback, quota: quota, now: time.Now}
}

// Report: stages, activation since the current stage started, UAS and its weekly trend, S4 retention of the cohorts
// since then, Gmail connections vs. the cap, reconnection and unread opinions, and the criteria evaluated
func (s *LaunchAppService) Report(ctx context.Context) (*domain.LaunchReport, error) {
	stages, err := s.repo.Stages(ctx)
	if err != nil {
		return nil, err
	}
	report := &domain.LaunchReport{Stages: stages}

	from := s.now().Add(-domain.LaunchDefaultWindow)
	if current := domain.CurrentStage(stages); current != nil {
		report.Current = current.Stage
		if day, err := time.ParseInLocation(time.DateOnly, current.StartedAt, domain.MetricsLocation()); err == nil {
			from = day
		}
	}
	report.ActivationFrom = from.In(domain.MetricsLocation()).Format(time.DateOnly)
	if report.Activation, err = s.metrics.Activation(ctx, from); err != nil {
		return nil, err
	}

	summary, err := s.admin.Summary(ctx)
	if err != nil {
		return nil, err
	}
	report.UASNow = summary.NorthStar
	report.UASWeeks = summary.NorthStarTrend

	cohorts, err := s.metrics.Cohorts(ctx, 26)
	if err != nil {
		return nil, err
	}
	var eligible, w4 int64
	for _, c := range cohorts {
		if c.Week >= report.ActivationFrom[:10] || report.Current == "" {
			eligible += c.W4Eligible
			w4 += c.W4
		}
	}
	if eligible > 0 {
		pct := domain.Pct(float64(w4), float64(eligible))
		report.RetentionW4Pct = &pct
	}

	quota, err := s.quota.Quota(ctx)
	if err != nil {
		return nil, err
	}
	report.Gmail = *quota

	reading, err := s.metrics.Reading(ctx)
	if err != nil {
		return nil, err
	}
	report.Reconnect = reading.Reconnect

	if s.feedback != nil {
		if report.FeedbackUnread, err = s.feedback.CountUnread(ctx); err != nil {
			return nil, err
		}
	}

	report.EvaluateLaunch()
	return report, nil
}

// SetStage records when a stage started (and the note of the decision), with its audit row
func (s *LaunchAppService) SetStage(ctx context.Context, adminID string, stage domain.LaunchStage) error {
	if err := stage.Validate(s.now().In(domain.MetricsLocation())); err != nil {
		return err
	}
	stage.SetBy = adminID
	if err := s.repo.SetStage(ctx, stage); err != nil {
		return err
	}
	return s.admin.Audit(ctx, domain.AdminAudit{AdminID: adminID, Action: domain.AdminActionLaunchStageSet,
		Target: "stage:" + stage.Stage, Detail: map[string]any{"started_at": stage.StartedAt}})
}
