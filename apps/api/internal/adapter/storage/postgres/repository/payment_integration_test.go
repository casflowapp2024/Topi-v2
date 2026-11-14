//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPaymentRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewPaymentRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "pay-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID) })

	created, err := repo.Create(ctx, domain.Payment{UserID: userID, Provider: domain.ProviderMercadoPago,
		Kind: domain.PaymentKindSupport, Amount: decimal.NewFromInt(20000), Currency: "COP", Status: domain.PaymentCreated})
	require.NoError(t, err)
	require.NotEmpty(t, created.ID)
	assert.Equal(t, "20000", created.Amount.String())
	require.NoError(t, repo.SetCheckoutRef(ctx, created.ID, "pref-1"))

	// owner only; malformed ids are not found
	_, err = repo.GetForUser(ctx, "someone-else", created.ID)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	_, err = repo.Get(ctx, "not-a-uuid")
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	got, err := repo.GetForUser(ctx, userID, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "pref-1", *got.CheckoutRef)

	pp := func(ref, status string, amount int64) domain.ProviderPayment {
		return domain.ProviderPayment{Ref: ref, ExternalReference: created.ID, Status: status, RawStatus: status + "/x",
			Amount: decimal.NewFromInt(amount), Currency: "COP"}
	}

	// pending, then approved: Approved only the first time, even with concurrent notifications
	applied, err := repo.Apply(ctx, created.ID, pp("mp-1", domain.PaymentPending, 20000))
	require.NoError(t, err)
	assert.False(t, applied.Approved)
	assert.Equal(t, domain.PaymentPending, applied.Payment.Status)

	var wg sync.WaitGroup
	var mu sync.Mutex
	approvals := 0
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			a, err := repo.Apply(ctx, created.ID, pp("mp-1", domain.PaymentApproved, 20000))
			assert.NoError(t, err)
			if a != nil && a.Approved {
				mu.Lock()
				approvals++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	assert.Equal(t, 1, approvals)

	got, err = repo.Get(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentApproved, got.Status)
	require.NotNil(t, got.ApprovedAt)
	assert.Equal(t, "approved/x", *got.RawStatus)

	// a late pending never moves it back
	applied, err = repo.Apply(ctx, created.ID, pp("mp-1", domain.PaymentPending, 20000))
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentApproved, applied.Payment.Status)

	// paid twice in the same checkout: its own row, and repeating it does not duplicate
	applied, err = repo.Apply(ctx, created.ID, pp("mp-2", domain.PaymentApproved, 20000))
	require.NoError(t, err)
	assert.True(t, applied.Approved)
	assert.NotEqual(t, created.ID, applied.Payment.ID)
	applied, err = repo.Apply(ctx, created.ID, pp("mp-2", domain.PaymentApproved, 20000))
	require.NoError(t, err)
	assert.False(t, applied.Approved)
	var rows int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM payments WHERE user_id = $1", userID).Scan(&rows))
	assert.Equal(t, 2, rows)

	// refund of the second one is applied to its own row
	applied, err = repo.Apply(ctx, created.ID, pp("mp-2", domain.PaymentRefunded, 20000))
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentRefunded, applied.Payment.Status)

	// receipt mark is kept once set
	require.NoError(t, repo.MarkReceiptEnqueued(ctx, created.ID))
	got, err = repo.Get(ctx, created.ID)
	require.NoError(t, err)
	first := *got.ReceiptEnqueuedAt
	require.NoError(t, repo.MarkReceiptEnqueued(ctx, created.ID))
	got, err = repo.Get(ctx, created.ID)
	require.NoError(t, err)
	assert.True(t, first.Equal(*got.ReceiptEnqueuedAt))

	// the admin report counts this user's approved support payment (other tests may add more)
	report, err := repo.Money(ctx, time.Now().AddDate(0, -11, 0), 20)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, report.Payments, int64(1))
	assert.NotEmpty(t, report.Months)
	found := false
	for _, p := range report.Recent {
		if p.ID == created.ID {
			found = true
			assert.Equal(t, userID[:8], p.UserShort)
		}
	}
	assert.True(t, found)

	// product events accept the new names (and still reject unknown ones)
	events := repository.NewProductEventRepository(db)
	require.NoError(t, events.Record(ctx, domain.ProductEvent{UserID: userID, Name: domain.ProductEventSupportApproved}))
	assert.Error(t, events.Record(ctx, domain.ProductEvent{UserID: userID, Name: "support_bogus"}))
}
