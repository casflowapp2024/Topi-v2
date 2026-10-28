//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCurrencyChanges: convertir una inversión registrada en pesos que en realidad es en dólares
// (vista previa sin efectos, aplicar, deshacer), re-etiquetar, tasas faltantes, moneda base y
// cerrar cuentas. Tasas 'manual' COP de septiembre de 2026: 4000 el 1 y el 10, 4100 el 20.
func TestCurrencyChanges(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-cc-" + uuid.NewString()
	d := decimal.RequireFromString
	dates := []string{"2026-09-01", "2026-09-10", "2026-09-20"}

	var inserted int
	require.NoError(t, db.QueryRow(ctx, `WITH ins AS (
		INSERT INTO fx_rates (quote, rate_date, rate, source)
		VALUES ('COP', '2026-09-01', 4000, 'manual'), ('COP', '2026-09-10', 4000, 'manual'), ('COP', '2026-09-20', 4100, 'manual')
		ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) FROM ins`).Scan(&inserted))
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
		if inserted == len(dates) {
			_, _ = db.Exec(ctx, "DELETE FROM fx_rates WHERE quote = 'COP' AND source = 'manual' AND rate_date = ANY($1::date[])", dates)
		}
	})
	if inserted != len(dates) {
		t.Skip("ya hay tasas manuales COP en septiembre de 2026 en esta base")
	}

	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, db.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID)
	cat := id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Varios IT', 0, '') RETURNING id", userID)
	account := func(name, digits string, typeID int, initial string) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'COP', '2026-09-01 12:00:00-05') RETURNING id`,
			userID, name, digits, bank, typeID, initial)
	}
	savings := account("Ahorros IT", "0001", 1, "0")
	broker := account("Bróker IT", "0002", 3, "400000") // 100 US$ registrados en pesos
	wallet := account("Billetera IT", "0003", 1, "0")
	tx := func(accountID uint64, expense bool, amount, at string, group *string) uint64 {
		return id(`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date, transfer_group_id)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6, $7::uuid) RETURNING id`, userID, cat, accountID, expense, amount, at, group)
	}
	group := uuid.NewString()
	tx(broker, false, "800000", "2026-09-10 10:00:00-05", nil)
	tx(broker, true, "41000", "2026-09-20 10:00:00-05", nil)
	tx(savings, true, "410000", "2026-09-20 11:00:00-05", &group)
	tx(broker, false, "410000", "2026-09-20 11:00:00-05", &group)
	walletTx := tx(wallet, true, "100", "2026-09-20 12:00:00-05", nil) // 100 US$ registrados como $100
	_, err = db.Exec(ctx, `INSERT INTO account_valuations (user_id, account_id, valuation_date, value) VALUES ($1, $2, '2026-09-20', 1640000)`,
		userID, broker)
	require.NoError(t, err)

	repo := repository.NewCurrencyChangeRepository(db)
	type row struct {
		Currency, Source string
		Amount, Base     decimal.Decimal
	}
	brokerRows := func() []row {
		t.Helper()
		rows, err := db.Query(ctx, `SELECT currency, coalesce(fx_rate_source, ''), amount::text, amount_base::text
			FROM transactions WHERE account_id = $1 ORDER BY id`, broker)
		require.NoError(t, err)
		defer rows.Close()
		var out []row
		for rows.Next() {
			var r row
			var amount, base string
			require.NoError(t, rows.Scan(&r.Currency, &r.Source, &amount, &base))
			r.Amount, r.Base = d(amount), d(base)
			out = append(out, r)
		}
		return out
	}
	noDrift := func() {
		t.Helper()
		var n int
		require.NoError(t, db.QueryRow(ctx, "SELECT count(*) FROM daily_account_totals_drift() WHERE user_id = $1", userID).Scan(&n))
		assert.Zero(t, n)
	}
	original := brokerRows()

	// vista previa: lo que haría, sin cambiar nada
	preview := &domain.AccountCurrencyChange{UserID: userID, AccountID: broker, NewCurrency: "USD", Mode: domain.CurrencyChangeConvert}
	require.NoError(t, repo.ChangeAccountCurrency(ctx, preview))
	assert.Zero(t, preview.ID)
	assert.Equal(t, "COP", preview.OldCurrency)
	assert.Equal(t, 3, preview.TxCount)
	assert.Zero(t, preview.MissingRates)
	assert.True(t, preview.BalanceBefore.Equal(d("1640000")), preview.BalanceBefore.String())
	require.NotNil(t, preview.BalanceAfter)
	assert.True(t, preview.BalanceAfter.Equal(d("400")), preview.BalanceAfter.String()) // valoración 1.640.000 / 4100
	assert.True(t, preview.FlowsBaseBefore.Equal(d("1169000")), preview.FlowsBaseBefore.String())
	require.NotNil(t, preview.FlowsBaseAfter)
	assert.True(t, preview.FlowsBaseAfter.Equal(preview.FlowsBaseBefore))
	assert.Equal(t, original, brokerRows(), "la vista previa no cambia nada")
	noDrift()

	// aplicar
	apply := *preview
	apply.Apply = true
	require.NoError(t, repo.ChangeAccountCurrency(ctx, &apply))
	require.NotZero(t, apply.ID)
	converted := brokerRows()
	require.Len(t, converted, 3)
	for i, want := range []string{"200", "10", "100"} {
		assert.Equal(t, "USD", converted[i].Currency)
		assert.True(t, converted[i].Amount.Equal(d(want)), converted[i].Amount.String())
		assert.True(t, converted[i].Base.Equal(original[i].Base), "amount_base no cambia")
		assert.Equal(t, "conversion", converted[i].Source)
	}
	var currency, initial, valuation string
	require.NoError(t, db.QueryRow(ctx, `SELECT a.currency, a.initial_balance::text, v.value::text FROM accounts a
		JOIN account_valuations v ON v.account_id = a.id WHERE a.id = $1`, broker).Scan(&currency, &initial, &valuation))
	assert.Equal(t, "USD", currency)
	assert.True(t, d(initial).Equal(d("100")), initial)
	assert.True(t, d(valuation).Equal(d("400")), valuation)
	noDrift()

	changes, err := repo.ListAccountCurrencyChanges(ctx, userID, broker)
	require.NoError(t, err)
	require.Len(t, changes, 1)
	assert.Equal(t, apply.ID, changes[0].ID)

	// deshacer
	require.NoError(t, repo.UndoAccountCurrencyChange(ctx, userID, broker, apply.ID))
	assert.Equal(t, original, brokerRows())
	require.NoError(t, db.QueryRow(ctx, `SELECT a.currency, a.initial_balance::text, v.value::text FROM accounts a
		JOIN account_valuations v ON v.account_id = a.id WHERE a.id = $1`, broker).Scan(&currency, &initial, &valuation))
	assert.Equal(t, "COP", currency)
	assert.True(t, d(initial).Equal(d("400000")))
	assert.True(t, d(valuation).Equal(d("1640000")))
	assert.ErrorIs(t, repo.UndoAccountCurrencyChange(ctx, userID, broker, apply.ID), domain.ErrDataNotFound, "ya deshecho")
	noDrift()

	// re-etiquetar: los $100 eran US$ 100; amount_base pasa a 410.000 (cambian los reportes)
	relabel := &domain.AccountCurrencyChange{UserID: userID, AccountID: wallet, NewCurrency: "USD", Mode: domain.CurrencyChangeRelabel, Apply: true}
	require.NoError(t, repo.ChangeAccountCurrency(ctx, relabel))
	assert.True(t, relabel.FlowsBaseBefore.Equal(d("-100")), relabel.FlowsBaseBefore.String())
	require.NotNil(t, relabel.FlowsBaseAfter)
	assert.True(t, relabel.FlowsBaseAfter.Equal(d("-410000")), relabel.FlowsBaseAfter.String())
	var amount, base string
	require.NoError(t, db.QueryRow(ctx, "SELECT currency, amount::text, amount_base::text FROM transactions WHERE id = $1", walletTx).
		Scan(&currency, &amount, &base))
	assert.Equal(t, "USD", currency)
	assert.True(t, d(amount).Equal(d("100")))
	assert.True(t, d(base).Equal(d("410000")))
	noDrift()

	// después de un movimiento nuevo ya no se puede deshacer
	tx(wallet, true, "5", time.Now().Format(time.RFC3339), nil)
	assert.ErrorIs(t, repo.UndoAccountCurrencyChange(ctx, userID, wallet, relabel.ID), domain.ErrCurrencyChangeNotUndoable)

	// errores
	same := &domain.AccountCurrencyChange{UserID: userID, AccountID: broker, NewCurrency: "COP", Mode: domain.CurrencyChangeConvert}
	assert.ErrorIs(t, repo.ChangeAccountCurrency(ctx, same), domain.ErrInvalidCurrency)
	foreign := &domain.AccountCurrencyChange{UserID: "otro", AccountID: broker, NewCurrency: "USD", Mode: domain.CurrencyChangeConvert}
	assert.ErrorIs(t, repo.ChangeAccountCurrency(ctx, foreign), domain.ErrDataNotFound)
	// faltan tasas (un movimiento de 1980): no se aplica y la vista previa no inventa un "después"
	old := account("Antigua IT", "0004", 1, "0")
	oldTx := tx(old, true, "1000", "1980-01-15 10:00:00-05", nil)
	missing := &domain.AccountCurrencyChange{UserID: userID, AccountID: old, NewCurrency: "USD", Mode: domain.CurrencyChangeConvert, Apply: true}
	assert.ErrorIs(t, repo.ChangeAccountCurrency(ctx, missing), domain.ErrMissingFxRates)
	missing.Apply = false
	require.NoError(t, repo.ChangeAccountCurrency(ctx, missing))
	assert.Equal(t, 1, missing.MissingRates)
	assert.Nil(t, missing.BalanceAfter, "sin tasas no hay \"después\"")
	assert.Nil(t, missing.FlowsBaseAfter)
	_, err = db.Exec(ctx, "DELETE FROM transactions WHERE id = $1", oldTx)
	require.NoError(t, err)

	// moneda base: vista previa y aplicar; las dos patas de la transferencia quedan iguales
	basePreview := &domain.BaseCurrencyChange{UserID: userID, NewCurrency: "USD"}
	require.NoError(t, repo.ChangeBaseCurrency(ctx, basePreview))
	assert.Equal(t, "COP", basePreview.OldCurrency)
	assert.Equal(t, 6, basePreview.TxCount)
	assert.False(t, basePreview.NetWorthAfter.Equal(basePreview.NetWorthBefore))
	var stillCOP string
	require.NoError(t, db.QueryRow(ctx, "SELECT user_base_currency($1)", userID).Scan(&stillCOP))
	assert.Equal(t, "COP", stillCOP)

	baseApply := &domain.BaseCurrencyChange{UserID: userID, NewCurrency: "USD", Apply: true}
	require.NoError(t, repo.ChangeBaseCurrency(ctx, baseApply))
	var legs []string
	rows, err := db.Query(ctx, "SELECT amount_base::text FROM transactions WHERE transfer_group_id = $1::uuid", group)
	require.NoError(t, err)
	for rows.Next() {
		var b string
		require.NoError(t, rows.Scan(&b))
		legs = append(legs, b)
	}
	rows.Close()
	require.Len(t, legs, 2)
	assert.True(t, d(legs[0]).Equal(d(legs[1])), "%v", legs)
	assert.True(t, d(legs[0]).Equal(d("100")), legs[0]) // 410.000 / 4100
	require.NoError(t, db.QueryRow(ctx, "SELECT amount_base::text FROM transactions WHERE id = $1", walletTx).Scan(&base))
	assert.True(t, d(base).Equal(d("100")), base) // la billetera ya es en US$: tasa 1
	noDrift()

	// cerrar y reabrir
	closedAt, err := repo.SetAccountClosed(ctx, userID, wallet, true)
	require.NoError(t, err)
	require.NotNil(t, closedAt)
	accounts := repository.NewAccountRepository(db)
	got, err := accounts.GetAccount(ctx, userID, wallet)
	require.NoError(t, err)
	require.NotNil(t, got.ClosedAt)
	reopened, err := repo.SetAccountClosed(ctx, userID, wallet, false)
	require.NoError(t, err)
	assert.Nil(t, reopened)
	_, err = repo.SetAccountClosed(ctx, "otro", wallet, true)
	assert.ErrorIs(t, err, domain.ErrDataNotFound)
}
