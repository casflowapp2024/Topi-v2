package service

import (
	"cash-flow/internal/adapter/mail/templates"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newReactivationService(t *testing.T, rules domain.ReactivationRules) (*ReactivationAppService, *mock.MockReactivationRepository, *mock.MockAdminService, *fakeMailService) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockReactivationRepository(ctrl)
	audit := mock.NewMockAdminService(ctrl)
	mail := &fakeMailService{}
	renderer, err := templates.New()
	require.NoError(t, err)
	svc := NewReactivationService(repo, mail, renderer, audit, rules, "https://app.topi.test")
	svc.now = func() time.Time { return time.Date(2026, 11, 14, 15, 0, 0, 0, time.UTC) }
	return svc, repo, audit, mail
}

var ana = domain.ReactivationTarget{UserID: "u1", Email: "ana.perez@example.com", Name: "Ana Pérez", PersonalAllowed: true, Founder: true}

func TestReactivation_ViewAndPreview(t *testing.T) {
	ctx := context.Background()
	svc, repo, _, _ := newReactivationService(t, domain.ReactivationRules{DailyLimit: 5})
	repo.EXPECT().Target(gomock.Any(), "u1").Return(&ana, nil).AnyTimes()
	repo.EXPECT().SentSince(gomock.Any(), gomock.Any()).Return(1, nil)

	view, err := svc.View(ctx, "u1")
	require.NoError(t, err)
	assert.True(t, view.Allowed)
	assert.Equal(t, 1, view.SentToday)
	assert.Contains(t, view.Draft.Body, "{nombre}")

	preview, err := svc.Preview(ctx, "u1", view.Draft)
	require.NoError(t, err)
	assert.Equal(t, "ana.perez@example.com", preview.To)
	assert.Equal(t, domain.DefaultReactivationSubject, preview.Subject)
	assert.Contains(t, preview.Text, "Hola Ana,")
	assert.Contains(t, preview.HTML, "fundador de Topi", "founders get the thank-you line")
	assert.NotContains(t, preview.Text, "{nombre}")
}

func TestReactivation_Send(t *testing.T) {
	ctx := context.Background()

	t.Run("queues only the team's text and audits it", func(t *testing.T) {
		svc, repo, audit, mail := newReactivationService(t, domain.ReactivationRules{DailyLimit: 5})
		repo.EXPECT().Target(gomock.Any(), "u1").Return(&ana, nil)
		repo.EXPECT().SentSince(gomock.Any(), gomock.Any()).Return(0, nil)
		audit.EXPECT().Audit(gomock.Any(), domain.AdminAudit{AdminID: "a1", Action: domain.AdminActionReactivationSent, Target: "user:u1"}).Return(nil)

		require.NoError(t, svc.Send(ctx, "a1", "u1", domain.ReactivationDraft{Subject: domain.DefaultReactivationSubject, Body: domain.DefaultReactivationBody}))

		require.Len(t, mail.queued, 1)
		email := mail.queued[0]
		assert.Equal(t, domain.TemplateReactivation, email.Template)
		assert.Equal(t, "reactivation_personal:u1:2026-11-14", *email.DedupeKey)
		assert.False(t, strings.Contains(string(email.Payload), "Ana"), "no name in the outbox")
		assert.Contains(t, string(email.Payload), "{nombre}")
	})

	t.Run("blocked: connection down while the banner is not live", func(t *testing.T) {
		svc, repo, _, mail := newReactivationService(t, domain.ReactivationRules{DailyLimit: 5})
		down := ana
		down.ConnectionDown = true
		repo.EXPECT().Target(gomock.Any(), "u1").Return(&down, nil)
		repo.EXPECT().SentSince(gomock.Any(), gomock.Any()).Return(0, nil)
		err := svc.Send(ctx, "a1", "u1", domain.ReactivationDraft{Subject: "Hola", Body: "Hola {nombre}"})
		assert.ErrorIs(t, err, domain.ErrReactivationNotAllowed)
		assert.Empty(t, mail.queued)
	})

	t.Run("blocked: daily limit", func(t *testing.T) {
		svc, repo, _, mail := newReactivationService(t, domain.ReactivationRules{DailyLimit: 2})
		repo.EXPECT().Target(gomock.Any(), "u1").Return(&ana, nil)
		repo.EXPECT().SentSince(gomock.Any(), gomock.Any()).Return(2, nil)
		assert.ErrorIs(t, svc.Send(ctx, "a1", "u1", domain.ReactivationDraft{Subject: "Hola", Body: "Hola {nombre}"}), domain.ErrReactivationNotAllowed)
		assert.Empty(t, mail.queued)
	})

	t.Run("the name typed in is refused", func(t *testing.T) {
		svc, repo, _, mail := newReactivationService(t, domain.ReactivationRules{DailyLimit: 5})
		repo.EXPECT().Target(gomock.Any(), "u1").Return(&ana, nil)
		repo.EXPECT().SentSince(gomock.Any(), gomock.Any()).Return(0, nil)
		assert.ErrorIs(t, svc.Send(ctx, "a1", "u1", domain.ReactivationDraft{Subject: "Hola", Body: "Hola Ana"}), domain.ErrInvalidReactivation)
		assert.Empty(t, mail.queued)
	})
}

func TestReactivation_Enrich(t *testing.T) {
	ctx := context.Background()
	uid := "u1"
	email := domain.OutboxEmail{UserID: &uid, Template: domain.TemplateReactivation}

	svc, repo, _, _ := newReactivationService(t, domain.ReactivationRules{DailyLimit: 5})
	repo.EXPECT().Target(gomock.Any(), "u1").Return(&ana, nil)
	data := map[string]any{"subject": "Asunto", "body": "Hola {nombre},\n\nGracias"}
	require.NoError(t, svc.Enrich(ctx, email, data))
	assert.Equal(t, []string{"Hola Ana,", "Gracias"}, data["paragraphs"])
	assert.Equal(t, true, data["founder"])

	svc, repo, _, _ = newReactivationService(t, domain.ReactivationRules{DailyLimit: 5})
	gone := ana
	gone.PersonalAllowed = false
	repo.EXPECT().Target(gomock.Any(), "u1").Return(&gone, nil)
	assert.ErrorIs(t, svc.Enrich(ctx, email, map[string]any{"subject": "a", "body": "b"}), domain.ErrMailCancelled,
		"unsubscribed after it was queued")
}
