//go:build integration

package repository_test

import (
	"context"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// multicurrencyFixture crea, dentro de tx, un usuario con base COP (zona Bogotá), un banco, una
// categoría de gasto y otra de ingreso, y cuentas COP, USD y EUR de ahorro.
type multicurrencyFixture struct {
	userID                 string
	expenseCat, incomeCat  uint64
	cop, usd, eur, usdCard uint64
}

func newMulticurrencyFixture(t *testing.T, ctx context.Context, tx pgx.Tx) multicurrencyFixture {
	t.Helper()
	f := multicurrencyFixture{userID: "it-mc-" + uuid.NewString()}
	exec := func(sql string, args ...any) {
		t.Helper()
		_, err := tx.Exec(ctx, sql, args...)
		require.NoError(t, err)
	}
	id := func(sql string, args ...any) uint64 {
		t.Helper()
		var out uint64
		require.NoError(t, tx.QueryRow(ctx, sql, args...).Scan(&out))
		return out
	}

	exec("INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", f.userID)
	bank := id("INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", f.userID)
	f.expenseCat = id("INSERT INTO categories (user_id, name, budget, emoji) VALUES ($1, 'Gasto IT', 0, '') RETURNING id", f.userID)
	f.incomeCat = id("INSERT INTO categories (user_id, name, budget, emoji, income) VALUES ($1, 'Ingreso IT', 0, '', true) RETURNING id", f.userID)
	account := func(name, digits, currency string, typeID int) uint64 {
		return id(`INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
			VALUES ($1, $2, $3, $4, $5, 0, $6, '2026-10-01 12:00:00-05') RETURNING id`,
			f.userID, name, digits, bank, typeID, currency)
	}
	f.cop = account("COP IT", "0001", "COP", 1)
	f.usd = account("USD IT", "0002", "USD", 1)
	f.eur = account("EUR IT", "0003", "EUR", 1)
	f.usdCard = account("Tarjeta USD IT", "0004", "USD", 4)

	// tasas 'manual' (ganan sobre cualquier tasa real del mismo día)
	exec(`INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES
		('COP', '1995-06-16', 4000, 'SFC_TRM'), ('EUR', '1995-06-16', 0.8, 'ECB'),
		('COP', '2026-10-20', 4000, 'manual'), ('COP', '2026-10-21', 4100, 'manual')`)
	return f
}

type txRow struct {
	Currency     string
	FxRate       *string
	FxRateSource *string
	AmountBase   *string
}

func readTx(t *testing.T, ctx context.Context, tx pgx.Tx, id uint64) txRow {
	t.Helper()
	var r txRow
	require.NoError(t, tx.QueryRow(ctx,
		"SELECT currency, fx_rate::text, fx_rate_source, amount_base::text FROM transactions WHERE id = $1", id).
		Scan(&r.Currency, &r.FxRate, &r.FxRateSource, &r.AmountBase))
	return r
}

func ptr(s string) *string { return &s }

func TestMulticurrencyTransactions(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	tx, err := db.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(ctx) })
	f := newMulticurrencyFixture(t, ctx, tx)

	// insert crea un gasto; extra = pares (columna, valor) adicionales
	insert := func(account uint64, amount string, date string, extra ...any) uint64 {
		t.Helper()
		var id uint64
		cols := ""
		args := []any{f.userID, f.expenseCat, account, amount, date}
		for i := 0; i+1 < len(extra); i += 2 {
			cols += ", " + extra[i].(string)
			args = append(args, extra[i+1])
		}
		require.NoError(t, tx.QueryRow(ctx,
			`INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date`+cols+`)
			 VALUES ($1, $2, $3, 'IT', true, $4::numeric, $5::timestamptz`+placeholders(len(extra)/2, 6)+`) RETURNING id`,
			args...).Scan(&id))
		return id
	}

	t.Run("cuenta en la moneda base: tasa 1", func(t *testing.T) {
		id := insert(f.cop, "12500.50", "1995-06-19 10:00:00-05")
		assert.Equal(t, txRow{"COP", ptr("1.000000000000"), ptr("identity"), ptr("12500.5000")}, readTx(t, ctx, tx, id))
	})

	t.Run("USD a COP en festivo usa la TRM del viernes", func(t *testing.T) {
		id := insert(f.usd, "10.25", "1995-06-19 10:00:00-05")
		assert.Equal(t, txRow{"USD", ptr("4000.000000000000"), ptr("SFC_TRM"), ptr("41000.0000")}, readTx(t, ctx, tx, id))
	})

	t.Run("EUR a COP cruza vía USD y guarda las dos fuentes", func(t *testing.T) {
		id := insert(f.eur, "8", "1995-06-19 10:00:00-05")
		assert.Equal(t, txRow{"EUR", ptr("5000.000000000000"), ptr("ECB+SFC_TRM"), ptr("40000.0000")}, readTx(t, ctx, tx, id))
	})

	t.Run("la moneda la impone la cuenta", func(t *testing.T) {
		id := insert(f.cop, "100", "1995-06-19 10:00:00-05", "currency", "EUR")
		assert.Equal(t, "COP", readTx(t, ctx, tx, id).Currency)
	})

	t.Run("tasa dada por el usuario", func(t *testing.T) {
		id := insert(f.usd, "10", "1995-06-19 10:00:00-05", "fx_rate", "3900")
		assert.Equal(t, txRow{"USD", ptr("3900.000000000000"), ptr("user"), ptr("39000.0000")}, readTx(t, ctx, tx, id))
	})

	t.Run("sin tasa no bloquea el insert y fill_pending_fx la completa", func(t *testing.T) {
		id := insert(f.usd, "3", "1990-01-02 10:00:00-05")
		assert.Equal(t, txRow{"USD", nil, nil, nil}, readTx(t, ctx, tx, id))
		assert.Equal(t, 1, missingBase(t, ctx, tx, f.userID))

		var filled int
		require.NoError(t, tx.QueryRow(ctx, "SELECT fill_pending_fx()").Scan(&filled))
		assert.Equal(t, 0, filled, "todavía no hay tasa")

		_, err := tx.Exec(ctx, "INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('COP', '1990-01-01', 1000, 'SFC_TRM')")
		require.NoError(t, err)
		require.NoError(t, tx.QueryRow(ctx, "SELECT fill_pending_fx()").Scan(&filled))
		assert.GreaterOrEqual(t, filled, 1)
		assert.Equal(t, txRow{"USD", ptr("1000.000000000000"), ptr("SFC_TRM"), ptr("3000.0000")}, readTx(t, ctx, tx, id))
		assert.Equal(t, 0, missingBase(t, ctx, tx, f.userID))
	})

	t.Run("editar monto y fecha conserva la tasa; cambiar de moneda la recalcula", func(t *testing.T) {
		id := insert(f.usd, "10", "1995-06-19 10:00:00-05")
		exec(t, ctx, tx, "UPDATE transactions SET amount = 20 WHERE id = $1", id)
		assert.Equal(t, txRow{"USD", ptr("4000.000000000000"), ptr("SFC_TRM"), ptr("80000.0000")}, readTx(t, ctx, tx, id))

		exec(t, ctx, tx, "UPDATE transactions SET date = '1990-01-05 10:00:00-05' WHERE id = $1", id)
		assert.Equal(t, ptr("4000.000000000000"), readTx(t, ctx, tx, id).FxRate, "la tasa es inmutable al editar la fecha")

		exec(t, ctx, tx, "UPDATE transactions SET account_id = $2, date = '1995-06-19 10:00:00-05' WHERE id = $1", id, f.eur)
		assert.Equal(t, txRow{"EUR", ptr("5000.000000000000"), ptr("ECB+SFC_TRM"), ptr("100000.0000")}, readTx(t, ctx, tx, id))

		exec(t, ctx, tx, "UPDATE transactions SET fx_rate = 4500, fx_rate_source = 'user' WHERE id = $1", id)
		assert.Equal(t, txRow{"EUR", ptr("4500.000000000000"), ptr("user"), ptr("90000.0000")}, readTx(t, ctx, tx, id))
	})

	t.Run("los totales diarios siguen a transactions", func(t *testing.T) {
		assertNoDrift(t, ctx, tx, f.userID)

		id := insert(f.cop, "1000", "1995-06-20 23:30:00-05") // 21 de junio en UTC, 20 en Bogotá
		var day string
		require.NoError(t, tx.QueryRow(ctx,
			"SELECT day::text FROM daily_account_totals WHERE account_id = $1 AND day >= '1995-06-20' ORDER BY day DESC LIMIT 1", f.cop).Scan(&day))
		assert.Equal(t, "1995-06-20", day, "el día es el local del usuario")

		exec(t, ctx, tx, "UPDATE transactions SET checked = false, description = 'otra' WHERE id = $1", id)
		exec(t, ctx, tx, "UPDATE transactions SET category_id = $2, expense = false WHERE id = $1", id, f.incomeCat)
		assertNoDrift(t, ctx, tx, f.userID)

		exec(t, ctx, tx, "DELETE FROM transactions WHERE id = $1", id)
		var rows int
		require.NoError(t, tx.QueryRow(ctx,
			"SELECT count(*) FROM daily_account_totals WHERE account_id = $1 AND day = '1995-06-20'", f.cop).Scan(&rows))
		assert.Zero(t, rows, "sin transacciones no queda fila")
		assertNoDrift(t, ctx, tx, f.userID)

		// cambiar la zona horaria mueve los días: se recalcula el usuario
		exec(t, ctx, tx, "UPDATE user_extra SET utc_offset = 'Asia/Tokyo' WHERE user_id = $1", f.userID)
		assertNoDrift(t, ctx, tx, f.userID)

		// si algo se descuadra, la reconciliación lo arregla
		exec(t, ctx, tx, "UPDATE daily_account_totals SET inflow = inflow + 1 WHERE user_id = $1", f.userID)
		var fixed []string
		rowsFixed, err := tx.Query(ctx, "SELECT user_id FROM reconcile_daily_account_totals()")
		require.NoError(t, err)
		for rowsFixed.Next() {
			var u string
			require.NoError(t, rowsFixed.Scan(&u))
			fixed = append(fixed, u)
		}
		require.NoError(t, rowsFixed.Err())
		assert.Contains(t, fixed, f.userID)
		assertNoDrift(t, ctx, tx, f.userID)
	})
}

