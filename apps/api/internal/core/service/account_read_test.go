package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

// fakeReader records the priority reads the account service asks for (plan/30 bloque 1)
type fakeReader struct {
	calls [][]uint64
	users []string
	err   error
}

func (f *fakeReader) ReadEmail(_ context.Context, userID string, ids []uint64) (*domain.ReadEmailResponse, error) {
	f.calls = append(f.calls, ids)
	f.users = append(f.users, userID)
	return nil, f.err
}

func ptrID(id uint64) *uint64 { return &id }

func TestAccountService_CreateAccount_RequestsRead(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAccountRepository(ctrl)
	svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
	reader := &fakeReader{}
	svc.SetReadRequester(reader)
	ctx := context.Background()

	repo.EXPECT().CreateAccount(ctx, gomock.Any()).DoAndReturn(func(_ context.Context, a *domain.Account) error {
		a.ID = 7
		return nil
	})
	err := svc.CreateAccount(ctx, &domain.Account{UserID: "u1", Name: "TC", Type: domain.AccountType{ID: 4},
		Email: domain.Email{ID: ptrID(1)}})

	assert.NoError(t, err)
	assert.Equal(t, [][]uint64{{7}}, reader.calls)
	assert.Equal(t, []string{"u1"}, reader.users)
}

func TestAccountService_CreateAccount_NoConnectionNoRead(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAccountRepository(ctrl)
	svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
	reader := &fakeReader{}
	svc.SetReadRequester(reader)
	ctx := context.Background()

	repo.EXPECT().CreateAccount(ctx, gomock.Any()).DoAndReturn(func(_ context.Context, a *domain.Account) error {
		a.ID = 8
		return nil
	})
	assert.NoError(t, svc.CreateAccount(ctx, &domain.Account{UserID: "u1", Name: "Efectivo", Type: domain.AccountType{ID: 1}}))
	assert.Empty(t, reader.calls)
}

func TestAccountService_CreateAccount_ReadErrorDoesNotFail(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockAccountRepository(ctrl)
	svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
	reader := &fakeReader{err: errors.New("cola caída")}
	svc.SetReadRequester(reader)
	ctx := context.Background()

	repo.EXPECT().CreateAccount(ctx, gomock.Any()).DoAndReturn(func(_ context.Context, a *domain.Account) error {
		a.ID = 9
		return nil
	})
	assert.NoError(t, svc.CreateAccount(ctx, &domain.Account{UserID: "u1", Name: "TC", Type: domain.AccountType{ID: 4},
		Email: domain.Email{ID: ptrID(1)}}))
	assert.Len(t, reader.calls, 1)
}

func TestAccountService_UpdateAccount_RequestsReadOnlyWhenReadingChanges(t *testing.T) {
	ctx := context.Background()
	before := &domain.Account{ID: 3, UserID: "u1", Name: "TC", LastFourDigits: "1558", Bank: domain.Bank{ID: 1},
		Type: domain.AccountType{ID: 4}}

	tests := []struct {
		name   string
		update domain.Account
		reads  int
	}{
		{"liga la cuenta a un correo", domain.Account{Name: "TC", LastFourDigits: "1558", Bank: domain.Bank{ID: 1},
			Type: domain.AccountType{ID: 4}, Email: domain.Email{ID: ptrID(1)}}, 1},
		{"solo cambia el nombre, sin correo", domain.Account{Name: "Tarjeta", LastFourDigits: "1558", Bank: domain.Bank{ID: 1},
			Type: domain.AccountType{ID: 4}}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockAccountRepository(ctrl)
			svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
			reader := &fakeReader{}
			svc.SetReadRequester(reader)

			update := tt.update
			update.ID, update.UserID = 3, "u1"
			repo.EXPECT().GetAccount(ctx, "u1", uint64(3)).Return(before, nil)
			repo.EXPECT().UpdateAccount(ctx, gomock.Any()).Return(nil)

			assert.NoError(t, svc.UpdateAccount(ctx, &update))
			assert.Len(t, reader.calls, tt.reads)
		})
	}
}
