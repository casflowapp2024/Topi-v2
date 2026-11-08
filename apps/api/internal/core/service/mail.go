package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"
)

// MailSettings contains the sending rules (MAIL_* variables)
type MailSettings struct {
	From    string
	ReplyTo string
	// DailyQuota is the provider's daily limit. Priority 1 can use all of it; the rest, bulkQuotaShare.
	DailyQuota int
	// OnlyTo, when not empty, is the only list of recipients allowed (outside production)
	OnlyTo []string
	// AppBaseURL is the web app (links in the emails), without a trailing slash
	AppBaseURL string
	// APIBaseURL is the public API (unsubscribe links), without a trailing slash
	APIBaseURL string
	BatchSize  int
	// MaxAttempts before marking an email as failed
	MaxAttempts int
}

const (
	// bulkQuotaShare is the share of the daily quota that non transactional emails can use (percent)
	bulkQuotaShare = 80
	// staleLock is how long an email can stay in "sending" before it is retried (or failed if it has a secret)
	staleLock = 10 * time.Minute
	// secretSendTimeout bounds the background send of an email with a secret
	secretSendTimeout = 30 * time.Second
	maxPriority       = int16(32767)
)

// mailBackoff is the wait before each retry (attempt 1 failed -> 1 min, ...)
var mailBackoff = []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour}

// UnsubscribeLinker builds the signed one-click unsubscribe URL of a user (block 5)
type UnsubscribeLinker interface {
	UnsubscribeURL(userID string) string
}

// MailOutboxService implements port.MailService over email_outbox
type MailOutboxService struct {
	repo     port.OutboxRepository
	mailer   port.Mailer
	renderer port.MailRenderer
	settings MailSettings
	linker   UnsubscribeLinker
	now      func() time.Time

	// background sends of emails with a secret (tests wait on it)
	wg sync.WaitGroup
}

// NewMailService creates the mail service
func NewMailService(repo port.OutboxRepository, mailer port.Mailer, renderer port.MailRenderer, settings MailSettings) *MailOutboxService {
	if settings.BatchSize <= 0 {
		settings.BatchSize = 20
	}
	if settings.MaxAttempts <= 0 {
		settings.MaxAttempts = 5
	}
	return &MailOutboxService{
		repo:     repo,
		mailer:   mailer,
		renderer: renderer,
		settings: settings,
		now:      time.Now,
	}
}

// SetUnsubscribeLinker sets the builder of unsubscribe links (List-Unsubscribe)
func (s *MailOutboxService) SetUnsubscribeLinker(linker UnsubscribeLinker) {
	s.linker = linker
}

// Wait blocks until the background sends finish (tests and shutdown)
func (s *MailOutboxService) Wait() {
	s.wg.Wait()
}

// Enqueue stores a pending email. A repeated dedupe key is not an error (returns 0).
func (s *MailOutboxService) Enqueue(ctx context.Context, email domain.OutboxEmail) (int64, error) {
	email.To = domain.NormalizeEmail(email.To)
	if email.Priority == 0 {
		email.Priority = domain.MailPriorityBulk
	}
	if len(email.Payload) == 0 {
		email.Payload = json.RawMessage(`{}`)
	}
	if email.SendAfter.IsZero() {
		email.SendAfter = s.now()
	}
	email.HasSecret = false

	id, _, err := s.repo.Enqueue(ctx, email)
	return id, err
}

// SendSecret records the email (without the secret) and sends it in background, once
func (s *MailOutboxService) SendSecret(ctx context.Context, email domain.OutboxEmail, secret map[string]any) error {
	email.To = domain.NormalizeEmail(email.To)
	email.Priority = domain.MailPriorityTransactional
	email.HasSecret = true
	if len(email.Payload) == 0 {
		email.Payload = json.RawMessage(`{}`)
	}

	bg := context.WithoutCancel(ctx)
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ctx, cancel := context.WithTimeout(bg, secretSendTimeout)
		defer cancel()
		s.sendSecretNow(ctx, email, secret)
	}()

	return nil
}

func (s *MailOutboxService) sendSecretNow(ctx context.Context, email domain.OutboxEmail, secret map[string]any) {
	id, err := s.repo.InsertSending(ctx, email)
	if err != nil {
		slog.Error("mail: could not record email", "template", email.Template, "error", err)
		return
	}
	email.ID = id
	email.Attempts = 1

	sent, err := s.repo.CountSentSince(ctx, s.dayStart())
	if err != nil {
		slog.Error("mail: could not count the quota", "error", err)
	} else if sent > s.settings.DailyQuota {
		// sent already includes this email (it is in sending)
		s.markFailed(ctx, email, "daily quota reached")
		return
	}

	if email.UserID != nil {
		status, err := s.repo.RecipientStatus(ctx, *email.UserID)
		if err != nil {
			slog.Error("mail: could not read recipient status", "outbox_id", id, "error", err)
		}
		email.RecipientStatus = status
	}

	s.deliver(ctx, email, secret, false)
}

