//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAdminMetrics_Integration seeds users with a unique prefix, so the counts of other data in the base
// do not matter: every assertion is about what this test created.
func TestAdminMetrics_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewAdminMetricsRepository(db)
	tag := "k" + uuid.NewString()[:6]

	var ids []string
	newUser := func() string {
		id := uuid.NewString()
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: tag + "-" + id[:8] + "@example.com", Role: domain.RoleUser}))
		ids = append(ids, id)
		return id
	}
	t.Cleanup(func() {
		for _, id := range ids {
			for _, table := range []string{"transactions", "accounts", "banks", "categories", "user_activity_days", "product_events"} {
				_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", id)
			}
			_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
		}
		_, _ = db.Exec(ctx, "SELECT refresh_admin_metrics(current_date - 7)")
	})

	exec := func(sql string, args ...any) {
		_, err := db.Exec(ctx, sql, args...)
		require.NoError(t, err)
	}
	category := func(user, name string) int64 {
		var id int64
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO categories (user_id, name, budget, is_editable, emoji)
VALUES ($1, $2, 0, true, '1F4E6') RETURNING id`, user, name).Scan(&id))
		return id
	}
	account := func(user, bank string) int64 {
		var bankID, accountID int64
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO banks (name, user_id) VALUES ($1, $2) RETURNING id`, bank, user).Scan(&bankID))
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO accounts (user_id, bank_id, type_id, name, last_four_digits, initial_balance)
VALUES ($1, $2, (SELECT min(id) FROM account_types), 'Cuenta', '1234', 0) RETURNING id`, user, bankID).Scan(&accountID))
		return accountID
	}
	transaction := func(user string, categoryID, accountID int64, automated bool, createdAt time.Time) int64 {
		var id int64
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense,
  amount, date, automated, created_at) VALUES ($1, $2, $3, 'x', true, 1000, $4, $5, $4) RETURNING id`,
			user, categoryID, accountID, createdAt, automated).Scan(&id))
		return id
	}

	// 5 users share a custom category and a bank name; only 4 another custom name and another bank
	common, rare := tag+" comun", tag+" rara"
	bankCommon, bankRare := tag+" Banco Común", tag+" Banco Raro"
	now := time.Now()
	yesterday := domain.ActivityDay(now).AddDate(0, 0, -1)
	for i := 0; i < 5; i++ {
		user := newUser()
		cat := category(user, common)
		acc := account(user, bankCommon)
		if i < 4 {
			rareCat := category(user, rare)
			transaction(user, rareCat, account(user, bankRare), true, yesterday.Add(13*time.Hour))
		}
		tx := transaction(user, cat, acc, true, yesterday.Add(12*time.Hour))
		if i < 3 {
			// 3 of them opened the app yesterday: they are "al día"
			exec(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2::date)`, user, yesterday.Format(time.DateOnly))
		}
		if i == 0 {
			props, _ := json.Marshal(map[string]any{"transaction_id": tx})
			exec(`INSERT INTO product_events (user_id, name, props) VALUES ($1, 'tx_category_corrected', $2::jsonb)`, user, string(props))
		}
	}
	// a sixth user opened the app but nothing was read: not "al día"
	lonely := newUser()
	exec(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2::date)`, lonely, yesterday.Format(time.DateOnly))

	// k >= 5 on names: the common category is listed, the rare one is not
	catalog, err := repo.Catalog(ctx, domain.MinGroupUsers)
	require.NoError(t, err)
	listed := map[string]int64{}
	for _, c := range append(catalog.Categories, catalog.CustomCandidates...) {
		listed[strings.ToLower(c.Name)] = c.Users
	}
	assert.Equal(t, int64(5), listed[common])
	_, rareListed := listed[rare]
	assert.False(t, rareListed, "a custom name used by 4 users must not be listed")
	banks := map[string]bool{}
	for _, b := range catalog.AccountsByBank {
		banks[b.Name] = true
	}
	assert.True(t, banks[bankCommon])
	assert.False(t, banks[bankRare], "a bank name used by 4 users must not be listed")

	quality, err := repo.Banks(ctx, now.AddDate(0, 0, -30), domain.MinGroupUsers)
	require.NoError(t, err)
	for _, b := range quality {
		assert.NotEqual(t, bankRare, b.Bank)
	}

	// the North Star of yesterday: without their activity the test users add nothing; with it, the 3 "al día"
	exec(`DELETE FROM user_activity_days WHERE user_id = ANY($1)`, ids)
	_, err = repo.Refresh(ctx, &yesterday)
	require.NoError(t, err)
	baseline := northStar(t, ctx, repo, yesterday)
	for i, user := range ids[:5] {
		if i < 3 {
			exec(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2::date)`, user, yesterday.Format(time.DateOnly))
		}
	}
	exec(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2::date)`, lonely, yesterday.Format(time.DateOnly))
	rows, err := repo.Refresh(ctx, &yesterday)
	require.NoError(t, err)
	assert.Positive(t, rows)
	assert.Equal(t, baseline+3, northStar(t, ctx, repo, yesterday))

	corrected, err := repo.CorrectedTx(ctx, now.AddDate(0, 0, -1))
	require.NoError(t, err)
	assert.GreaterOrEqual(t, corrected, int64(1))

	// users table: rows of this test with counts, filter by search
	page, err := repo.Users(ctx, domain.AdminUserFilter{Search: tag, Limit: 50})
	require.NoError(t, err)
	assert.Equal(t, int64(6), page.Total)
	page, err = repo.Users(ctx, domain.AdminUserFilter{Search: tag, Segment: "active7", Limit: 50})
	require.NoError(t, err)
	assert.Equal(t, int64(4), page.Total, "3 al día + the one that only opened the app")
	page, err = repo.Users(ctx, domain.AdminUserFilter{Search: tag, Segment: "no_connection", Limit: 50})
	require.NoError(t, err)
	assert.Equal(t, int64(6), page.Total)

	// audit
	require.NoError(t, repo.RecordAudit(ctx, domain.AdminAudit{AdminID: ids[0], Action: domain.AdminActionView, Target: "/admin/users"}))
	var audited int
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM admin_audit WHERE admin_id = $1`, ids[0]).Scan(&audited))
	assert.Equal(t, 1, audited)
	exec(`DELETE FROM admin_audit WHERE admin_id = $1`, ids[0])
}

func northStar(t *testing.T, ctx context.Context, repo *repository.AdminMetricsRepository, day time.Time) float64 {
	t.Helper()
	series, err := repo.Series(ctx, []string{domain.MetricNorthStar7d}, day.Format(time.DateOnly), day.Format(time.DateOnly))
	require.NoError(t, err)
	return series.At(domain.MetricNorthStar7d, day.Format(time.DateOnly))
}
