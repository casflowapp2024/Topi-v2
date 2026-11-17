//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// plan/27 §B and §C: reading status per connection, onboarding facts and steps recorded once, and the
// bank_unsupported claim (once, only healthy connections with accounts and no transaction after 48 h)
func TestReadingRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewReadingRepository(db)

	userID := uuid.NewString()
	require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "rd-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
	t.Cleanup(func() {
		for _, table := range []string{"product_events", "transactions", "accounts", "categories", "banks", "processed_emails",
			"connection_incidents", "emails", "notification_prefs", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	})
	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		_, err := db.Exec(ctx, sql, args...)
		require.NoError(t, err)
	}

	exec("INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)

	// nothing yet
	facts, err := repo.OnboardingFacts(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, domain.OnboardingFacts{}, facts)

	// three connections connected 3 days ago: reading (with tx), silent (accounts, no tx), no accounts
	connection := func(address string) uint64 {
		return id(`INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider, created_at)
VALUES ($1, $2, 'a', 'r', 'Bearer', 'gmail', now() - interval '3 days') RETURNING id`, userID, address)
	}
	reading := connection("lee@gmail.com")
	silent := connection("calla@gmail.com")
	lonely := connection("sola@gmail.com")

	supported := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Bancolombia', 'x@banco.test') RETURNING id", userID)
	unknown := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco Raro', 'x@raro.test') RETURNING id", userID)
	category := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Gasto RD', 0, '') RETURNING id", userID)
	account := func(bank, email uint64, digits string) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, email_id)
VALUES ($1, 'Cuenta ' || $2, $2, $3, 1, 0, 'COP', $4) RETURNING id`, userID, digits, bank, email)
	}
	readingAccount := account(supported, reading, "1111")
	silentAccount := account(unknown, silent, "2222")

	exec(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, automated, should_verify, currency)
VALUES ($1, $2, $3, 'compra', true, 10000, now(), true, true, 'COP')`, userID, category, readingAccount)
	exec(`INSERT INTO processed_emails (user_id, email_id, provider, provider_message_id, sender, received_at, extractor, status)
VALUES ($1, $2, 'gmail', 'm1', 'banco', now(), 'gemini', 'transaction'), ($1, $2, 'gmail', 'm2', 'banco', now(), 'gemini', 'no_transaction')`,
		userID, reading)

	statuses, err := repo.ConnectionStatuses(ctx, userID)
	require.NoError(t, err)
	require.Len(t, statuses, 3)
	byID := map[uint64]domain.ConnectionStatus{}
	for _, s := range statuses {
		s.ComputeReading(time.Now())
		byID[s.ID] = s
	}
	assert.Equal(t, domain.ReadingOK, byID[reading].Reading)
	assert.Equal(t, int64(2), byID[reading].EmailsProcessed)
	assert.Equal(t, int64(1), byID[reading].TransactionsCreated)
	assert.NotNil(t, byID[reading].LastReadAt)
	assert.Equal(t, []domain.ConnectionBank{{ID: supported, Name: "Bancolombia", Supported: true, Sender: "x@banco.test",
		Reading: domain.BankOK, AccountIDs: []uint64{readingAccount}}}, byID[reading].Banks)
	assert.Equal(t, domain.ReadingNoTransaction, byID[silent].Reading)
	assert.Equal(t, []domain.ConnectionBank{{ID: unknown, Name: "Banco Raro", Supported: false, Sender: "x@raro.test",
		Reading: domain.BankReading, AccountIDs: []uint64{silentAccount}}}, byID[silent].Banks, "never read: still reading (the 48 h rule still applies)")
	assert.Equal(t, domain.ReadingNoAccounts, byID[lonely].Reading)

	// plan/30: the first read decides the bank state (case of the sender ignored)
	exec(`INSERT INTO email_sync_state (email_id, sender_email, last_run, first_found, first_read_at)
VALUES ($1, 'X@Raro.test', now(), 0, now())`, silent)
	bankOf := func() domain.ConnectionBank {
		t.Helper()
		all, sErr := repo.ConnectionStatuses(ctx, userID)
		require.NoError(t, sErr)
		for _, s := range all {
			if s.ID == silent {
				return s.Banks[0]
			}
		}
		t.Fatal("connection not found")
		return domain.ConnectionBank{}
	}
	assert.Equal(t, domain.BankNoEmails, bankOf().Reading)
	exec(`UPDATE email_sync_state SET first_found = 4 WHERE email_id = $1`, silent)
	assert.Equal(t, domain.BankUnreadable, bankOf().Reading)
	assert.Equal(t, int64(4), bankOf().Found)
	exec(`DELETE FROM email_sync_state WHERE email_id = $1`, silent)

	facts, err = repo.OnboardingFacts(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, domain.OnboardingFacts{HasConnection: true, HasAutoTx: true, PendingReview: 1}, facts)

	// plan/30: a big card purchase read from email also waits for its installments; it counts like in the inbox
	card := id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency)
