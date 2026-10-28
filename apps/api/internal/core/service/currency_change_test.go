package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCurrencyChangeService(t *testing.T) {
	ctx := context.Background()

	t.Run("normaliza la moneda y llega al repositorio", func(t *testing.T) {
		repo := mock.NewMockCurrencyChangeRepository(gomock.NewController(t))
		svc := NewCurrencyChangeService(repo)
		change := &domain.AccountCurrencyChange{UserID: "u1", AccountID: 3, NewCurrency: " usd ", Mode: domain.CurrencyChangeConvert}
		repo.EXPECT().ChangeAccountCurrency(ctx, change).Return(nil)
		require.NoError(t, svc.ChangeAccountCurrency(ctx, change))
		assert.Equal(t, "USD", change.NewCurrency)
	})

	t.Run("inválidos no llegan al repositorio", func(t *testing.T) {
		svc := NewCurrencyChangeService(mock.NewMockCurrencyChangeRepository(gomock.NewController(t)))
		assert.ErrorIs(t, svc.ChangeAccountCurrency(ctx, &domain.AccountCurrencyChange{AccountID: 3, NewCurrency: "dolar", Mode: "convert"}),
			domain.ErrInvalidCurrency)
		assert.ErrorIs(t, svc.ChangeAccountCurrency(ctx, &domain.AccountCurrencyChange{AccountID: 3, NewCurrency: "USD", Mode: "swap"}),
			domain.ErrInvalidCurrencyChangeMode)
		assert.ErrorIs(t, svc.ChangeBaseCurrency(ctx, &domain.BaseCurrencyChange{UserID: "u1", NewCurrency: "x"}),
			domain.ErrInvalidCurrency)
	})

	t.Run("moneda base en mayúsculas", func(t *testing.T) {
		repo := mock.NewMockCurrencyChangeRepository(gomock.NewController(t))
		svc := NewCurrencyChangeService(repo)
		change := &domain.BaseCurrencyChange{UserID: "u1", NewCurrency: "eur"}
		repo.EXPECT().ChangeBaseCurrency(ctx, change).Return(nil)
		require.NoError(t, svc.ChangeBaseCurrency(ctx, change))
		assert.Equal(t, "EUR", change.NewCurrency)
	})
}
