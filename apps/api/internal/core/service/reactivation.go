package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"time"
)

// ReactivationAppService implements port.ReactivationService and the MailEnricher of reactivation_personal
// (plan/27 §G): never bulk, one person at a time, previewed, audited, 90-day dedupe, daily limit, and blocked
// for people whose connection is down until the banner of §D is in production (REACTIVATION_ALLOW_BROKEN).
type ReactivationAppService struct {
	repo     port.ReactivationRepository
	mail     port.MailService
	renderer port.MailRenderer
	audit    port.AdminService
	rules    domain.ReactivationRules
	appURL   string
	now      func() time.Time
}

// NewReactivationService creates the reactivation service
func NewReactivationService(repo port.ReactivationRepository, mail port.MailService, renderer port.MailRenderer,
	audit port.AdminService, rules domain.ReactivationRules, appURL string) *ReactivationAppService {
	return &ReactivationAppService{repo: repo, mail: mail, renderer: renderer, audit: audit, rules: rules, appURL: appURL, now: time.Now}
}

func (s *ReactivationAppService) startOfDay() time.Time {
	local := s.now().In(enums.BogotaLocation)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, enums.BogotaLocation)
}

// state loads the person and the reason why it cannot be written to now ("" = allowed)
func (s *ReactivationAppService) state(ctx context.Context, userID string) (*domain.ReactivationTarget, string, int, error) {
	target, err := s.repo.Target(ctx, userID)
	if err != nil {
		return nil, "", 0, err
	}
	sentToday, err := s.repo.SentSince(ctx, s.startOfDay())
	if err != nil {
		return nil, "", 0, err
	}
	return target, target.Reason(s.now(), sentToday, s.rules), sentToday, nil
}

// View: whether the button is enabled (and why not) and the starting text
func (s *ReactivationAppService) View(ctx context.Context, userID string) (*domain.ReactivationView, error) {
	target, reason, sentToday, err := s.state(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &domain.ReactivationView{
		Allowed:    reason == domain.ReactivationOK,
		Reason:     reason,
		Draft:      domain.ReactivationDraft{Subject: domain.DefaultReactivationSubject, Body: domain.DefaultReactivationBody},
		Founder:    target.Founder,
		LastSentAt: target.LastSentAt,
		SentToday:  sentToday,
		DailyLimit: s.rules.DailyLimit,
	}, nil
}

// templateData is what reactivation_personal renders (the same at preview and at send time)
func (s *ReactivationAppService) templateData(target domain.ReactivationTarget, draft domain.ReactivationDraft, data map[string]any) {
	data["subject"] = draft.Subject
	data["paragraphs"] = draft.Paragraphs(target.FirstName())
	data["founder"] = target.Founder
}

// Preview renders the final email with the person's name, only for the admin (nothing is stored)
func (s *ReactivationAppService) Preview(ctx context.Context, userID string, draft domain.ReactivationDraft) (*domain.ReactivationPreview, error) {
	target, err := s.repo.Target(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err = draft.Validate(*target); err != nil {
		return nil, err
	}
	data := map[string]any{"app_url": s.appURL, "unsubscribe_url": s.appURL + "/#vista-previa"}
	s.templateData(*target, draft, data)
	rendered, err := s.renderer.Render(domain.TemplateReactivation, data)
	if err != nil {
		return nil, err
	}
	return &domain.ReactivationPreview{To: target.Email, Subject: rendered.Subject, HTML: rendered.HTML, Text: rendered.Text}, nil
}

// Send queues the email for one person, after checking every rule again, and audits it
func (s *ReactivationAppService) Send(ctx context.Context, adminID, userID string, draft domain.ReactivationDraft) error {
	target, reason, _, err := s.state(ctx, userID)
	if err != nil {
		return err
	}
	if reason != domain.ReactivationOK {
		return domain.ErrReactivationNotAllowed
	}
	if err = draft.Validate(*target); err != nil {
		return err
	}

	// only the team's text (with {nombre}): the name is filled in when sending
	payload, _ := json.Marshal(map[string]string{"subject": draft.Subject, "body": draft.Body})
	key := domain.TemplateReactivation + ":" + target.UserID + ":" + s.now().In(enums.BogotaLocation).Format(time.DateOnly)
	uid := target.UserID
	id, err := s.mail.Enqueue(ctx, domain.OutboxEmail{
		UserID:    &uid,
		To:        target.Email,
		Template:  domain.TemplateReactivation,
		Payload:   payload,
		Priority:  domain.MailPriorityNotification,
		DedupeKey: &key,
	})
	if err != nil {
		return err
	}
	if id == 0 {
		return domain.ErrReactivationNotAllowed // already queued today
	}
	if s.audit != nil {
		return s.audit.Audit(ctx, domain.AdminAudit{AdminID: adminID, Action: domain.AdminActionReactivationSent,
			Target: "user:" + target.UserID})
	}
	return nil
}

// Enrich fills the name and founder line when sending; cancelled if the person unsubscribed or bounced meanwhile
func (s *ReactivationAppService) Enrich(ctx context.Context, email domain.OutboxEmail, data map[string]any) error {
	if email.UserID == nil {
		return domain.ErrMailCancelled
	}
	target, err := s.repo.Target(ctx, *email.UserID)
	if err != nil {
		if err == domain.ErrDataNotFound {
			return domain.ErrMailCancelled
		}
		return err
	}
	if !target.PersonalAllowed || target.EmailStatus == domain.EmailStatusBounced || target.EmailStatus == domain.EmailStatusComplained {
		return domain.ErrMailCancelled
	}
	subject, _ := data["subject"].(string)
	body, _ := data["body"].(string)
	if subject == "" || body == "" {
		return domain.ErrMailCancelled
	}
	s.templateData(*target, domain.ReactivationDraft{Subject: subject, Body: body}, data)
	return nil
}
