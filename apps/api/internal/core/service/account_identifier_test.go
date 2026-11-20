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

func TestAccountService_AddIdentifier(t *testing.T) {
	ctx := context.Background()
	deposit := &domain.Account{ID: 5, UserID: "u1", Type: domain.AccountType{Class: domain.AccountClassCredit}}
	investment := &domain.Account{ID: 6, UserID: "u1", Type: domain.AccountType{Class: domain.AccountClassInvestment}}

	t.Run("adds the typed digits", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockAccountRepository(ctrl)
		svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
		repo.EXPECT().GetAccount(ctx, "u1", uint64(5)).Return(deposit, nil)
		repo.EXPECT().CreateIdentifier(ctx, gomock.Any()).DoAndReturn(func(_ context.Context, i *domain.AccountIdentifier) error {
			assert.Equal(t, domain.AccountIdentifier{UserID: "u1", AccountID: 5, Digits: "2222", Source: domain.IdentifierSourceUser}, *i)
			i.ID = 9
			return nil
		})
		identifier, err := svc.AddIdentifier(ctx, "u1", 5, "2222")
		require.NoError(t, err)
		assert.Equal(t, uint64(9), identifier.ID)
	})

	t.Run("rejects what is not four numbers", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		svc := NewAccountService(mock.NewMockAccountRepository(ctrl), mock.NewMockTransactionRepository(ctrl))
		for _, digits := range []string{"", "123", "12a4", "12345"} {
			_, err := svc.AddIdentifier(ctx, "u1", 5, digits)
			assert.ErrorIs(t, err, domain.ErrInvalidAccountDigits, digits)
		}
	})

	t.Run("investments are not recognised by digits", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockAccountRepository(ctrl)
		svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
		repo.EXPECT().GetAccount(ctx, "u1", uint64(6)).Return(investment, nil)
		_, err := svc.AddIdentifier(ctx, "u1", 6, "1234")
		assert.ErrorIs(t, err, domain.ErrInvestmentIdentifier)
	})

	t.Run("digits of another account", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockAccountRepository(ctrl)
		svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
		repo.EXPECT().GetAccount(ctx, "u1", uint64(5)).Return(deposit, nil)
		repo.EXPECT().CreateIdentifier(ctx, gomock.Any()).Return(domain.ErrIdentifierTaken)
		_, err := svc.AddIdentifier(ctx, "u1", 5, "1234")
		assert.ErrorIs(t, err, domain.ErrIdentifierTaken)
	})
}

func TestTransactionService_UpdateTransaction_LearnsIdentifier(t *testing.T) {
	ctx := context.Background()
	hint := "4321"
	read := func() *domain.Transaction {
		return &domain.Transaction{
			ID: 1, UserID: "u1", Description: "Compra", Amount: 10, Automated: true, ShouldVerify: true,
			SourceAccountHint: &hint, Account: domain.Account{ID: 2, Bank: domain.Bank{ID: 7}},
		}
	}

	t.Run("moving to another account learns the digits", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockTransactionRepository(ctrl)
		svc := NewTransactionService(repo, nil, nil)
		update := &domain.Transaction{ID: 1, UserID: "u1", Account: domain.Account{ID: 3}}
		repo.EXPECT().GetTransactionByID(ctx, "u1", uint64(1)).Return(read(), nil)
		repo.EXPECT().UpdateTransaction(ctx, update).Return(nil)
		repo.EXPECT().LearnAccountIdentifier(ctx, "u1", "4321", uint64(7), uint64(3)).
			Return(&domain.LearnedIdentifiers{Learned: true, Digits: "4321", Moved: 2}, nil)

		require.NoError(t, svc.UpdateTransaction(ctx, update))
		assert.Equal(t, &domain.LearnedIdentifiers{Learned: true, Digits: "4321", Moved: 2}, update.Learned)
	})

	t.Run("same account, manual transaction or no digits: nothing to learn", func(t *testing.T) {
		cases := map[string]func(*domain.Transaction){
			"same account": func(tx *domain.Transaction) {},
			"manual":       func(tx *domain.Transaction) { tx.Automated = false },
			"no digits":    func(tx *domain.Transaction) { tx.SourceAccountHint = nil },
		}
		for name, change := range cases {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockTransactionRepository(ctrl)
			svc := NewTransactionService(repo, nil, nil)
			actual := read()
			change(actual)
			accountID := uint64(3)
			if name == "same account" {
				accountID = 2
			}
			update := &domain.Transaction{ID: 1, UserID: "u1", Description: "Otra", Account: domain.Account{ID: accountID}}
			repo.EXPECT().GetTransactionByID(ctx, "u1", uint64(1)).Return(actual, nil)
			repo.EXPECT().UpdateTransaction(ctx, update).Return(nil)

			require.NoError(t, svc.UpdateTransaction(ctx, update), name)
			assert.Nil(t, update.Learned, name)
		}
	})

	t.Run("a failed learning keeps the update", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockTransactionRepository(ctrl)
		svc := NewTransactionService(repo, nil, nil)
		update := &domain.Transaction{ID: 1, UserID: "u1", Account: domain.Account{ID: 3}}
		repo.EXPECT().GetTransactionByID(ctx, "u1", uint64(1)).Return(read(), nil)
		repo.EXPECT().UpdateTransaction(ctx, update).Return(nil)
		repo.EXPECT().LearnAccountIdentifier(ctx, "u1", "4321", uint64(7), uint64(3)).Return(nil, errors.New("db down"))

		require.NoError(t, svc.UpdateTransaction(ctx, update))
		assert.Nil(t, update.Learned)
	})
}
