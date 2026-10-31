package domain

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

func TestOverpaidTotal(t *testing.T) {
	d := func(s string) decimal.Decimal { return decimal.RequireFromString(s) }
	cycles := []CreditCardCycle{
		{Purchases: d("1884408"), Payments: d("1844908.30"), Counted: true},
		{Purchases: d("1000000"), Payments: d("1100000"), Counted: true},
		{Purchases: d("500000"), Payments: d("0"), Counted: false}, // last statement, not paid yet
	}
	assert.Equal(t, "60500.3", OverpaidTotal(cycles).String())
	assert.True(t, OverpaidTotal(nil).IsZero())
}

func TestAccountTypes_IsCredit(t *testing.T) {
	credit, mixed, none := AccountTypes{4}, AccountTypes{1, 4}, AccountTypes{}
	assert.True(t, credit.IsCredit())
	assert.False(t, mixed.IsCredit())
	assert.False(t, none.IsCredit())
}
