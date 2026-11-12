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

func TestFounderAdminService(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockFounderRepository(ctrl)
	svc := NewFounderAdminService(repo)
	ctx := context.Background()

	// without an admin nothing reaches the repository
	_, err := svc.ConfirmActive(ctx, "", false)
	assert.ErrorIs(t, err, domain.ErrForbidden)
	assert.ErrorIs(t, svc.Confirm(ctx, "", "u1"), domain.ErrForbidden)
	assert.ErrorIs(t, svc.Unconfirm(ctx, "a1", "  "), domain.ErrNotFounderEligible)

	repo.EXPECT().List(ctx, domain.FounderActiveDays).Return(domain.FounderList{Eligible: 2}, nil)
	list, err := svc.List(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(2), list.Eligible)

	repo.EXPECT().ConfirmActive(ctx, "a1", domain.FounderActiveDays, true).Return(domain.FounderBulkResult{DryRun: true, ToConfirm: 4}, nil)
	preview, err := svc.ConfirmActive(ctx, "a1", true)
	require.NoError(t, err)
	assert.Equal(t, int64(4), preview.ToConfirm)

	repo.EXPECT().SetConfirmed(ctx, "a1", "u1", true).Return(nil)
	repo.EXPECT().SetConfirmed(ctx, "a1", "u1", false).Return(nil)
	assert.NoError(t, svc.Confirm(ctx, "a1", "u1"))
	assert.NoError(t, svc.Unconfirm(ctx, "a1", "u1"))
}
