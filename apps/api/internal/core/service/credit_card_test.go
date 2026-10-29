package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreditCardService(t *testing.T) {
	ctx := context.Background()
	day := func(n int16) *int16 { return &n }
	negative := decimal.NewFromInt(-1)

	t.Run("válidos llegan al repositorio", func(t *testing.T) {
		repo := mock.NewMockCreditCardRepository(gomock.NewController(t))
		d := &domain.CreditCardDetails{AccountID: 4, UserID: "u1", StatementDay: day(31), DueDay: day(1)}
		repo.EXPECT().SaveCreditCard(ctx, d).Return(nil)
		require.NoError(t, NewCreditCardService(repo).SaveCreditCard(ctx, d))
	})

	invalid := map[string]*domain.CreditCardDetails{
		"sin cuenta":    {UserID: "u1"},
		"día 0":         {AccountID: 4, StatementDay: day(0)},
		"día 32":        {AccountID: 4, DueDay: day(32)},
		"cupo negativo": {AccountID: 4, CreditLimit: &negative},
		"tasa negativa": {AccountID: 4, InterestRateEA: &negative},
	}
	for name, d := range invalid {
		t.Run(name, func(t *testing.T) {
			svc := NewCreditCardService(mock.NewMockCreditCardRepository(gomock.NewController(t)))
			assert.ErrorIs(t, svc.SaveCreditCard(ctx, d), domain.ErrInvalidCreditCard)
		})
	}
}
