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

// TestAccountIdentifiers: los dígitos opcionales, el número escrito como identificador 'user', varios números por
// cuenta y lo que lee el worker (plan/32).
func TestAccountIdentifiers(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-ident-" + uuid.NewString()
	t.Cleanup(func() {
		for _, table := range []string{"transactions", "accounts", "categories", "banks", "emails"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})

	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	otherBank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Otro IT', 'it@otro.test') RETURNING id", userID)
	emailID := id(`INSERT INTO emails (user_id, email, access_token, refresh_token, token_type, provider)
		VALUES ($1, 'it@gmail.test', 'a', 'r', 'Bearer', 'gmail') RETURNING id`, userID)
	accounts := repository.NewAccountRepository(db)

	create := func(name, digits string, bankID, typeID uint64) *domain.Account {
		t.Helper()
		account := &domain.Account{UserID: userID, Name: name, LastFourDigits: digits, Bank: domain.Bank{ID: bankID},
			Type: domain.AccountType{ID: typeID}, Email: domain.Email{ID: &emailID}}
		require.NoError(t, accounts.CreateAccount(ctx, account))
		return account
	}
	digitsOf := func(accountID uint64) []string {
		t.Helper()
		list, err := accounts.ListIdentifiers(ctx, userID, accountID)
		require.NoError(t, err)
		out := make([]string, 0, len(list))
		for _, i := range list {
			out = append(out, i.Digits+":"+i.Source)
		}
		return out
	}

	// sin dígitos: varias cuentas del mismo banco ya no chocan
	savings := create("Ahorros IT", "", bank, 1)
	checking := create("Corriente IT", "", bank, 1)
	assert.Empty(t, digitsOf(savings.ID))
	card := create("Visa IT", "1111", bank, 4)
	assert.Equal(t, []string{"1111:user"}, digitsOf(card.ID))

	// los mismos dígitos en otra cuenta del banco: error claro; en otro banco sí se puede
	err := accounts.CreateAccount(ctx, &domain.Account{UserID: userID, Name: "Repetida", LastFourDigits: "1111",
		Bank: domain.Bank{ID: bank}, Type: domain.AccountType{ID: 1}})
	assert.ErrorIs(t, err, domain.ErrIdentifierTaken)
	create("Otra IT", "1111", otherBank, 1)

	// una tarjeta adicional: segundo número de la misma cuenta; repetirlo no duplica; de otra cuenta → tomado
	extra := &domain.AccountIdentifier{UserID: userID, AccountID: card.ID, Digits: "2222", Source: domain.IdentifierSourceUser}
	require.NoError(t, accounts.CreateIdentifier(ctx, extra))
	again := &domain.AccountIdentifier{UserID: userID, AccountID: card.ID, Digits: "2222", Source: domain.IdentifierSourceUser}
	require.NoError(t, accounts.CreateIdentifier(ctx, again))
	assert.Equal(t, extra.ID, again.ID)
	taken := &domain.AccountIdentifier{UserID: userID, AccountID: savings.ID, Digits: "2222", Source: domain.IdentifierSourceUser}
	assert.ErrorIs(t, accounts.CreateIdentifier(ctx, taken), domain.ErrIdentifierTaken)
	notMine := &domain.AccountIdentifier{UserID: "otro-" + userID, AccountID: card.ID, Digits: "3333", Source: domain.IdentifierSourceUser}
	assert.ErrorIs(t, accounts.CreateIdentifier(ctx, notMine), domain.ErrDataNotFound)

	// cambiar el número escrito reemplaza el 'user' anterior y deja los demás
	card.LastFourDigits = "5555"
	require.NoError(t, accounts.UpdateAccount(ctx, card))
	assert.Equal(t, []string{"2222:user", "5555:user"}, digitsOf(card.ID))
	// actualizar sin dígitos los conserva; con ClearLastFourDigits los quita
	card.LastFourDigits = ""
	require.NoError(t, accounts.UpdateAccount(ctx, card))
	assert.Equal(t, "5555", card.LastFourDigits)
	card.ClearLastFourDigits = true
	require.NoError(t, accounts.UpdateAccount(ctx, card))
	assert.Equal(t, "", card.LastFourDigits)
	assert.Equal(t, []string{"2222:user"}, digitsOf(card.ID))

	// borrar el identificador que es el número escrito deja la cuenta sin número
	savings.LastFourDigits = "7777"
	require.NoError(t, accounts.UpdateAccount(ctx, savings))
	list, err := accounts.ListIdentifiers(ctx, userID, savings.ID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.NoError(t, accounts.DeleteIdentifier(ctx, userID, savings.ID, list[0].ID))
	reloaded, err := accounts.GetAccount(ctx, userID, savings.ID)
	require.NoError(t, err)
	assert.Equal(t, "", reloaded.LastFourDigits)
	assert.ErrorIs(t, accounts.DeleteIdentifier(ctx, userID, savings.ID, list[0].ID), domain.ErrDataNotFound)

	// el worker recibe todos los números
	listed, err := accounts.AdminGetAccountsList(ctx, domain.AccountFilters{IDs: []uint64{card.ID, checking.ID}, Limit: 10})
	require.NoError(t, err)
	byID := map[uint64][]string{}
	for _, a := range listed {
		byID[a.ID] = a.Identifiers
	}
	assert.Equal(t, []string{"2222"}, byID[card.ID])
	assert.Equal(t, []string{}, byID[checking.ID])

	// la restricción de la base: solo 4 números o vacío
	_, err = db.Exec(ctx, "UPDATE accounts SET last_four_digits = '12a4' WHERE id = $1", savings.ID)
	assert.Error(t, err)
}

// TestLearnAccountIdentifier: mover un movimiento leído de un correo enseña los dígitos a la cuenta y mueve los
// demás pendientes con esos dígitos (plan/32 bloque C).
func TestLearnAccountIdentifier(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-learn-" + uuid.NewString()
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})
	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	otherBank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Otro IT', 'it@otro.test') RETURNING id", userID)
	cat := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'IT', 0, '') RETURNING id", userID)
	account := func(name, digits string, bankID uint64, typeID int, currency string) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency)
			VALUES ($1, $2, $3, $4, $5, 0, $6) RETURNING id`, userID, name, digits, bankID, typeID, currency)
	}
	first := account("Ahorros IT", "", bank, 1, "COP")
	card := account("Visa IT", "", bank, 4, "COP")
	other := account("Otro banco IT", "", otherBank, 1, "COP")
	investment := account("Fondo IT", "", bank, 3, "COP")
	dollars := account("Dólares IT", "", bank, 1, "USD")

	transactions := repository.NewTransactionRepository(db)
	read := func(accountID uint64, hint string, verify bool) domain.Transaction {
		t.Helper()
		msg := uuid.NewString()
		created, err := transactions.AdminCreateTransactions(ctx, []domain.Transaction{{
			UserID: userID, Category: domain.Category{ID: cat}, Account: domain.Account{ID: accountID},
			Description: "IT", Expense: true, Amount: 1000, Date: time.Now(), Automated: true,
			ShouldVerify: verify, SourceMessageID: &msg, SourceAccountHint: &hint,
		}})
		require.NoError(t, err)
		require.Len(t, created.Created, 1)
		return created.Created[0]
	}
	accountOf := func(tx domain.Transaction) (uint64, bool) {
		t.Helper()
		out, err := transactions.GetTransactionByID(ctx, userID, tx.ID)
		require.NoError(t, err)
		require.NotNil(t, out.SourceAccountHint)
		return out.Account.ID, out.ShouldVerify
	}

	corrected := read(first, "4321", true)
	pending := read(first, "4321", true)
	reviewed := read(first, "4321", false) // ya revisado por el usuario: no se toca
	otherDigits := read(first, "9999", true)

	// a otro banco o a una inversión no se aprende nada
	learned, err := transactions.LearnAccountIdentifier(ctx, userID, "4321", bank, other)
	require.NoError(t, err)
	assert.False(t, learned.Learned)
	learned, err = transactions.LearnAccountIdentifier(ctx, userID, "4321", bank, investment)
	require.NoError(t, err)
	assert.False(t, learned.Learned)

	learned, err = transactions.LearnAccountIdentifier(ctx, userID, "4321", bank, card)
	require.NoError(t, err)
	assert.Equal(t, domain.LearnedIdentifiers{Learned: true, Digits: "4321", Moved: 2}, *learned) // corrected + pending
	for _, tx := range []domain.Transaction{corrected, pending} {
		accountID, verify := accountOf(tx)
		assert.Equal(t, card, accountID)
		assert.False(t, verify)
	}
	accountID, _ := accountOf(reviewed)
	assert.Equal(t, first, accountID)
	accountID, verify := accountOf(otherDigits)
	assert.Equal(t, first, accountID)
	assert.True(t, verify)

	// los dígitos ya son de la tarjeta: una corrección a otra cuenta no los mueve
	learned, err = transactions.LearnAccountIdentifier(ctx, userID, "4321", bank, first)
	require.NoError(t, err)
	assert.Equal(t, domain.LearnedIdentifiers{}, *learned)
	// otra moneda: se aprende, pero no se mueven movimientos de una cuenta en COP
	read(first, "8888", true)
	learned, err = transactions.LearnAccountIdentifier(ctx, userID, "8888", bank, dollars)
	require.NoError(t, err)
	assert.Equal(t, domain.LearnedIdentifiers{Learned: true, Digits: "8888", Moved: 0}, *learned)
}
