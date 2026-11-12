//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestActivityAndFounderRepositories_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	activity := repository.NewActivityRepository(db)
	founders := repository.NewFounderRepository(db)

	newUser := func(createdAt time.Time) string {
		id := uuid.NewString()
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: "act-" + id[:8] + "@example.com", Role: domain.RoleUser}))
		_, err := db.Exec(ctx, "UPDATE users SET created_at = $2 WHERE id = $1", id, createdAt)
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id) })
		return id
	}

	old := newUser(time.Now().AddDate(-1, 0, 0))
	recent := newUser(time.Now())

	// activity: one row per user and day, repeated writes are ignored, unknown users too
	day := domain.ActivityDay(time.Now())
	require.NoError(t, activity.MarkActive(ctx, old, day))
	require.NoError(t, activity.MarkActive(ctx, old, day))
	require.NoError(t, activity.MarkActive(ctx, old, day.AddDate(0, 0, -1)))
	require.NoError(t, activity.MarkActive(ctx, "does-not-exist", day))

	var rows int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM user_activity_days WHERE user_id = $1", old).Scan(&rows))
	assert.Equal(t, 2, rows)
	var stored string
	require.NoError(t, db.QueryRow(ctx, "SELECT max(day)::text FROM user_activity_days WHERE user_id = $1", old).Scan(&stored))
	assert.Equal(t, day.Format(time.DateOnly), stored)

	// founders: only the users created before the cutoff; running it again marks nobody new
	cutoff := time.Now().AddDate(0, 0, -1)
	marked, err := founders.MarkEligible(ctx, cutoff)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, marked, int64(1))

	eligible := func(id string) bool {
		var value bool
		require.NoError(t, db.QueryRow(ctx, "SELECT founder_eligible FROM users WHERE id = $1", id).Scan(&value))
		return value
	}
	assert.True(t, eligible(old))
	assert.False(t, eligible(recent))

	again, err := founders.MarkEligible(ctx, cutoff)
	require.NoError(t, err)
	assert.Equal(t, int64(0), again)

	// an earlier cutoff never unmarks
	_, err = founders.MarkEligible(ctx, time.Now().AddDate(-5, 0, 0))
	require.NoError(t, err)
	assert.True(t, eligible(old))
}

func TestProductEventRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewProductEventRepository(db)

	id := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: "pe-" + id[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() { _, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id) })

	require.NoError(t, repo.Record(ctx, domain.ProductEvent{UserID: id, Name: domain.ProductEventReviewResolved,
		Props: map[string]any{"transaction_id": uint64(42), "kind": domain.ReviewKindVerify}}))
	require.NoError(t, repo.Record(ctx, domain.ProductEvent{UserID: id, Name: domain.ProductEventAskTopiAsked}))

	var kind string
	var txID int64
	require.NoError(t, db.QueryRow(ctx, `SELECT props->>'kind', (props->>'transaction_id')::bigint FROM product_events
WHERE user_id = $1 AND name = 'review_resolved'`, id).Scan(&kind, &txID))
	assert.Equal(t, domain.ReviewKindVerify, kind)
	assert.Equal(t, int64(42), txID)

	// the table also enforces the closed list
	assert.Error(t, repo.Record(ctx, domain.ProductEvent{UserID: id, Name: "page_viewed"}))
}

func TestFounderRepository_ConfirmAndAudit_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	founders := repository.NewFounderRepository(db)
	tag := "fd" + uuid.NewString()[:6]

	var ids []string
	newUser := func(eligible bool) string {
		id := uuid.NewString()
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: tag + "-" + id[:8] + "@example.com", Role: domain.RoleUser}))
		_, err := db.Exec(ctx, "UPDATE users SET founder_eligible = $2 WHERE id = $1", id, eligible)
		require.NoError(t, err)
		ids = append(ids, id)
		return id
	}
	admin := newUser(false)
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM admin_audit WHERE admin_id = $1", admin)
		for _, id := range ids {
			_, _ = db.Exec(ctx, "DELETE FROM user_activity_days WHERE user_id = $1", id)
			_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
		}
	})

	active := newUser(true)
	ghost := newUser(true) // eligible, no activity
	notEligible := newUser(false)
	require.NoError(t, repository.NewActivityRepository(db).MarkActive(ctx, active, domain.ActivityDay(time.Now())))
	require.NoError(t, repository.NewActivityRepository(db).MarkActive(ctx, notEligible, domain.ActivityDay(time.Now())))

	list, err := founders.List(ctx, domain.FounderActiveDays)
	require.NoError(t, err)
	state := map[string]bool{}
	for _, r := range list.Active {
		state[r.ID] = true
	}
	for _, r := range list.Inactive {
		state[r.ID] = false
	}
	assert.Equal(t, true, state[active])
	assert.Equal(t, false, state[ghost])
	_, listed := state[notEligible]
	assert.False(t, listed, "a user registered after the cutoff is not in the list")

	confirmedAt := func(id string) *time.Time {
		var at *time.Time
		require.NoError(t, db.QueryRow(ctx, "SELECT founder_confirmed_at FROM users WHERE id = $1", id).Scan(&at))
		return at
	}
	auditCount := func(action string) int {
		var n int
		require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM admin_audit WHERE admin_id = $1 AND action = $2", admin, action).Scan(&n))
		return n
	}

	// preview changes nothing
	preview, err := founders.ConfirmActive(ctx, admin, domain.FounderActiveDays, true)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, preview.ToConfirm, int64(1))
	assert.Nil(t, confirmedAt(active))
	assert.Equal(t, 0, auditCount(domain.AdminActionFounderConfirmActive))

	// bulk: the active one is confirmed, the ghost stays eligible (and exists), with one audit row
	_, err = founders.ConfirmActive(ctx, admin, domain.FounderActiveDays, false)
	require.NoError(t, err)
	assert.NotNil(t, confirmedAt(active))
	assert.Nil(t, confirmedAt(ghost))
	assert.Equal(t, 1, auditCount(domain.AdminActionFounderConfirmActive))

	// one by one, audited; a non eligible user cannot be confirmed
	require.NoError(t, founders.SetConfirmed(ctx, admin, ghost, true))
	assert.NotNil(t, confirmedAt(ghost))
	require.NoError(t, founders.SetConfirmed(ctx, admin, ghost, false))
	assert.Nil(t, confirmedAt(ghost))
	assert.ErrorIs(t, founders.SetConfirmed(ctx, admin, notEligible, true), domain.ErrNotFounderEligible)
	assert.ErrorIs(t, founders.SetConfirmed(ctx, admin, "does-not-exist", true), domain.ErrNotFounderEligible)
	assert.Equal(t, 1, auditCount(domain.AdminActionFounderConfirm))
	assert.Equal(t, 1, auditCount(domain.AdminActionFounderUnconfirm))

	// nobody was deleted
	var alive int
	require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM users WHERE id = ANY($1)", ids).Scan(&alive))
	assert.Equal(t, len(ids), alive)
}
