//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCategoryBudgetHistory: los presupuestos tienen versiones por mes (plan/26-presupuestos-historicos.md) y los
// reportes de meses pasados usan el presupuesto que tenían, no el vigente. Fechas relativas al mes en curso.
func TestCategoryBudgetHistory(t *testing.T) {
	ctx := context.Background()
	db := integrationDB(t)
	userID := "it-cb-" + uuid.NewString()
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
		for _, table := range []string{"accounts", "categories", "banks", "user_extra"} {
			_, _ = db.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID)
		}
	})
	_, err := db.Exec(ctx, "INSERT INTO user_extra (user_id, utc_offset, whatsapp) VALUES ($1, 'America/Bogota', '')", userID)
	require.NoError(t, err)

	categories := repository.NewCategoryRepository(db)
	current, err := categories.CurrentBudgetMonth(ctx, userID)
	require.NoError(t, err)
	past := current.AddDate(0, -3, 0) // el mes del gasto "viejo"
	early := current.AddDate(0, -6, 0)

	// crear la categoría deja la versión del mes en curso (trigger)
	food := &domain.Category{UserID: userID, Name: "Comida IT", Budget: 800, Emoji: ""}
	require.NoError(t, categories.CreateCategory(ctx, food))
	salary := &domain.Category{UserID: userID, Name: "Sueldo IT", Budget: 3000, Emoji: "", Income: true}
	require.NoError(t, categories.CreateCategory(ctx, salary))
	versions, err := categories.ListCategoryBudgets(ctx, userID, food.ID)
	require.NoError(t, err)
	require.Len(t, versions, 1)
	assert.Equal(t, current, versions[0].EffectiveFrom)
	assert.InDelta(t, 800, versions[0].Budget, 0.001)

	// un mes pasado no cambia el presupuesto vigente
	require.NoError(t, categories.UpsertCategoryBudget(ctx, domain.CategoryBudget{
		CategoryID: food.ID, UserID: userID, Budget: 500, EffectiveFrom: early}))
	require.NoError(t, categories.UpsertCategoryBudget(ctx, domain.CategoryBudget{
		CategoryID: salary.ID, UserID: userID, Budget: 2000, EffectiveFrom: early}))
	got, err := categories.GetCategory(ctx, userID, food.ID)
	require.NoError(t, err)
	assert.InDelta(t, 800, got.Budget, 0.001)

	// el PUT de siempre cambia el mes en curso y no crea otra versión en el mismo mes
	got.Budget = 1000
	require.NoError(t, categories.UpdateCategory(ctx, got))
	got.Budget = 1200
	require.NoError(t, categories.UpdateCategory(ctx, got))
	versions, err = categories.ListCategoryBudgets(ctx, userID, food.ID)
	require.NoError(t, err)
	require.Len(t, versions, 2)
	assert.InDelta(t, 1200, versions[0].Budget, 0.001)
	assert.Equal(t, early, versions[1].EffectiveFrom)

	// borrar la versión del mes en curso devuelve la anterior como vigente
	require.NoError(t, categories.DeleteCategoryBudget(ctx, userID, food.ID, current))
	got, err = categories.GetCategory(ctx, userID, food.ID)
	require.NoError(t, err)
	assert.InDelta(t, 500, got.Budget, 0.001)
	assert.ErrorIs(t, categories.DeleteCategoryBudget(ctx, userID, food.ID, current), domain.ErrDataNotFound)
	require.NoError(t, categories.UpsertCategoryBudget(ctx, domain.CategoryBudget{
		CategoryID: food.ID, UserID: userID, Budget: 1200, EffectiveFrom: current}))
	got, err = categories.GetCategory(ctx, userID, food.ID)
	require.NoError(t, err)
	assert.InDelta(t, 1200, got.Budget, 0.001)

	// movimientos en el mes viejo y en el actual
	var bank, account uint64
	require.NoError(t, db.QueryRow(ctx, "INSERT INTO banks (user_id, name, email) VALUES ($1, 'Banco IT', 'it@banco.test') RETURNING id", userID).Scan(&bank))
	require.NoError(t, db.QueryRow(ctx, `INSERT INTO accounts (user_id, name, last_four_digits, bank_id, type_id, initial_balance, currency, created_at)
		VALUES ($1, 'Ahorros IT', '0001', $2, 1, 0, 'COP', $3) RETURNING id`, userID, bank, early).Scan(&account))
	tx := func(category uint64, expense bool, amount float64, day string) {
		_, err := db.Exec(ctx, `INSERT INTO transactions (user_id, category_id, account_id, description, expense, amount, date)
			VALUES ($1, $2, $3, 'IT', $4, $5, $6::timestamptz)`, userID, category, account, expense, amount, day+" 12:00:00-05")
		require.NoError(t, err)
	}
	day := func(month time.Time) string { return month.Format("2006-01") + "-10" }
	tx(food.ID, true, 400, day(past))
	tx(salary.ID, false, 2500, day(past))
	tx(food.ID, true, 300, day(current))

	analysis := repository.NewAnalysisRepository(db)
	budgetOf := func(month time.Time) float64 {
		report, err := analysis.GetCategoriesReport(ctx, userID, month)
		require.NoError(t, err)
		for _, m := range report.Expenses.Report {
			if m.CategoryID == food.ID {
				return m.Budget
			}
		}
		t.Fatalf("no está la categoría en el reporte de %s", month.Format("2006-01"))
		return 0
	}
	assert.InDelta(t, -500, budgetOf(past), 0.001, "el mes viejo usa la versión que tenía (gastos en negativo)")
	assert.InDelta(t, -1200, budgetOf(current), 0.001)

	history, err := analysis.GetCategoryAnalysis(ctx, userID, food.ID, early, current.AddDate(0, 1, 0))
	require.NoError(t, err)
	require.Len(t, history.Monthly, 2)
	assert.Equal(t, []float64{500, 1200}, history.MonthlyBudget)
	assert.InDelta(t, 1200, history.Budget, 0.001, "el presupuesto del análisis es el del último mes")

	fr := &domain.FinancialResolver{UserID: userID, Start: early, End: current.AddDate(0, 1, -1),
		Rsp: &domain.FinancialAnalysis{}, Mu: &sync.Mutex{}, Wg: &sync.WaitGroup{}}
	fr.Wg.Add(1)
	analysis.GetMonthlyAnalysis(ctx, fr)
	require.NoError(t, fr.MonthlyErr)
	monthly := fr.Rsp.Monthly
	idx := func(month time.Time) int {
		for i := range monthly.Year {
			if fmt.Sprintf("%04d-%02d", monthly.Year[i], monthly.Month[i]) == month.Format("2006-01") {
				return i
			}
		}
		t.Fatalf("falta el mes %s en el análisis mensual", month.Format("2006-01"))
		return -1
	}
	p, c := idx(past), idx(current)
	assert.InDelta(t, 500, monthly.ExpenseBudget[p], 0.001)
	assert.InDelta(t, 2000, monthly.IncomeBudget[p], 0.001)
	assert.InDelta(t, 1500, monthly.SavingsBudget[p], 0.001, "el ahorro presupuestado del mes viejo es el de ese mes")
	assert.InDelta(t, 1200, monthly.ExpenseBudget[c], 0.001)
	assert.InDelta(t, 3000, monthly.IncomeBudget[c], 0.001)
	assert.InDelta(t, 1800, fr.Rsp.SavingsBudget, 0.001, "los totales de arriba son los del último mes")
}
