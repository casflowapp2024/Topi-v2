//go:build integration

package repository_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFxRateAt prueba fx_rate_at (migración 000023) dentro de una transacción que se revierte.
// Las tasas van en 1995 para no mezclarse con las reales (que empiezan años después): el
// fallback "última fecha <= p_date" nunca alcanza datos posteriores a la fecha pedida.
func TestFxRateAt(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)

	tx, err := db.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(ctx) })

	_, err = tx.Exec(ctx, `
		INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES
		  ('COP', '1995-06-16', 4000,   'SFC_TRM'),  -- viernes antes del festivo del lunes 19
		  ('COP', '1995-06-20', 4100,   'SFC_TRM'),
		  ('EUR', '1995-06-16', 0.9,    'ECB'),
		  ('GBP', '1995-06-16', 0.8,    'ECB'),
		  ('GBP', '1995-06-16', 0.75,   'manual'),   -- mismo día: manual gana
		  ('MXN', '1995-06-16', 20,     'manual'),
		  ('MXN', '1995-06-16', 19,     'SFC_TRM'),
		  ('MXN', '1995-06-16', 18,     'ECB'),
		  ('BRL', '1995-06-01', 5,      'manual'),
		  ('BRL', '1995-06-16', 5.5,    'ECB')        -- fecha más reciente gana sobre manual viejo
	`)
	require.NoError(t, err)

	rate := func(t *testing.T, from, to, date string) *string {
		t.Helper()
		var out *string
		require.NoError(t, tx.QueryRow(ctx, "SELECT fx_rate_at($1, $2, $3::date)::text", from, to, date).Scan(&out))
		return out
	}
	str := func(s string) *string { return &s }

	cases := []struct {
		name, from, to, date string
		want                 *string
	}{
		{"mismo par sin datos", "COP", "COP", "1980-01-01", str("1")},
		{"mismo par USD", "USD", "USD", "1995-06-16", str("1")},
		{"mismo par en minúsculas", "cop", "COP", "1995-06-16", str("1")},
		{"directo USD a COP", "USD", "COP", "1995-06-16", str("4000.000000000000")},
		{"invertido COP a USD", "COP", "USD", "1995-06-16", str("0.000250000000")},
		{"cruce EUR a COP", "EUR", "COP", "1995-06-16", str("4444.444444444444")},
		{"cruce COP a EUR", "COP", "EUR", "1995-06-16", str("0.000225000000")},
		{"festivo usa el viernes", "USD", "COP", "1995-06-19", str("4000.000000000000")},
		{"fin de semana usa el viernes", "USD", "COP", "1995-06-17", str("4000.000000000000")},
		{"día hábil siguiente usa su tasa", "USD", "COP", "1995-06-20", str("4100.000000000000")},
		{"fecha sin datos anteriores", "USD", "COP", "1995-01-01", nil},
		{"falta una pata del cruce", "EUR", "COP", "1995-06-10", nil},
		{"moneda sin tasas", "USD", "CAD", "1995-06-16", nil},
		{"prioridad manual sobre ECB", "USD", "GBP", "1995-06-16", str("0.750000000000")},
		{"prioridad manual sobre SFC_TRM y ECB", "USD", "MXN", "1995-06-16", str("20.000000000000")},
		{"fecha más reciente gana a la prioridad", "USD", "BRL", "1995-06-16", str("5.500000000000")},
		{"manual viejo aplica antes de la fecha nueva", "USD", "BRL", "1995-06-10", str("5.000000000000")},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, rate(t, tc.from, tc.to, tc.date))
		})
	}

	t.Run("sin manual gana SFC_TRM sobre ECB", func(t *testing.T) {
		_, err := tx.Exec(ctx, "DELETE FROM fx_rates WHERE quote = 'MXN' AND source = 'manual' AND rate_date = '1995-06-16'")
		require.NoError(t, err)
		assert.Equal(t, str("19.000000000000"), rate(t, "USD", "MXN", "1995-06-16"))
	})

	t.Run("restricciones de la tabla", func(t *testing.T) {
		for _, bad := range []string{
			"INSERT INTO fx_rates (base, quote, rate_date, rate, source) VALUES ('EUR', 'COP', '1995-06-16', 1, 'x')",
			"INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('USD', '1995-06-16', 1, 'x')",
			"INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('XXX', '1995-06-16', 1, 'x')",
			"INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('COP', '1995-06-16', 0, 'x')",
		} {
			assertFailsInSavepoint(t, ctx, tx, bad)
		}
	})
}

// assertFailsInSavepoint ejecuta stmt en un savepoint (para no abortar la transacción del test)
// y exige que falle.
func assertFailsInSavepoint(t *testing.T, ctx context.Context, tx pgx.Tx, stmt string) {
	t.Helper()
	sp, err := tx.Begin(ctx)
	require.NoError(t, err)
	_, err = sp.Exec(ctx, stmt)
	assert.Error(t, err, stmt)
	require.NoError(t, sp.Rollback(ctx))
}
