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

type fakeGmailQuota struct {
	ok  bool
	err error
}

func (f fakeGmailQuota) Quota(context.Context) (*domain.GmailQuota, error) {
	return &domain.GmailQuota{}, nil
}
func (f fakeGmailQuota) CanConnectNew(context.Context) (bool, error) { return f.ok, f.err }

// plan/28 §7: once the Google cupos run out only reconnecting one of the user's own Gmail connections gets a URL
func TestEmailService_GetUserAuthURL_GmailCap(t *testing.T) {
	id := uint64(5)
	setup := func(t *testing.T, quota fakeGmailQuota) (*EmailService, *mock.MockEmailAPI, *mock.MockEmailRepository) {
		ctrl := gomock.NewController(t)
		api := mock.NewMockEmailAPI(ctrl)
		repo := mock.NewMockEmailRepository(ctrl)
		svc := NewEmailService(repo, api, mock.NewMockAccountRepository(ctrl), mock.NewMockAccountService(ctrl), mock.NewMockTransactionManager(ctrl))
		svc.SetGmailQuota(quota)
		return svc, api, repo
	}
	ctx := context.Background()

	t.Run("full: no URL for a new Gmail account", func(t *testing.T) {
		svc, _, _ := setup(t, fakeGmailQuota{ok: false})
		url, err := svc.GetUserAuthURL(ctx, "u1", "gmail", nil)
		assert.ErrorIs(t, err, domain.ErrGmailFull)
		assert.Nil(t, url)
	})
	t.Run("full: reconnecting an own Gmail connection still works", func(t *testing.T) {
		svc, api, repo := setup(t, fakeGmailQuota{ok: false})
		repo.EXPECT().GetEmail(gomock.Any(), "u1", id, nil).Return(&domain.Email{Provider: "gmail"}, nil)
		api.EXPECT().GetAuthURL("gmail").Return(stringPtr(gmailAuthURL), nil)
		url, err := svc.GetUserAuthURL(ctx, "u1", "gmail", &id)
		require.NoError(t, err)
		assert.Equal(t, gmailAuthURL, *url)
	})
	t.Run("full: a connection that is not the user's is not a reconnection", func(t *testing.T) {
		svc, _, repo := setup(t, fakeGmailQuota{ok: false})
		repo.EXPECT().GetEmail(gomock.Any(), "u1", id, nil).Return(nil, domain.ErrDataNotFound)
		_, err := svc.GetUserAuthURL(ctx, "u1", "gmail", &id)
		assert.ErrorIs(t, err, domain.ErrGmailFull)
	})
	t.Run("full: Outlook does not spend Google cupos", func(t *testing.T) {
		svc, api, _ := setup(t, fakeGmailQuota{ok: false})
		api.EXPECT().GetAuthURL("outlook").Return(stringPtr(outlookAuthURL), nil)
		_, err := svc.GetUserAuthURL(ctx, "u1", "outlook", nil)
		assert.NoError(t, err)
	})
	t.Run("quota unreadable: the URL is given", func(t *testing.T) {
		svc, api, _ := setup(t, fakeGmailQuota{err: errors.New("db down")})
		api.EXPECT().GetAuthURL("gmail").Return(stringPtr(gmailAuthURL), nil)
		_, err := svc.GetUserAuthURL(ctx, "u1", "gmail", nil)
		assert.NoError(t, err)
	})
}