VALUES ($1, 'TC RD', '3333', $2, 4, 0, 'COP') RETURNING id`, userID, supported)
	exec(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, automated, should_verify, currency)
VALUES ($1, $2, $3, 'nevera', true, 900000, now(), true, true, 'COP')`, userID, category, card)
	facts, err = repo.OnboardingFacts(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, int64(3), facts.PendingReview, "2 por verificar + 1 pregunta de cuotas")
	exec("DELETE FROM transactions WHERE account_id = $1", card)
	exec("DELETE FROM accounts WHERE id = $1", card)

	// steps recorded once
	recorded, err := repo.RecordOnboardingSteps(ctx, userID, []string{domain.StepConnectEmail, domain.StepFirstAutoTx})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{domain.StepConnectEmail, domain.StepFirstAutoTx}, recorded)
	recorded, err = repo.RecordOnboardingSteps(ctx, userID, []string{domain.StepConnectEmail, domain.StepFirstAutoTx, domain.StepBudget})
	require.NoError(t, err)
	assert.Equal(t, []string{domain.StepBudget}, recorded)
	var events int
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM product_events WHERE user_id = $1 AND name = 'onboarding_step_completed'`, userID).Scan(&events))
	assert.Equal(t, 3, events)

	// bank_unsupported: only the silent connection, and only once
	claimFor := func() []uint64 {
		alerts, err := repo.ClaimUnsupportedAlerts(ctx, domain.UnsupportedAfter, 1000)
		require.NoError(t, err)
		var mine []uint64
		for _, a := range alerts {
			if a.UserID == userID {
				mine = append(mine, a.EmailID)
				assert.True(t, strings.HasPrefix(a.UserEmail, "rd-"))
			}
		}
		return mine
	}
	still, err := repo.StillUnsupported(ctx, userID, silent)
	require.NoError(t, err)
	assert.True(t, still)
	assert.Equal(t, []uint64{silent}, claimFor())
	assert.Empty(t, claimFor(), "never twice for the same connection")

	// a transaction arrives before sending: the email is cancelled by the enricher
	exec(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, automated, currency)
VALUES ($1, $2, $3, 'compra', true, 5000, now(), true, 'COP')`, userID, category, silentAccount)
	still, err = repo.StillUnsupported(ctx, userID, silent)
	require.NoError(t, err)
	assert.False(t, still)

	// with connection alerts off nothing is claimed
	another := connection("otra@gmail.com")
	account(unknown, another, "3333")
	exec("INSERT INTO notification_prefs (user_id, email_connection_alerts) VALUES ($1, false)", userID)
	assert.Empty(t, claimFor())

	owns, err := repo.OwnsBank(ctx, userID, unknown)
	require.NoError(t, err)
	assert.True(t, owns)
	owns, err = repo.OwnsBank(ctx, "someone-else", unknown)
	require.NoError(t, err)
	assert.False(t, owns)
}

// plan/27 §C: Topi never stores the body of an email. No table of the email pipeline has a column for it.
func TestNoEmailBodyStored(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	rows, err := db.Query(ctx, `SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('emails', 'processed_emails', 'email_jobs', 'email_outbox', 'transactions', 'connection_incidents', 'product_events', 'feedback')
  AND column_name ~* '(body|html|content|snippet|raw_email|message_text|subject)'`)
	require.NoError(t, err)
	defer rows.Close()
	var found []string
	for rows.Next() {
		var table, column string
		require.NoError(t, rows.Scan(&table, &column))
		found = append(found, table+"."+column)
	}
	assert.Empty(t, found, "a column that could hold an email body")
}

// Panel (plan/27 §C): silent healthy connections counted, bank names only with >= MinGroupUsers users
func TestAdminMetrics_UnsupportedStats(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	metrics := repository.NewAdminMetricsRepository(db)

	before, err := metrics.Reading(ctx)
	require.NoError(t, err)

	// 5 users with a silent "Banco Nuevo" connection and 1 with "Banco Único"
	var ids []string
	add := func(bankName string) {
		userID := uuid.NewString()
		ids = append(ids, userID)
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: userID, Email: "us-" + userID[:8] + "@example.com", Role: domain.RoleUser}))
		var emailID, bankID uint64
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider, created_at)
VALUES ($1, 'x@gmail.com', 'a', 'r', 'Bearer', 'gmail', now() - interval '3 days') RETURNING id`, userID).Scan(&emailID))
		require.NoError(t, db.QueryRow(ctx, `INSERT INTO banks (user_id, name, email) VALUES ($1, $2, 'b@x.test') RETURNING id`,
			userID, bankName).Scan(&bankID))
		_, err := db.Exec(ctx, `INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, email_id)
VALUES ($1, 'C', '0001', $2, 1, 0, 'COP', $3)`, userID, bankID, emailID)
		require.NoError(t, err)
	}
	for i := 0; i < 5; i++ {
		add("Banco Nuevo")
	}
	add("Banco Único")
	t.Cleanup(func() {
		for _, id := range ids {
			for _, table := range []string{"accounts", "banks", "emails"} {
				_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", id)
			}
			_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
		}
	})

	after, err := metrics.Reading(ctx)
	require.NoError(t, err)
	assert.Equal(t, before.Unsupported.Connections+6, after.Unsupported.Connections)
	assert.Equal(t, before.Unsupported.Users+6, after.Unsupported.Users)
	names := map[string]int64{}
	for _, c := range after.Unsupported.ByBank {
		names[c.Name] = c.Count
	}
	assert.GreaterOrEqual(t, names["Banco Nuevo"], int64(5))
	_, shown := names["Banco Único"]
	assert.False(t, shown, "a bank with fewer than 5 users is never named")
	assert.GreaterOrEqual(t, names["otros"], int64(1))

	rates, err := metrics.Activation(ctx, time.Now().AddDate(-5, 0, 0))
	require.NoError(t, err, "the median query runs")
	_ = rates
}
