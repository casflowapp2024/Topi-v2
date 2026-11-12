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

// recordedEvents collects what the services emit
type recordedEvents struct{ events []domain.ProductEvent }

func (r *recordedEvents) Emit(_ context.Context, event domain.ProductEvent) {
	r.events = append(r.events, event)
}

func (r *recordedEvents) names() []string {
	names := make([]string, 0, len(r.events))
	for _, e := range r.events {
		names = append(names, e.Name)
	}
	return names
}

func TestProductEvent_ClosedListAndProps(t *testing.T) {
	valid := []domain.ProductEvent{
		{UserID: "u", Name: domain.ProductEventCategoryCorrected, Props: map[string]any{"transaction_id": uint64(4)}},
		{UserID: "u", Name: domain.ProductEventReviewResolved, Props: map[string]any{"transaction_id": uint64(4), "kind": "installments", "dismissed": true}},
		{UserID: "u", Name: domain.ProductEventBudgetCreated, Props: map[string]any{"category_id": uint64(9)}},
		{UserID: "u", Name: domain.ProductEventAskTopiAsked},
	}
	for _, event := range valid {
		assert.NoError(t, event.Validate(), event.Name)
	}

	invalid := map[string]domain.ProductEvent{
		"name outside the list":   {UserID: "u", Name: "page_viewed"},
		"no user":                 {Name: domain.ProductEventAskTopiAsked},
		"amount in props":         {UserID: "u", Name: domain.ProductEventAmountCorrected, Props: map[string]any{"transaction_id": uint64(1), "amount": 50000.0}},
		"merchant in props":       {UserID: "u", Name: domain.ProductEventCategoryCorrected, Props: map[string]any{"description": "Exito Calle 80"}},
		"free text as enum":       {UserID: "u", Name: domain.ProductEventInsightDismissed, Props: map[string]any{"insight": "gastaste mucho en Exito"}},
		"unknown review kind":     {UserID: "u", Name: domain.ProductEventReviewResolved, Props: map[string]any{"kind": "other"}},
		"id that is not an id":    {UserID: "u", Name: domain.ProductEventBudgetCreated, Props: map[string]any{"category_id": "9"}},
		"negative id":             {UserID: "u", Name: domain.ProductEventBudgetCreated, Props: map[string]any{"category_id": -1}},
		"bool that is not bool":   {UserID: "u", Name: domain.ProductEventReviewResolved, Props: map[string]any{"kind": "verify", "dismissed": "yes"}},
		"long enum (not an enum)": {UserID: "u", Name: domain.ProductEventInsightDismissed, Props: map[string]any{"insight": "a_very_long_insight_name_that_is_not_an_enum"}},
	}
	for name, event := range invalid {
		assert.ErrorIs(t, event.Validate(), domain.ErrInvalidProductEvent, name)
	}
}

func TestProductEventService_DropsInvalidAndNeverFails(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockProductEventRepository(ctrl)
	svc := NewProductEventService(repo)

	valid := domain.ProductEvent{UserID: "u", Name: domain.ProductEventBudgetCreated, Props: map[string]any{"category_id": uint64(1)}}
	repo.EXPECT().Record(gomock.Any(), valid).Return(errors.New("db down"))

	svc.Emit(context.Background(), valid)                                                     // a failed write is only logged
	svc.Emit(context.Background(), domain.ProductEvent{UserID: "u", Name: "not_in_the_list"}) // never reaches the repo
}

