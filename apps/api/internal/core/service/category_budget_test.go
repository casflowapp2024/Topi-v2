package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func budgetMonth(y int, m time.Month) time.Time { return time.Date(y, m, 1, 0, 0, 0, 0, time.UTC) }

func TestCategoryService_SetBudget(t *testing.T) {
	ctx := context.Background()
	current := budgetMonth(2026, time.November)
	june := budgetMonth(2026, time.June)
	december := budgetMonth(2026, time.December)

	tests := []struct {
		name    string
		from    *time.Time
		saved   *time.Time
		wantErr error
	}{
		{name: "defaults to the user's current month", saved: &current},
		{name: "a past month keeps the later versions", from: &june, saved: &june},
		{name: "a future month is rejected", from: &december, wantErr: domain.ErrBudgetMonthOutOfRange},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockCategoryRepository(ctrl)
			svc := NewCategoryService(repo)

			repo.EXPECT().GetCategory(ctx, "u1", uint64(7)).Return(&domain.Category{ID: 7, UserID: "u1", Budget: 800}, nil)
			repo.EXPECT().CurrentBudgetMonth(ctx, "u1").Return(current, nil)
			if tt.saved != nil {
				repo.EXPECT().UpsertCategoryBudget(ctx, domain.CategoryBudget{
					CategoryID: 7, UserID: "u1", Budget: 1000, EffectiveFrom: *tt.saved,
				}).Return(nil)
				repo.EXPECT().ListCategoryBudgets(ctx, "u1", uint64(7)).
					Return([]domain.CategoryBudget{{Budget: 1000, EffectiveFrom: current}}, nil)
			}

			versions, err := svc.SetBudget(ctx, "u1", 7, 1000, tt.from)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			assert.NoError(t, err)
			assert.Len(t, versions, 1)
		})
	}
}

func TestCategoryService_SetBudget_UnknownCategory(t *testing.T) {
	ctx := context.Background()
	ctrl := gomock.NewController(t)
	repo := mock.NewMockCategoryRepository(ctrl)
	repo.EXPECT().GetCategory(ctx, "u1", uint64(7)).Return(nil, domain.ErrDataNotFound)

	_, err := NewCategoryService(repo).SetBudget(ctx, "u1", 7, 1000, nil)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
}

func TestCategoryService_DeleteBudget(t *testing.T) {
	ctx := context.Background()
	june := budgetMonth(2026, time.June)
	versions := []domain.CategoryBudget{
		{Budget: 1000, EffectiveFrom: budgetMonth(2026, time.November)},
		{Budget: 900, EffectiveFrom: june},
		{Budget: 800, EffectiveFrom: domain.BudgetBaseMonth},
	}

	tests := []struct {
		name    string
		month   time.Time
		deletes bool
		wantErr error
	}{
		{name: "deletes a later version", month: june, deletes: true},
		{name: "the base version cannot be deleted", month: domain.BudgetBaseMonth, wantErr: domain.ErrBudgetBaseVersion},
		{name: "a month without version", month: budgetMonth(2026, time.July), wantErr: domain.ErrDataNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockCategoryRepository(ctrl)
			repo.EXPECT().GetCategory(ctx, "u1", uint64(7)).Return(&domain.Category{ID: 7, UserID: "u1"}, nil)
			repo.EXPECT().ListCategoryBudgets(ctx, "u1", uint64(7)).Return(versions, nil)
			if tt.deletes {
				repo.EXPECT().DeleteCategoryBudget(ctx, "u1", uint64(7), tt.month).Return(nil)
				repo.EXPECT().ListCategoryBudgets(ctx, "u1", uint64(7)).Return(versions[:1], nil)
			}

			got, err := NewCategoryService(repo).DeleteBudget(ctx, "u1", 7, tt.month)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			assert.NoError(t, err)
			assert.Len(t, got, 1)
		})
	}
}

func TestCategoryService_ListBudgets_ChecksOwnership(t *testing.T) {
	ctx := context.Background()
	ctrl := gomock.NewController(t)
	repo := mock.NewMockCategoryRepository(ctrl)
	repo.EXPECT().GetCategory(ctx, "u1", uint64(7)).Return(nil, errors.New("boom"))

	_, err := NewCategoryService(repo).ListBudgets(ctx, "u1", 7)
	assert.Error(t, err)
}
