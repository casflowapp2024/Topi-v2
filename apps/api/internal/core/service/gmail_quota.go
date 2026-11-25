package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"time"
)

// GmailQuotaAppService implements port.GmailQuotaService, the alerts to the team and their MailEnricher
// (plan/28 §7): every GmailAlertStep accounts, weekly from GmailWeeklyFrom, and no new Gmail connections from
// BlockAt while Google has not verified the app.
type GmailQuotaAppService struct {
	repo     port.LaunchRepository
	mail     port.MailService
	admin    port.AdminService
	settings domain.GmailQuotaSettings
	team     string // the team mailbox (MAIL_REPLY_TO); "" = no emails, the panel still shows it
	now      func() time.Time
}

// NewGmailQuotaService creates the quota service
func NewGmailQuotaService(repo port.LaunchRepository, mail port.MailService, admin port.AdminService,
	settings domain.GmailQuotaSettings, team string) *GmailQuotaAppService {
	return &GmailQuotaAppService{repo: repo, mail: mail, admin: admin, settings: settings, team: team, now: time.Now}
}

// Quota: accounts used (estimated), connected today and the state of the cap
func (s *GmailQuotaAppService) Quota(ctx context.Context) (*domain.GmailQuota, error) {
	grants, err := s.repo.GmailGrants(ctx, s.settings.BaselineAt)
	if err != nil {
		return nil, err
	}
	connected, err := s.repo.GmailConnections(ctx)
	if err != nil {
		return nil, err
	}
	q := domain.NewGmailQuota(s.settings, grants, connected)
	return &q, nil
}

// CanConnectNew: false once BlockAt accounts are used (and Google has not verified the app)
func (s *GmailQuotaAppService) CanConnectNew(ctx context.Context) (bool, error) {
	if s.settings.Verified {
		return true, nil
	}
	q, err := s.Quota(ctx)
	if err != nil {
		return false, err
	}
	return !q.Blocked, nil
}

// ScheduleAlerts queues, to the team, "ya van N cuentas" once per multiple of GmailAlertStep, once when new
// connections stop being offered, and the weekly summary from GmailWeeklyFrom. The dedupe keys of the outbox make
// each one happen once; the numbers are filled when sending.
func (s *GmailQuotaAppService) ScheduleAlerts(ctx context.Context) (int, error) {
	if s.mail == nil || s.team == "" || s.settings.Verified {
		return 0, nil
	}
	q, err := s.Quota(ctx)
	if err != nil {
		return 0, err
	}
	queued := 0
	enqueue := func(template, key string, payload map[string]any) {
		raw, _ := json.Marshal(payload)
		if _, err := s.mail.Enqueue(ctx, domain.OutboxEmail{
			To: s.team, Template: template, Payload: raw, Priority: domain.MailPriorityNotification, DedupeKey: &key,
		}); err != nil {
			slog.Error("gmail quota: could not queue", "template", template, "error", err)
			return
		}
		queued++
	}
	if q.Threshold >= domain.GmailAlertStep {
		enqueue(domain.TemplateGmailQuota, domain.TemplateGmailQuota+":"+strconv.FormatInt(q.Threshold, 10),
			map[string]any{"threshold": q.Threshold, "blocked": false})
	}
	if q.Blocked {
		enqueue(domain.TemplateGmailQuota, domain.TemplateGmailQuota+":blocked:"+strconv.FormatInt(q.BlockAt, 10),
			map[string]any{"threshold": q.BlockAt, "blocked": true})
	}
	if q.Weekly {
		week := domain.GmailWeekKey(s.now())
		enqueue(domain.TemplateGmailQuotaWeekly, domain.TemplateGmailQuotaWeekly+":"+week, map[string]any{"week": week})
	}
	return queued, nil
}

// RunScheduler checks the quota every interval
func (s *GmailQuotaAppService) RunScheduler(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if n, err := s.ScheduleAlerts(ctx); err != nil {
			slog.Error("gmail quota: could not schedule", "error", err)
		} else if n > 0 {
			slog.Info("gmail quota: queued", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Enrich fills gmail_quota and gmail_quota_weekly when sending (implements MailEnricher): the numbers of now, and for
// the weekly one the active users. Cancelled once Google verified the app.
func (s *GmailQuotaAppService) Enrich(ctx context.Context, email domain.OutboxEmail, data map[string]any) error {
	if s.settings.Verified {
		return domain.ErrMailCancelled
	}
	q, err := s.Quota(ctx)
	if err != nil {
		return err
	}
	data["used"] = q.Used
	data["cap"] = q.Cap
	data["left"] = q.Left()
	data["block_at"] = q.BlockAt
	data["connected"] = q.Connected
	data["is_blocked"] = q.Blocked
	data["casa"] = q.Used >= domain.GmailWeeklyFrom
	if email.Template == domain.TemplateGmailQuotaWeekly {
		summary, err := s.admin.Summary(ctx)
		if err != nil {
			return err
		}
		data["uas"] = int64(summary.NorthStar)
		data["wau"] = int64(summary.WAU)
		data["signups_7d"] = int64(summary.Signups7d)
	}
	return nil
}