// TestMulticurrencyReports: los flujos suman amount_base y los saldos agregados valen
// saldo nativo × tasa de cada día; los saldos por cuenta quedan en su moneda.
func TestMulticurrencyReports(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	tx, err := db.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(ctx) })
	f := newMulticurrencyFixture(t, ctx, tx)

	// 100 USD de ingreso el 20 (4000) y 50.000 COP de gasto el 21 (4100)
	exec(t, ctx, tx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date) VALUES
		($1, $2, $3, 'sueldo', false, 100, '2026-10-20 12:00:00-05'),
		($1, $4, $5, 'mercado', true, 50000, '2026-10-21 12:00:00-05')`,
		f.userID, f.incomeCat, f.usd, f.expenseCat, f.cop)

	type day struct {
		Income, Expense, RunningSavings string
	}
	read := func(date string) day {
		t.Helper()
		var d day
		require.NoError(t, tx.QueryRow(ctx,
			"SELECT income::numeric(20,2)::text, expense::numeric(20,2)::text, running_savings_balance::numeric(20,2)::text FROM analysis_daily($1) WHERE date = $2::date",
			f.userID, date).Scan(&d.Income, &d.Expense, &d.RunningSavings))
		return d
	}
	assert.Equal(t, day{"400000.00", "0.00", "400000.00"}, read("2026-10-20"))
	// el USD se revalúa con la tasa del 21: 100 × 4100 − 50.000
	assert.Equal(t, day{"0.00", "-50000.00", "360000.00"}, read("2026-10-21"))

	var nativeUSD string
	require.NoError(t, tx.QueryRow(ctx,
		"SELECT balance::numeric(20,2)::text FROM analysis_monthly_accounts($1) WHERE account_id = $2 AND year = 2026 AND month = 10",
		f.userID, f.usd).Scan(&nativeUSD))
	assert.Equal(t, "100.00", nativeUSD, "el saldo por cuenta queda en la moneda de la cuenta")
}

// TestInitialBalanceCountsOnce: el saldo inicial cuenta una sola vez aunque haya varias
// transacciones el día en que se creó la cuenta (las vistas viejas lo multiplicaban; 000025).
func TestInitialBalanceCountsOnce(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	tx, err := db.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(ctx) })
	f := newMulticurrencyFixture(t, ctx, tx)

	exec(t, ctx, tx, "UPDATE accounts SET created_at = '2026-10-20 08:00:00-05' WHERE user_id = $1", f.userID)
	exec(t, ctx, tx, "UPDATE accounts SET initial_balance = 1000 WHERE id = $1", f.cop)
	exec(t, ctx, tx, "UPDATE accounts SET initial_balance = -10 WHERE id = $1", f.usdCard) // deuda de 10 USD
	// tres transacciones del usuario el día de creación, dos de ellas en la cuenta COP
	exec(t, ctx, tx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date) VALUES
		($1, $2, $3, 'a', true, 100, '2026-10-20 12:00:00-05'),
		($1, $2, $3, 'b', true, 50, '2026-10-20 13:00:00-05'),
		($1, $2, $4, 'c', true, 1, '2026-10-20 14:00:00-05')`,
		f.userID, f.expenseCat, f.cop, f.usd)

	var copBalance string
	require.NoError(t, tx.QueryRow(ctx,
		"SELECT balance::numeric(20,2)::text FROM analysis_monthly_accounts($1) WHERE account_id = $2 AND year = 2026 AND month = 10",
		f.userID, f.cop).Scan(&copBalance))
	assert.Equal(t, "850.00", copBalance, "1000 − 100 − 50, sin repetir el saldo inicial")

	var credits string
	require.NoError(t, tx.QueryRow(ctx,
		"SELECT running_credits_balance::numeric(20,2)::text FROM analysis_daily($1) WHERE date = '2026-10-20'",
		f.userID).Scan(&credits))
	assert.Equal(t, "-40000.00", credits, "−10 USD × 4000, una sola vez")
}

func exec(t *testing.T, ctx context.Context, tx pgx.Tx, sql string, args ...any) {
	t.Helper()
	_, err := tx.Exec(ctx, sql, args...)
	require.NoError(t, err)
}

func missingBase(t *testing.T, ctx context.Context, tx pgx.Tx, userID string) int {
	t.Helper()
	var n int
	require.NoError(t, tx.QueryRow(ctx,
		"SELECT coalesce(sum(missing_base_count), 0) FROM daily_account_totals WHERE user_id = $1", userID).Scan(&n))
	return n
}

func assertNoDrift(t *testing.T, ctx context.Context, tx pgx.Tx, userID string) {
	t.Helper()
	var drift bool
	require.NoError(t, tx.QueryRow(ctx,
		"SELECT EXISTS (SELECT 1 FROM daily_account_totals_drift() d WHERE d.user_id = $1)", userID).Scan(&drift))
	assert.False(t, drift, "daily_account_totals no cuadra con transactions")
}

// placeholders devuelve ", $from, $from+1, ..." para n argumentos extra.
func placeholders(n, from int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += ", $" + strconv.Itoa(from+i)
	}
	return out
}
