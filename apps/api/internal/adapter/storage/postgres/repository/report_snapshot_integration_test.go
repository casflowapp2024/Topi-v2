//go:build integration

package repository_test

import (
	"bufio"
	"cash-flow/internal/adapter/storage/postgres/repository"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/service"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestReportSnapshot escribe, por usuario, lo que devuelven los servicios de análisis (los mismos
// que llaman los handlers) para cada mes con datos. Sirve para comparar ANTES y DESPUÉS de una
// migración que cambia cómo se calculan los reportes:
//
//	REPORT_SNAPSHOT_OUT=antes.jsonl  go test -tags integration -run TestReportSnapshot ./internal/adapter/storage/postgres/repository/
//	(migrar)
//	REPORT_SNAPSHOT_OUT=despues.jsonl go test ...   →   diff antes.jsonl despues.jsonl
//
// Antes de la versión 24 hay que refrescar las vistas materializadas para comparar contra datos al día.
// No escribe datos; la salida tiene montos de usuarios: guárdala fuera del repo.
func TestReportSnapshot(t *testing.T) {
	out := os.Getenv("REPORT_SNAPSHOT_OUT")
	if out == "" {
		t.Skip("REPORT_SNAPSHOT_OUT not set")
	}
	ctx := context.Background()
	db := integrationDB(t)
	svc := service.NewAnalysisService(repository.NewAnalysisRepository(db))

	file, err := os.Create(out)
	require.NoError(t, err)
	defer file.Close()
	w := bufio.NewWriter(file)
	defer w.Flush()

	emit := func(key string, value any, err error) {
		if err != nil {
			value = map[string]string{"error": err.Error()}
		}
		data, mErr := json.Marshal(value)
		require.NoError(t, mErr)
		_, _ = fmt.Fprintf(w, "%s\t%s\n", key, data)
	}

	type account struct {
		id     uint64
		typeID uint64
	}
	var first, last time.Time
	require.NoError(t, db.QueryRow(ctx,
		"SELECT date_trunc('month', min(date))::date, date_trunc('month', now())::date + interval '1 month' FROM transactions").
		Scan(&first, &last))

	var users []string
	rows, err := db.Query(ctx, "SELECT DISTINCT user_id FROM accounts ORDER BY 1")
	require.NoError(t, err)
	for rows.Next() {
		var userID string
		require.NoError(t, rows.Scan(&userID))
		users = append(users, userID)
	}
	require.NoError(t, rows.Err())

	for _, userID := range users {
		var accounts []account
		rows, err := db.Query(ctx, "SELECT id, type_id FROM accounts WHERE user_id = $1 ORDER BY id", userID)
		require.NoError(t, err)
		for rows.Next() {
			var a account
			require.NoError(t, rows.Scan(&a.id, &a.typeID))
			accounts = append(accounts, a)
		}
		require.NoError(t, rows.Err())
		var categories []uint64
		rows, err = db.Query(ctx, "SELECT id FROM categories WHERE user_id = $1 ORDER BY id", userID)
		require.NoError(t, err)
		for rows.Next() {
			var id uint64
			require.NoError(t, rows.Scan(&id))
			categories = append(categories, id)
		}
		require.NoError(t, rows.Err())

		for _, filter := range []string{"all", "savings"} {
			v, err := svc.GetAccountsBalance(ctx, userID, filter)
			emit(fmt.Sprintf("%s|accounts-balance|%s", userID, filter), v, err)
		}

		for month := first; !month.After(last); month = month.AddDate(0, 1, 0) {
			ym := month.Format("2006-01")
			key := func(name string) string { return fmt.Sprintf("%s|%s|%s", userID, name, ym) }

			fr, err := svc.GetFinancialReport(ctx, userID, month)
			emit(key("financial-report"), fr, err)

			cr, err := svc.GetCategoriesReport(ctx, userID, month, nil)
			emit(key("categories-report"), cr, err)

			fa, err := svc.GetFinancialAnalysis(ctx, userID, ym)
			fa.Daily.UpdatedAt, fa.Monthly.UpdatedAt = time.Time{}, time.Time{}
			emit(key("financial-analysis"), fa, err)

			for _, a := range accounts {
				aa, err := svc.GetAccountAnalysis(ctx, userID, a.id, ym)
				emit(key(fmt.Sprintf("account-analysis:%d", a.id)), aa, err)

				for _, accountsType := range []string{"savings", "credits", "investments"} {
					report := domain.AccountsReport{UserID: userID, Start: month, End: month.AddDate(0, 1, 0),
						Accounts: []int64{int64(a.id)}, AccountsType: accountsType}
					err := svc.GetAccountsReport(ctx, &report)
					emit(key(fmt.Sprintf("accounts-report:%d:%s", a.id, accountsType)), report, err)
				}
			}

			for _, categoryID := range categories {
				ca, err := svc.GetCategoryAnalysis(ctx, userID, categoryID, ym)
				emit(key(fmt.Sprintf("category-analysis:%d", categoryID)), ca, err)
			}
		}
	}
}