// ProcessOnce sends a batch of due emails respecting the daily quota and the priorities
func (s *MailOutboxService) ProcessOnce(ctx context.Context) (int, error) {
	if failed, err := s.repo.FailStaleSecrets(ctx, staleLock); err != nil {
		return 0, err
	} else if failed > 0 {
		slog.Warn("mail: emails with a secret stuck in sending were failed", "count", failed)
	}

	sent, err := s.repo.CountSentSince(ctx, s.dayStart())
	if err != nil {
		return 0, err
	}

	remainingAll := s.settings.DailyQuota - sent
	remainingBulk := s.settings.DailyQuota*bulkQuotaShare/100 - sent
	limit := s.settings.BatchSize

	var batch []domain.OutboxEmail
	if n := min(limit, remainingAll); n > 0 {
		claimed, err := s.repo.Claim(ctx, domain.MailPriorityTransactional, domain.MailPriorityTransactional, n, staleLock)
		if err != nil {
			return 0, err
		}
		batch = append(batch, claimed...)
	}

	if n := min(limit-len(batch), remainingBulk, remainingAll-len(batch)); n > 0 {
		claimed, err := s.repo.Claim(ctx, domain.MailPriorityTransactional+1, maxPriority, n, staleLock)
		if err != nil {
			return len(batch), err
		}
		batch = append(batch, claimed...)
	}

	for _, email := range batch {
		s.deliver(ctx, email, nil, true)
	}

	return len(batch), nil
}

// Run processes the outbox every interval until ctx ends
func (s *MailOutboxService) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		if n, err := s.ProcessOnce(ctx); err != nil {
			slog.Error("mail: outbox processing failed", "error", err)
		} else if n > 0 {
			slog.Info("mail: outbox batch processed", "count", n)
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// deliver applies suppression and the allow list, renders and sends one claimed email
func (s *MailOutboxService) deliver(ctx context.Context, email domain.OutboxEmail, secret map[string]any, retryable bool) {
	if email.RecipientStatus != "" && email.RecipientStatus != domain.EmailStatusOK && !domain.IgnoresSuppression(email.Template) {
		s.markSuppressed(ctx, email, "recipient "+email.RecipientStatus)
		return
	}

	if !s.allowed(email.To) {
		s.markSuppressed(ctx, email, domain.ErrMailNotAllowed.Error())
		return
	}

	msg, err := s.build(email, secret)
	if err != nil {
		s.markFailed(ctx, email, "render: "+err.Error())
		return
	}

	providerID, err := s.mailer.Send(ctx, *msg)
	if err != nil {
		if !retryable || errors.Is(err, domain.ErrMailRejected) || email.Attempts >= s.settings.MaxAttempts {
			s.markFailed(ctx, email, err.Error())
			return
		}
		wait := mailBackoff[min(max(email.Attempts-1, 0), len(mailBackoff)-1)]
		if err := s.repo.MarkRetry(ctx, email.ID, err.Error(), s.now().Add(wait)); err != nil {
			slog.Error("mail: could not schedule retry", "outbox_id", email.ID, "error", err)
		}
		slog.Warn("mail: send failed, will retry", "outbox_id", email.ID, "template", email.Template,
			"attempts", email.Attempts, "error", err)
		return
	}

	if err := s.repo.MarkSent(ctx, email.ID, providerID); err != nil {
		slog.Error("mail: sent but could not mark it", "outbox_id", email.ID, "error", err)
		return
	}
	slog.Info("mail: sent", "outbox_id", email.ID, "template", email.Template)
}

// build renders the template with the payload, the secret and the common links
func (s *MailOutboxService) build(email domain.OutboxEmail, secret map[string]any) (*domain.EmailMessage, error) {
	data := map[string]any{}
	if len(email.Payload) > 0 {
		if err := json.Unmarshal(email.Payload, &data); err != nil {
			return nil, err
		}
	}
	for key, value := range secret {
		data[key] = value
	}
	data["app_url"] = s.settings.AppBaseURL

	headers := map[string]string{}
	if !domain.IsTransactionalTemplate(email.Template) && s.linker != nil && email.UserID != nil {
		link := s.linker.UnsubscribeURL(*email.UserID)
		data["unsubscribe_url"] = link
		headers["List-Unsubscribe"] = "<" + link + ">"
		headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
	}

	rendered, err := s.renderer.Render(email.Template, data)
	if err != nil {
		return nil, err
	}

	return &domain.EmailMessage{
		To:      email.To,
		From:    s.settings.From,
		ReplyTo: s.settings.ReplyTo,
		Subject: rendered.Subject,
		HTML:    rendered.HTML,
		Text:    rendered.Text,
		Headers: headers,
		Tags: map[string]string{
			"template":  email.Template,
			"outbox_id": strconv.FormatInt(email.ID, 10),
		},
	}, nil
}

func (s *MailOutboxService) allowed(to string) bool {
	if len(s.settings.OnlyTo) == 0 {
		return true
	}
	to = domain.NormalizeEmail(to)
	for _, allowed := range s.settings.OnlyTo {
		if domain.NormalizeEmail(allowed) == to {
			return true
		}
	}
	return false
}

// dayStart is the start of the current day in Bogotá (the quota counts per local day)
func (s *MailOutboxService) dayStart() time.Time {
	now := s.now().In(enums.BogotaLocation)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, enums.BogotaLocation)
}

func (s *MailOutboxService) markFailed(ctx context.Context, email domain.OutboxEmail, reason string) {
	if err := s.repo.MarkFailed(ctx, email.ID, truncate(reason, 500)); err != nil {
		slog.Error("mail: could not mark failed", "outbox_id", email.ID, "error", err)
	}
	slog.Warn("mail: failed", "outbox_id", email.ID, "template", email.Template, "reason", reason)
}

func (s *MailOutboxService) markSuppressed(ctx context.Context, email domain.OutboxEmail, reason string) {
	if err := s.repo.MarkSuppressed(ctx, email.ID, reason); err != nil {
		slog.Error("mail: could not mark suppressed", "outbox_id", email.ID, "error", err)
	}
	slog.Info("mail: suppressed", "outbox_id", email.ID, "template", email.Template, "reason", reason)
}

func truncate(value string, size int) string {
	value = strings.TrimSpace(value)
	if len(value) <= size {
		return value
	}
	return value[:size]
}
