package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newFeedbackService(t *testing.T, team string) (*FeedbackAppService, *mock.MockFeedbackRepository, *mock.MockAdminService, *fakeMailService, *recordedEvents) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockFeedbackRepository(ctrl)
	audit := mock.NewMockAdminService(ctrl)
	mail := &fakeMailService{}
	events := &recordedEvents{}
	svc := NewFeedbackService(repo, mail, events, audit, FeedbackSettings{TeamAddress: team})
	// 14-nov-2026 10:20 in Bogotá
	svc.now = func() time.Time { return time.Date(2026, 11, 14, 15, 20, 0, 0, time.UTC) }
	return svc, repo, audit, mail, events
}

func TestFeedback_Submit(t *testing.T) {
	ctx := context.Background()

	t.Run("stores it, emits an event without text and queues one notice per hour with no text", func(t *testing.T) {
		svc, repo, _, mail, events := newFeedbackService(t, "equipo@topi.test")
		startOfDay := time.Date(2026, 11, 14, 5, 0, 0, 0, time.UTC) // 00:00 Bogotá
		repo.EXPECT().CountSince(gomock.Any(), "u1", gomock.Any()).DoAndReturn(func(_ context.Context, _ string, since time.Time) (int, error) {
			assert.True(t, since.Equal(startOfDay), "the daily limit counts the Bogotá day: %s", since)
			return 2, nil
		})
		repo.EXPECT().Create(gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, f *domain.Feedback) error {
			assert.Equal(t, "u1", f.UserID)
			assert.Equal(t, "Que lea Davivienda", f.Text)
			assert.True(t, f.ContactOK)
			return nil
		})

		require.NoError(t, svc.Submit(ctx, "u1", domain.Feedback{Text: "  Que lea Davivienda ", ContactOK: true}))

		require.Len(t, events.events, 1)
		assert.Equal(t, domain.ProductEventFeedbackSent, events.events[0].Name)
		assert.Empty(t, events.events[0].Props)
		require.Len(t, mail.queued, 1)
		notice := mail.queued[0]
		assert.Equal(t, domain.TemplateAdminFeedback, notice.Template)
		assert.Equal(t, "equipo@topi.test", notice.To)
		assert.Nil(t, notice.UserID)
		assert.Equal(t, "admin_feedback:"+itoa(time.Date(2026, 11, 14, 15, 0, 0, 0, time.UTC).Unix()), *notice.DedupeKey)
		assert.True(t, notice.SendAfter.Equal(time.Date(2026, 11, 14, 16, 0, 0, 0, time.UTC)))
		assert.False(t, strings.Contains(string(notice.Payload), "Davivienda"), "the text never goes to the outbox")
	})

	t.Run("fourth of the day: 429 and nothing stored", func(t *testing.T) {
		svc, repo, _, mail, _ := newFeedbackService(t, "equipo@topi.test")
		repo.EXPECT().CountSince(gomock.Any(), "u1", gomock.Any()).Return(domain.FeedbackDailyLimit, nil)
		err := svc.Submit(ctx, "u1", domain.Feedback{Text: "otra"})
		assert.ErrorIs(t, err, domain.ErrLimitExceededException)
		assert.Empty(t, mail.queued)
	})

	t.Run("empty or longer than 500: rejected", func(t *testing.T) {
		svc, _, _, _, _ := newFeedbackService(t, "")
		assert.ErrorIs(t, svc.Submit(ctx, "u1", domain.Feedback{Text: "   "}), domain.ErrInvalidFeedback)
		assert.ErrorIs(t, svc.Submit(ctx, "u1", domain.Feedback{Text: strings.Repeat("á", 501)}), domain.ErrInvalidFeedback)
	})

	t.Run("no team address: stored, no notice", func(t *testing.T) {
		svc, repo, _, mail, _ := newFeedbackService(t, "")
		repo.EXPECT().CountSince(gomock.Any(), "u1", gomock.Any()).Return(0, nil)
		repo.EXPECT().Create(gomock.Any(), gomock.Any()).Return(nil)
		require.NoError(t, svc.Submit(ctx, "u1", domain.Feedback{Text: strings.Repeat("á", 500)}))
		assert.Empty(t, mail.queued)
	})
}

func TestFeedback_MarkReadAuditsAndEnrich(t *testing.T) {
	ctx := context.Background()
	svc, repo, audit, _, _ := newFeedbackService(t, "equipo@topi.test")
	repo.EXPECT().MarkRead(gomock.Any(), uint64(4)).Return(nil)
	audit.EXPECT().Audit(gomock.Any(), domain.AdminAudit{AdminID: "a1", Action: domain.AdminActionFeedbackRead, Target: "feedback:4"}).Return(nil)
	require.NoError(t, svc.MarkRead(ctx, "a1", 4))

	repo.EXPECT().CountUnread(gomock.Any()).Return(int64(3), nil)
	data := map[string]any{}
	require.NoError(t, svc.Enrich(ctx, domain.OutboxEmail{}, data))
	assert.Equal(t, int64(3), data["count"])

	repo.EXPECT().CountUnread(gomock.Any()).Return(int64(0), nil)
	assert.ErrorIs(t, svc.Enrich(ctx, domain.OutboxEmail{}, map[string]any{}), domain.ErrMailCancelled, "all read already")
}

func itoa(v int64) string { return strconv.FormatInt(v, 10) }
