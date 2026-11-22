//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"sort"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// plan/33: the catalog drives the senders of the jobs, links the user banks by name, keeps logos and shows the
// senders users typed without saying who typed them
func TestBankCatalogRepository_Integration(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	users := repository.NewUserRepository(db)
	repo := repository.NewBankCatalogRepository(db)
	accounts := repository.NewAccountRepository(db)

	suffix := strings.ToLower(uuid.NewString()[:8])
	userIDs := []string{}
	newUser := func() string {
		id := uuid.NewString()
		require.NoError(t, users.CreateUser(ctx, &domain.User{ID: id, Email: "bc-" + id[:8] + "@example.com", Role: domain.RoleUser}))
		userIDs = append(userIDs, id)
		return id
	}
	var bankID uint64
	t.Cleanup(func() {
		for _, userID := range userIDs {
			for _, table := range []string{"accounts", "banks", "processed_emails", "emails"} {
				_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
			}
			_, _ = db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
		}
		if bankID != 0 {
			_, _ = db.Exec(ctx, "DELETE FROM bank_catalog WHERE id = $1", bankID)
		}
	})
	scalar := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	effective := func(catalogID *uint64, email string) string {
		t.Helper()
		var out string
		require.NoError(t, db.QueryRow(ctx, "SELECT bank_effective_senders($1, $2)", catalogID, email).Scan(&out))
		return out
	}

	// the seed of the migration is there
	seeded, err := repo.List(ctx)
	require.NoError(t, err)
	var bbva *domain.CatalogBank
	for i := range seeded {
		if seeded[i].Slug == "bbva" {
			bbva = &seeded[i]
		}
	}
	require.NotNil(t, bbva, "BBVA comes from the seed")
	assert.ElementsMatch(t, []string{"bbva@bbvanet.com.co", "notificacionesbreb@bbva.com"}, bbva.ActiveSenders())

	// a new catalog bank, before any user bank exists with its name
	name := "Banco Prueba " + suffix
	created, err := repo.Create(ctx, domain.CatalogBankInput{Name: name, Slug: "banco-prueba-" + suffix, Country: "CO"})
	require.NoError(t, err)
	bankID = created.ID
	official, err := repo.AddSender(ctx, bankID, "alertas@prueba-"+suffix+".co", nil)
	require.NoError(t, err)

	// effective senders: catalog first, then what the user typed that the catalog does not have, lower case
	assert.Equal(t, "alertas@prueba-"+suffix+".co", effective(&bankID, ""))
	assert.Equal(t, "alertas@prueba-"+suffix+".co,extra@prueba.co",
		effective(&bankID, " ALERTAS@prueba-"+suffix+".co, Extra@prueba.co,extra@prueba.co"))
	assert.Equal(t, "a@x.co,b@y.co", effective(nil, "A@x.co, b@y.co,a@x.co,sin-arroba"))

	// a user bank with that name (spaces and case differ), with one extra sender typed by the user
	userA := newUser()
	connection := scalar(`INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider)
VALUES ($1, 'a-`+suffix+`@gmail.com', 'a', 'r', 'Bearer', 'gmail') RETURNING id`, userA)
	userBank := scalar("INSERT INTO banks (user_id, name, email) VALUES ($1, $2, 'propio@prueba.co') RETURNING id",
		userA, "  banco  PRUEBA "+suffix)
	accountID := scalar(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, email_id)
VALUES ($1, 'Ahorros', '1234', $2, 1, 0, 'COP', $3) RETURNING id`, userA, userBank, connection)

	linked, err := repo.LinkUserBanks(ctx, bankID)
	require.NoError(t, err)
	assert.Equal(t, int64(1), linked)

	senders := func() []string {
		t.Helper()
		list, err := accounts.AdminGetAccountsList(ctx, domain.AccountFilters{IDs: []uint64{accountID}, Limit: 50})
		require.NoError(t, err)
		out := []string{}
		for _, a := range list {
			out = append(out, *a.Bank.Email)
		}
		sort.Strings(out)
		return out
	}
	assert.Equal(t, []string{"alertas@prueba-" + suffix + ".co", "propio@prueba.co"}, senders(),
		"one job per sender: the catalog one and the one the user typed")

	// a new sender reaches the user without touching banks.email; a deactivated one stops (and its copy is not an extra)
	added, err := repo.AddSender(ctx, bankID, "nuevo@prueba-"+suffix+".co", nil)
	require.NoError(t, err)
	assert.Contains(t, senders(), "nuevo@prueba-"+suffix+".co")
	require.NoError(t, repo.UpdateSender(ctx, bankID, official.ID, false, nil))
	_, err = db.Exec(ctx, "UPDATE banks SET email = $2 WHERE id = $1", userBank, "alertas@prueba-"+suffix+".co,propio@prueba.co")
	require.NoError(t, err)
	assert.Equal(t, []string{"nuevo@prueba-" + suffix + ".co", "propio@prueba.co"}, senders())
	// adding it again reactivates it
	again, err := repo.AddSender(ctx, bankID, "alertas@prueba-"+suffix+".co", nil)
	require.NoError(t, err)
	assert.Equal(t, official.ID, again.ID)
	assert.True(t, again.Active)
	assert.NotEqual(t, added.ID, again.ID)

	// user senders: the extra shows (institutional domain, one user); a personal address with few users is masked
	userB := newUser()
	_, err = db.Exec(ctx, "INSERT INTO banks (user_id, name, email) VALUES ($1, 'Mi banquito', 'Persona.Real@gmail.com,propio@prueba.co')", userB)
	require.NoError(t, err)
	_, err = db.Exec(ctx, `INSERT INTO processed_emails (user_id, email_id, provider, provider_message_id, sender, received_at, extractor, status)
VALUES ($1, $2, 'gmail', 'bc-`+suffix+`-1', 'Propio <PROPIO@prueba.co>', now(), 'gemini', 'transaction'),
       ($1, $2, 'gmail', 'bc-`+suffix+`-2', 'propio@prueba.co', now(), 'gemini', 'no_transaction')`, userA, connection)
	require.NoError(t, err)

	typed, err := repo.UserSenders(ctx)
	require.NoError(t, err)
	byEmail := map[string]domain.UserSender{}
	for _, u := range typed {
		byEmail[u.Email] = u
		assert.NotContains(t, u.Email, "persona.real", "a personal address of fewer than 5 users never shows")
	}
	propio, ok := byEmail["propio@prueba.co"]
	require.True(t, ok)
	assert.Equal(t, int64(2), propio.Users)
	assert.Equal(t, int64(1), propio.Accounts)
	assert.Nil(t, propio.BankName, "the names of 2 users are hidden")
	require.NotNil(t, propio.CatalogBank)
	assert.Equal(t, name, *propio.CatalogBank)
	assert.Equal(t, int64(2), propio.Read)
	assert.Equal(t, int64(1), propio.Transactions)
	masked, ok := byEmail["p***@gmail.com"]
	require.True(t, ok)
	assert.True(t, masked.Masked)
	_, isCatalog := byEmail["nuevo@prueba-"+suffix+".co"]
	assert.False(t, isCatalog, "a catalog sender of the bank is not a user sender")

	// admin view: usage and health per sender
	banks, err := repo.AdminBanks(ctx)
	require.NoError(t, err)
	var mine *domain.AdminCatalogBank
	for i := range banks {
		if banks[i].ID == bankID {
			mine = &banks[i]
		}
	}
	require.NotNil(t, mine)
	assert.Equal(t, int64(1), mine.Users)
	assert.Equal(t, int64(1), mine.ConnectedUsers)
	assert.Len(t, mine.Senders, 2)
	assert.Nil(t, mine.LogoURL)

	// logo round trip; the URL changes with the content
	require.NoError(t, repo.PutLogo(ctx, domain.BankLogo{BankID: bankID, ContentType: "image/png", Bytes: []byte("\x89PNG\r\n\x1a\nA"), ETag: "aaaaaaaaaaaaaaaa"}))
	logo, err := repo.GetLogo(ctx, bankID)
	require.NoError(t, err)
	assert.Equal(t, "image/png", logo.ContentType)
	require.NoError(t, repo.PutLogo(ctx, domain.BankLogo{BankID: bankID, ContentType: "image/svg+xml", Bytes: []byte("<svg></svg>"), ETag: "bbbbbbbbbbbbbbbb"}))
	listed, err := repo.List(ctx)
	require.NoError(t, err)
	for _, b := range listed {
		if b.ID == bankID {
			require.NotNil(t, b.LogoPath())
			assert.Contains(t, *b.LogoPath(), "v=bbbbbbbbbbbb")
		}
	}
	bankRows := repository.NewBankRepository(db)
	got, err := bankRows.GetBank(ctx, userA, userBank)
	require.NoError(t, err)
	require.NotNil(t, got.CatalogID)
	assert.Equal(t, bankID, *got.CatalogID)
	require.NotNil(t, got.LogoURL)
	require.NoError(t, repo.DeleteLogo(ctx, bankID))
	_, err = repo.GetLogo(ctx, bankID)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)

	// errors: a missing bank, a duplicated name, a bad sender for the CHECK
	_, err = repo.AddSender(ctx, 999999999, "a@b.co", nil)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
	_, err = repo.Create(ctx, domain.CatalogBankInput{Name: name, Slug: "otro-" + suffix, Country: "CO"})
	assert.ErrorIs(t, err, domain.ErrConflictingData)
	assert.ErrorIs(t, repo.SetActive(ctx, 999999999, false), domain.ErrDataNotFound)
}
