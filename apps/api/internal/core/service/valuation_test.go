package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValuationService(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 28, 15, 0, 0, 0, time.UTC)
	newService := func(t *testing.T) (*ValuationService, *mock.MockValuationRepository) {
		repo := mock.NewMockValuationRepository(gomock.NewController(t))
		svc := NewValuationService(repo)
		svc.now = func() time.Time { return now }
		return svc, repo
	}

	t.Run("guardar normaliza fecha, fuente y nota", func(t *testing.T) {
		svc, repo := newService(t)
		v := &domain.AccountValuation{UserID: "u1", AccountID: 3, Value: decimal.NewFromInt(10),
			Date: time.Date(2026, 10, 20, 18, 30, 0, 0, time.FixedZone("x", -5*3600)), Note: "  extracto  "}
		repo.EXPECT().UpsertValuation(ctx, v).Return(nil)
		require.NoError(t, svc.SaveValuation(ctx, v))
		assert.Equal(t, time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC), v.Date)
		assert.Equal(t, "manual", v.Source)
		assert.Equal(t, "extracto", v.Note)
	})

	t.Run("una inválida no llega al repositorio", func(t *testing.T) {
		svc, _ := newService(t)
		v := &domain.AccountValuation{UserID: "u1", AccountID: 3, Value: decimal.NewFromInt(-1), Date: now}
		assert.ErrorIs(t, svc.SaveValuation(ctx, v), domain.ErrInvalidValuation)
	})

	t.Run("rendimiento: inicio después del fin", func(t *testing.T) {
		svc, _ := newService(t)
		_, err := svc.GetInvestmentPerformance(ctx, "u1", now, now.AddDate(0, 0, -1))
		assert.ErrorIs(t, err, domain.ErrInvalidDateRange)
	})

	t.Run("rendimiento: al repositorio", func(t *testing.T) {
		svc, repo := newService(t)
		start, end := now.AddDate(0, -1, 0), now
		repo.EXPECT().GetInvestmentPerformance(ctx, "u1", start, end).Return(nil, nil)
		_, err := svc.GetInvestmentPerformance(ctx, "u1", start, end)
		require.NoError(t, err)
	})
}
