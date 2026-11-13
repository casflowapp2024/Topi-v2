package repository

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// syncCategoryBudget leaves categories.budget equal to the latest version (there are no future versions, so the
// latest is the one of the current month). The trigger categories_budget_version sees the same value and adds
// nothing.
const syncCategoryBudget = `
	UPDATE categories c
	SET budget = coalesce(budget_at(c.id, user_current_month(c.user_id)), 0), updated_at = now()
	WHERE c.id = $1 AND c.user_id = $2
	  AND c.budget IS DISTINCT FROM coalesce(budget_at(c.id, user_current_month(c.user_id)), 0)`

func (cr CategoryRepository) CurrentBudgetMonth(ctx context.Context, userID string) (time.Time, error) {
	var month time.Time
	if err := cr.db.QueryRow(ctx, "SELECT user_current_month($1)", userID).Scan(&month); err != nil {
		return time.Time{}, mappers.MapPostgresErrorCode(err)
	}
	return domain.MonthStart(month), nil
}

func (cr CategoryRepository) ListCategoryBudgets(ctx context.Context, userID string, categoryID uint64) ([]domain.CategoryBudget, error) {
	rows, err := cr.db.Query(ctx, `
		SELECT category_id, user_id, budget, effective_from, updated_at
		FROM category_budgets
		WHERE category_id = $1 AND user_id = $2
		ORDER BY effective_from DESC`, categoryID, userID)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()

	versions := []domain.CategoryBudget{}
	for rows.Next() {
		var v domain.CategoryBudget
		if err = rows.Scan(&v.CategoryID, &v.UserID, &v.Budget, &v.EffectiveFrom, &v.UpdatedAt); err != nil {
			return nil, err
		}
		v.EffectiveFrom = domain.MonthStart(v.EffectiveFrom)
		versions = append(versions, v)
	}
	return versions, rows.Err()
}

func (cr CategoryRepository) UpsertCategoryBudget(ctx context.Context, budget domain.CategoryBudget) error {
	return cr.inBudgetTx(ctx, budget.CategoryID, budget.UserID, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO category_budgets (category_id, user_id, budget, effective_from)
			VALUES ($1, $2, $3, $4::date)
			ON CONFLICT (category_id, effective_from) DO UPDATE SET budget = EXCLUDED.budget, updated_at = now()`,
			budget.CategoryID, budget.UserID, budget.Budget, domain.MonthStart(budget.EffectiveFrom).Format(time.DateOnly))
		return err
	})
}

func (cr CategoryRepository) DeleteCategoryBudget(ctx context.Context, userID string, categoryID uint64, month time.Time) error {
	return cr.inBudgetTx(ctx, categoryID, userID, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			DELETE FROM category_budgets WHERE category_id = $1 AND user_id = $2 AND effective_from = $3::date`,
			categoryID, userID, domain.MonthStart(month).Format(time.DateOnly))
		if err == nil && tag.RowsAffected() == 0 {
			return domain.ErrDataNotFound
		}
		return err
	})
}

// inBudgetTx runs change and the sync of categories.budget in one transaction
func (cr CategoryRepository) inBudgetTx(ctx context.Context, categoryID uint64, userID string, change func(pgx.Tx) error) error {
	tx, err := cr.db.Begin(ctx)
	if err != nil {
		return domain.ErrBeginTrx
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err = change(tx); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if _, err = tx.Exec(ctx, syncCategoryBudget, categoryID, userID); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return nil
}
