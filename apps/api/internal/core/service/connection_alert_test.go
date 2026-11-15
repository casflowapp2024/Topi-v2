package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAlertService(t *testing.T) (*EmailService, *mock.MockEmailRepository, *fakeMailService) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockEmailRepository(ctrl)
	mail := &fakeMailService{}
	svc := NewEmailService(repo, nil, nil, nil, nil)
	svc.SetMail(mail)
	return svc, repo, mail
}

func TestEmailService_ConnectionAlert(t *testing.T) {
	ctx := context.Background()

	t.Run("credential error emails the user once", func(t *testing.T) {
		svc, repo, mail := newAlertService(t)
		repo.EXPECT().SaveEmailError(gomock.Any(), uint64(7), "token_expired_or_revoked").Return(nil)
		repo.EXPECT().ClaimConnectionAlert(gomock.Any(), uint64(7), domain.ConnectionAlertCooldown).Return(&domain.ConnectionAlert{
			UserID: "u1", UserEmail: "ana@example.com", ConnectionEmail: "ana.banco@gmail.com", Provider: "gmail",
		}, true, nil)

		require.NoError(t, svc.SaveEmailError(ctx, 7, "token_expired_or_revoked"))

		require.Len(t, mail.queued, 1)
		email := mail.queued[0]
		assert.Equal(t, domain.TemplateConnectionDown, email.Template)
		assert.Equal(t, "ana@example.com", email.To, "to the account email, not to the connection")
		assert.Equal(t, domain.MailPriorityNotification, email.Priority)
		assert.Equal(t, "u1", *email.UserID)
		// no address in the outbox: only the connection id (the enricher fills it in)
		assert.JSONEq(t, `{"email_id":7,"provider":"Gmail"}`, string(email.Payload))
	})

	t.Run("within 7 days (or alerts off) nothing is sent", func(t *testing.T) {
		svc, repo, mail := newAlertService(t)
		repo.EXPECT().SaveEmailError(gomock.Any(), uint64(7), "authorization_error").Return(nil)
		repo.EXPECT().ClaimConnectionAlert(gomock.Any(), uint64(7), gomock.Any()).Return(nil, false, nil)

		require.NoError(t, svc.SaveEmailError(ctx, 7, "authorization_error"))
		assert.Empty(t, mail.queued)
	})

	t.Run("clearing the error does not alert", func(t *testing.T) {
		svc, repo, mail := newAlertService(t)
		repo.EXPECT().SaveEmailError(gomock.Any(), uint64(7), "").Return(nil)

		require.NoError(t, svc.SaveEmailError(ctx, 7, ""))
		assert.Empty(t, mail.queued)
	})

	t.Run("the alert never fails the worker request", func(t *testing.T) {
		svc, repo, _ := newAlertService(t)
		repo.EXPECT().SaveEmailError(gomock.Any(), uint64(7), "x").Return(nil)
		repo.EXPECT().ClaimConnectionAlert(gomock.Any(), uint64(7), gomock.Any()).Return(nil, false, errors.New("db down"))

		assert.NoError(t, svc.SaveEmailError(ctx, 7, "x"))
	})

	t.Run("unknown connection is still an error", func(t *testing.T) {
		svc, repo, _ := newAlertService(t)
		repo.EXPECT().SaveEmailError(gomock.Any(), uint64(9), "x").Return(domain.ErrDataNotFound)

		assert.ErrorIs(t, svc.SaveEmailError(ctx, 9, "x"), domain.ErrDataNotFound)
	})
}

func TestEmailService_ConnectionAlertEnrich(t *testing.T) {
	ctx := context.Background()
	userID := "u1"
	outbox := domain.OutboxEmail{UserID: &userID, Template: domain.TemplateConnectionDown}
	broken := "token_expired_or_revoked"

	t.Run("fills the address of a connection still down", func(t *testing.T) {
		svc, repo, _ := newAlertService(t)
		repo.EXPECT().GetEmail(gomock.Any(), "u1", uint64(7), nil).
			Return(&domain.Email{Email: "ana.banco@gmail.com", Error: &broken}, nil)
		data := map[string]any{"email_id": float64(7), "provider": "Gmail"}
		require.NoError(t, svc.Enrich(ctx, outbox, data))
		assert.Equal(t, "ana.banco@gmail.com", data["connection_email"])
	})

	t.Run("reconnected before sending: cancelled", func(t *testing.T) {
		svc, repo, _ := newAlertService(t)
		repo.EXPECT().GetEmail(gomock.Any(), "u1", uint64(7), nil).Return(&domain.Email{Email: "x@gmail.com"}, nil)
		err := svc.Enrich(ctx, outbox, map[string]any{"email_id": float64(7)})
		assert.ErrorIs(t, err, domain.ErrMailCancelled)
	})

	t.Run("connection deleted: cancelled", func(t *testing.T) {
		svc, repo, _ := newAlertService(t)
		repo.EXPECT().GetEmail(gomock.Any(), "u1", uint64(7), nil).Return(nil, domain.ErrDataNotFound)
		err := svc.Enrich(ctx, outbox, map[string]any{"email_id": float64(7)})
		assert.ErrorIs(t, err, domain.ErrMailCancelled)
	})

	t.Run("transient error: retried", func(t *testing.T) {
		svc, repo, _ := newAlertService(t)
		repo.EXPECT().GetEmail(gomock.Any(), "u1", uint64(7), nil).Return(nil, errors.New("db down"))
		err := svc.Enrich(ctx, outbox, map[string]any{"email_id": float64(7)})
		assert.Error(t, err)
		assert.NotErrorIs(t, err, domain.ErrMailCancelled)
	})
}
