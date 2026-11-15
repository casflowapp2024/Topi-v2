package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"log/slog"
	"strconv"
	"time"
)

// feedbackListLimit bounds what the panel loads at once
const feedbackListLimit = 200

// FeedbackSettings: where the "hay opiniones nuevas" notice goes ("" = no notice)
type FeedbackSettings struct {
	TeamAddress string
}

// FeedbackAppService implements port.FeedbackService and the MailEnricher of admin_feedback (plan/27 §E)
type FeedbackAppService struct {
	repo     port.FeedbackRepository
	mail     port.MailService
	events   port.ProductEventRecorder
	audit    port.AdminService
	settings FeedbackSettings
	now      func() time.Time
}

// NewFeedbackService creates the feedback service
func NewFeedbackService(repo port.FeedbackRepository, mail port.MailService, events port.ProductEventRecorder,
	audit port.AdminService, settings FeedbackSettings) *FeedbackAppService {
	return &FeedbackAppService{repo: repo, mail: mail, events: events, audit: audit, settings: settings, now: time.Now}
}

// Submit stores an opinion (max FeedbackDailyLimit per user and Bogotá day) and, at most once per hour, emails
// the team "hay N opiniones nuevas". The text never leaves the database: not in the outbox, not in the logs.
func (s *FeedbackAppService) Submit(ctx context.Context, userID string, feedback domain.Feedback) error {
	if err := feedback.Normalize(); err != nil {
		return err
	}
	local := s.now().In(enums.BogotaLocation)
	startOfDay := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, enums.BogotaLocation)
	count, err := s.repo.CountSince(ctx, userID, startOfDay)
	if err != nil {
		return err
	}
	if count >= domain.FeedbackDailyLimit {
		return domain.ErrLimitExceededException
	}

	feedback.UserID = userID
	if err = s.repo.Create(ctx, &feedback); err != nil {
		return err
	}
	emit(ctx, s.events, domain.ProductEvent{UserID: userID, Name: domain.ProductEventFeedbackSent})
	s.noticeTeam(ctx)
	return nil
}

// noticeTeam queues admin_feedback once per hour (dedupe by hour); the count is filled when sending
func (s *FeedbackAppService) noticeTeam(ctx context.Context) {
	if s.mail == nil || s.settings.TeamAddress == "" {
		return
	}
	hour := s.now().UTC().Truncate(domain.FeedbackNoticeEvery)
	key := domain.TemplateAdminFeedback + ":" + strconv.FormatInt(hour.Unix(), 10)
	if _, err := s.mail.Enqueue(ctx, domain.OutboxEmail{
		To:        s.settings.TeamAddress,
		Template:  domain.TemplateAdminFeedback,
		Priority:  domain.MailPriorityNotification,
		DedupeKey: &key,
		// at the end of the hour: several opinions in the same hour go in one email
		SendAfter: hour.Add(domain.FeedbackNoticeEvery),
	}); err != nil {
		slog.Error("feedback: could not queue the team notice", "error", err)
	}
}

// List is the panel's "Opiniones"
func (s *FeedbackAppService) List(ctx context.Context, unreadOnly bool) (*domain.FeedbackPage, error) {
	items, err := s.repo.List(ctx, unreadOnly, feedbackListLimit)
	if err != nil {
		return nil, err
	}
	unread, err := s.repo.CountUnread(ctx)
	if err != nil {
		return nil, err
	}
	return &domain.FeedbackPage{Items: items, Unread: unread}, nil
}

// MarkRead marks one opinion as read, with its own audit row
func (s *FeedbackAppService) MarkRead(ctx context.Context, adminID string, id uint64) error {
	if err := s.repo.MarkRead(ctx, id); err != nil {
		return err
	}
	if s.audit != nil {
		return s.audit.Audit(ctx, domain.AdminAudit{AdminID: adminID, Action: domain.AdminActionFeedbackRead,
			Target: "feedback:" + strconv.FormatUint(id, 10)})
	}
	return nil
}

// Enrich fills admin_feedback when sending: how many opinions wait (never their text)
func (s *FeedbackAppService) Enrich(ctx context.Context, _ domain.OutboxEmail, data map[string]any) error {
	unread, err := s.repo.CountUnread(ctx)
	if err != nil {
		return err
	}
	if unread == 0 {
		return domain.ErrMailCancelled
	}
	data["count"] = unread
	return nil
}