func TestTransactionService_UpdateEmitsCorrections(t *testing.T) {
	automated := func() *domain.Transaction {
		return &domain.Transaction{
			ID: 7, UserID: "u1", Amount: 50000, Automated: true, ShouldVerify: true,
			Category: domain.Category{ID: 1}, Account: domain.Account{ID: 2}, Description: "Compra",
		}
	}

	testCases := []struct {
		name     string
		actual   *domain.Transaction
		change   func(*domain.Transaction)
		expected []string
	}{
		{
			name:     "automated: category and amount corrected, verification resolved",
			actual:   automated(),
			change:   func(tx *domain.Transaction) { tx.Category.ID = 3; tx.Amount = 45000 },
			expected: []string{domain.ProductEventCategoryCorrected, domain.ProductEventAmountCorrected, domain.ProductEventReviewResolved},
		},
		{
			name:     "automated: opening it only resolves the verification",
			actual:   automated(),
			change:   func(tx *domain.Transaction) { tx.Checked = true },
			expected: []string{domain.ProductEventReviewResolved},
		},
		{
			name: "manual transaction: no corrections",
			actual: func() *domain.Transaction {
				tx := automated()
				tx.Automated, tx.ShouldVerify = false, false
				return tx
			}(),
			change:   func(tx *domain.Transaction) { tx.Category.ID = 3; tx.Amount = 1 },
			expected: []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockTransactionRepository(ctrl)
			events := &recordedEvents{}
			svc := NewTransactionService(repo, nil, nil)
			svc.SetEvents(events)

			updated := *tc.actual
			updated.ShouldVerify = false
			tc.change(&updated)

			repo.EXPECT().GetTransactionByID(gomock.Any(), "u1", uint64(7)).Return(tc.actual, nil)
			repo.EXPECT().UpdateTransaction(gomock.Any(), &updated).Return(nil)

			require.NoError(t, svc.UpdateTransaction(context.Background(), &updated))
			assert.Equal(t, tc.expected, events.names())
			for _, event := range events.events {
				assert.NoError(t, event.Validate())
				assert.Equal(t, uint64(7), event.Props["transaction_id"])
			}
		})
	}
}

func TestTransactionService_ReviewResolvedEvents(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockTransactionRepository(ctrl)
	events := &recordedEvents{}
	svc := NewTransactionService(repo, nil, nil)
	svc.SetEvents(events)
	ctx := context.Background()

	repo.EXPECT().SetInstallments(ctx, "u1", uint64(1), int16(3)).Return(nil)
	repo.EXPECT().DismissCounterpart(ctx, "u1", uint64(2)).Return(nil)
	repo.EXPECT().DismissTransferCandidate(ctx, "u1", uint64(3), uint64(4)).Return(nil)
	repo.EXPECT().SetInstallments(ctx, "u1", uint64(5), int16(2)).Return(domain.ErrDataNotFound)

	require.NoError(t, svc.SetInstallments(ctx, "u1", 1, 3))
	require.NoError(t, svc.DismissCounterpart(ctx, "u1", 2))
	require.NoError(t, svc.DismissTransferCandidate(ctx, "u1", 3, 4))
	assert.Error(t, svc.SetInstallments(ctx, "u1", 5, 2)) // a failed action emits nothing

	require.Len(t, events.events, 3)
	kinds := []any{}
	for _, event := range events.events {
		assert.Equal(t, domain.ProductEventReviewResolved, event.Name)
		assert.NoError(t, event.Validate())
		kinds = append(kinds, event.Props["kind"])
	}
	assert.Equal(t, []any{domain.ReviewKindInstallments, domain.ReviewKindCounterpart, domain.ReviewKindTransfer}, kinds)
	assert.Equal(t, true, events.events[1].Props["dismissed"])
}

func TestCategoryService_BudgetCreatedEvent(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockCategoryRepository(ctrl)
	events := &recordedEvents{}
	svc := NewCategoryService(repo)
	svc.SetEvents(events)
	ctx := context.Background()

	withBudget := &domain.Category{ID: 10, UserID: "u1", Name: "Mercado", Budget: 800000}
	repo.EXPECT().CreateCategory(ctx, withBudget).Return(nil)
	require.NoError(t, svc.CreateCategory(ctx, withBudget))

	// an existing category without budget gets one: event; changing an existing budget: no event
	repo.EXPECT().GetCategory(ctx, "u1", uint64(11)).Return(&domain.Category{ID: 11, UserID: "u1", Name: "Ocio"}, nil)
	repo.EXPECT().UpdateCategory(ctx, gomock.Any()).Return(nil).Times(2)
	require.NoError(t, svc.UpdateCategory(ctx, &domain.Category{ID: 11, UserID: "u1", Name: "Ocio", Budget: 200000}))
	repo.EXPECT().GetCategory(ctx, "u1", uint64(12)).Return(&domain.Category{ID: 12, UserID: "u1", Name: "Casa", Budget: 100}, nil)
	require.NoError(t, svc.UpdateCategory(ctx, &domain.Category{ID: 12, UserID: "u1", Name: "Casa", Budget: 300}))

	assert.Equal(t, []string{domain.ProductEventBudgetCreated, domain.ProductEventBudgetCreated}, events.names())
	assert.Equal(t, uint64(10), events.events[0].Props["category_id"])
	assert.Equal(t, uint64(11), events.events[1].Props["category_id"])
}
