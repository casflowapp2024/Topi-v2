package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"context"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// plan/27 §D: reconnecting a connection that was down emits connection_reconnected and reads its accounts now
func TestEmailService_Reconnect(t *testing.T) {
	ctx := context.Background()
	emailID := uint64(9)

	setup := func(t *testing.T, reconnected bool) (*EmailService, *mock.MockEmailAPI, *mock.MockAccountService, *mock.MockAccountRepository, *recordedEvents) {
		ctrl := gomock.NewController(t)
		api := mock.NewMockEmailAPI(ctrl)
		repo := mock.NewMockEmailRepository(ctrl)
		accountRepo := mock.NewMockAccountRepository(ctrl)
		accounts := mock.NewMockAccountService(ctrl)
		events := &recordedEvents{}

		api.EXPECT().GetToken(gomock.Any(), "gmail", "code").
			Return(&domain.EmailToken{Access: "a", Refresh: "r", Type: "Bearer"}, nil)
		repo.EXPECT().RegisterEmail(gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, email *domain.Email) error {
			email.ID = &emailID
			email.Reconnected = reconnected
			return nil
		})

		svc := NewEmailService(repo, api, accountRepo, accounts, nil)
		svc.SetEvents(events)
		return svc, api, accounts, accountRepo, events
	}

	t.Run("down connection: event and priority read of its accounts", func(t *testing.T) {
		svc, api, accounts, accountRepo, events := setup(t, true)
		other := uint64(3)
		linked := []domain.Account{
			{ID: 1, Email: domain.Email{ID: &emailID}},
			{ID: 2, Email: domain.Email{ID: &other}},
			{ID: 4},
		}
		accounts.EXPECT().GetAccounts(gomock.Any(), "u1", uint64(0), uint64(100), enums.All).Return(linked, nil).Times(2)
		accountRepo.EXPECT().AdminGetAccountsList(gomock.Any(), domain.AccountFilters{IDs: []uint64{1}, Limit: 100}).
			Return([]domain.Account{linked[0]}, nil)
		api.EXPECT().ReadEmail([]domain.Account{linked[0]}).Return(&domain.ReadEmailResponse{})

		require.NoError(t, svc.RegisterUserEmail(ctx, &domain.Email{UserID: "u1", Code: "code", Provider: "gmail", Email: "x@gmail.com", Active: true}))

		require.Len(t, events.events, 1)
		assert.Equal(t, domain.ProductEventConnectionReconnected, events.events[0].Name)
		assert.Equal(t, map[string]any{"email_id": emailID, "provider": "gmail"}, events.events[0].Props)
		assert.NoError(t, events.events[0].Validate())
	})

	t.Run("new or healthy connection: nothing extra", func(t *testing.T) {
		svc, _, _, _, events := setup(t, false)
		require.NoError(t, svc.RegisterUserEmail(ctx, &domain.Email{UserID: "u1", Code: "code", Provider: "gmail", Email: "x@gmail.com", Active: true}))
		assert.Empty(t, events.events)
	})
}
