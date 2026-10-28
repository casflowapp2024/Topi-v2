//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAccountAndUserExtraRepositories recorre el CRUD de cuentas y user_extra contra el esquema
// migrado. Las migraciones agregan columnas a esas tablas (000024: currency, base_currency): los
// repositorios deben seguir funcionando sin depender de "*".
func TestAccountAndUserExtraRepositories(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-acc-" + uuid.NewString()
	t.Cleanup(func() {
		for _, table := range []string{"accounts", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})

	extras := repository.NewUserExtraRepository(db)
	extra := &domain.UserExtra{UserID: userID, UTCOffset: "America/Bogota", Whatsapp: "", Config: []byte("{}")}
	require.NoError(t, extras.Create(ctx, extra))
	got, err := extras.GetByUserID(ctx, userID)
	require.NoError(t, err)
	assert.Equal(t, "America/Bogota", got.UTCOffset)

	var bankID uint64
	require.NoError(t, db.QueryRow(ctx,
		"INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID).Scan(&bankID))

	accounts := repository.NewAccountRepository(db)
	account := &domain.Account{UserID: userID, Name: "Cuenta IT", LastFourDigits: "4321", InitialBalance: 1500.5,
		Bank: domain.Bank{ID: bankID}, Type: domain.AccountType{ID: 1}}
	require.NoError(t, accounts.CreateAccount(ctx, account))
	require.NotZero(t, account.ID)

	read, err := accounts.GetAccount(ctx, userID, account.ID)
	require.NoError(t, err)
	assert.Equal(t, "Cuenta IT", read.Name)
	assert.Equal(t, 1500.5, read.InitialBalance)

	list, err := accounts.GetAccountsList(ctx, userID, 0, 10, nil)
	require.NoError(t, err)
	require.Len(t, list, 1)

	account.Name = "Cuenta IT editada"
	require.NoError(t, accounts.UpdateAccount(ctx, account))
	assert.Equal(t, "Cuenta IT editada", account.Name)

	require.NoError(t, accounts.DeleteAccount(ctx, userID, account.ID))
}
