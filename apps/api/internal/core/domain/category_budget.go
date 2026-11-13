package domain

import (
	"fmt"
	"time"
)

// BudgetMonthLayout is the wire format of a budget month ("2026-11")
const BudgetMonthLayout = "2006-01"

// BudgetBaseMonth marks the versions that apply "since always": the budgets that existed before the history
// (migration 000044). The UI shows it as "Desde el inicio".
var BudgetBaseMonth = time.Date(2000, time.January, 1, 0, 0, 0, 0, time.UTC)

// CategoryBudget is a version of a category budget: it applies from EffectiveFrom (day 1 of a month) until the
// month before the next version. categories.budget is the latest version.
type CategoryBudget struct {
	CategoryID    uint64
	UserID        string
	Budget        float64
	EffectiveFrom time.Time
	UpdatedAt     time.Time
}

// MonthStart is day 1 of the month of t, at midnight UTC (budget months are dates, without time zone)
func MonthStart(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// ParseBudgetMonth parses "YYYY-MM" into day 1 of that month
func ParseBudgetMonth(s string) (time.Time, error) {
	t, err := time.Parse(BudgetMonthLayout, s)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid budget month %q, expected YYYY-MM", s)
	}
	return MonthStart(t), nil
}

// ValidateBudgetMonth: a version starts between BudgetBaseMonth and the user's current month (no future budgets)
func ValidateBudgetMonth(month, currentMonth time.Time) error {
	m := MonthStart(month)
	if m.Before(BudgetBaseMonth) || m.After(MonthStart(currentMonth)) {
		return ErrBudgetMonthOutOfRange
	}
	return nil
}

// IsBaseBudget reports whether the version is the oldest of the list (sorted from the newest to the oldest)
func IsBaseBudget(versions []CategoryBudget, month time.Time) bool {
	return len(versions) > 0 && versions[len(versions)-1].EffectiveFrom.Equal(MonthStart(month))
}

// FindBudget returns the version that starts in month, if any
func FindBudget(versions []CategoryBudget, month time.Time) (CategoryBudget, bool) {
	m := MonthStart(month)
	for _, v := range versions {
		if v.EffectiveFrom.Equal(m) {
			return v, true
		}
	}
	return CategoryBudget{}, false
}
