package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func month(y int, m time.Month) time.Time { return time.Date(y, m, 1, 0, 0, 0, 0, time.UTC) }

func TestParseBudgetMonth(t *testing.T) {
	got, err := ParseBudgetMonth("2026-06")
	assert.NoError(t, err)
	assert.Equal(t, month(2026, time.June), got)

	for _, bad := range []string{"", "2026-13", "2026/06", "2026-06-01", "junio"} {
		_, err = ParseBudgetMonth(bad)
		assert.Error(t, err, bad)
	}
}

func TestValidateBudgetMonth(t *testing.T) {
	current := month(2026, time.November)
	assert.NoError(t, ValidateBudgetMonth(current, current))
	assert.NoError(t, ValidateBudgetMonth(month(2026, time.June), current))
	assert.NoError(t, ValidateBudgetMonth(BudgetBaseMonth, current))
	// any day of the month counts as the month
	assert.NoError(t, ValidateBudgetMonth(time.Date(2026, time.November, 30, 23, 0, 0, 0, time.UTC), current))

	assert.ErrorIs(t, ValidateBudgetMonth(month(2026, time.December), current), ErrBudgetMonthOutOfRange)
	assert.ErrorIs(t, ValidateBudgetMonth(month(1999, time.December), current), ErrBudgetMonthOutOfRange)
}

func TestFindAndBaseBudget(t *testing.T) {
	versions := []CategoryBudget{
		{Budget: 1000, EffectiveFrom: month(2026, time.November)},
		{Budget: 900, EffectiveFrom: month(2026, time.June)},
		{Budget: 800, EffectiveFrom: BudgetBaseMonth},
	}

	v, ok := FindBudget(versions, month(2026, time.June))
	assert.True(t, ok)
	assert.Equal(t, 900.0, v.Budget)
	_, ok = FindBudget(versions, month(2026, time.July))
	assert.False(t, ok)

	assert.True(t, IsBaseBudget(versions, BudgetBaseMonth))
	assert.False(t, IsBaseBudget(versions, month(2026, time.June)))
	assert.False(t, IsBaseBudget(nil, BudgetBaseMonth))
}
