package domain

import (
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

func TestAccountValuation_Validate(t *testing.T) {
	now := time.Date(2026, 10, 28, 15, 0, 0, 0, time.UTC)
	valid := func() AccountValuation {
		return AccountValuation{AccountID: 3, Date: time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC), Value: decimal.NewFromInt(100)}
	}
	v := valid()
	assert.NoError(t, v.Validate(now))

	cases := map[string]func(*AccountValuation){
		"sin cuenta":     func(v *AccountValuation) { v.AccountID = 0 },
		"sin fecha":      func(v *AccountValuation) { v.Date = time.Time{} },
		"valor negativo": func(v *AccountValuation) { v.Value = decimal.NewFromInt(-1) },
		"pasado mañana":  func(v *AccountValuation) { v.Date = v.Date.AddDate(0, 0, 2) },
		"nota muy larga": func(v *AccountValuation) { v.Note = strings.Repeat("x", MaxValuationNoteLength+1) },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			v := valid()
			mutate(&v)
			assert.ErrorIs(t, v.Validate(now), ErrInvalidValuation)
		})
	}

	t.Run("mañana en UTC sí: ya es hoy en zonas adelantadas", func(t *testing.T) {
		v := valid()
		v.Date = v.Date.AddDate(0, 0, 1)
		assert.NoError(t, v.Validate(now))
	})
	t.Run("cero es válido", func(t *testing.T) {
		v := valid()
		v.Value = decimal.Zero
		assert.NoError(t, v.Validate(now))
	})
}

func TestInvestmentPerformance_GainPercent(t *testing.T) {
	d := decimal.RequireFromString
	p := InvestmentPerformance{ValueStart: d("1050000"), Contributions: d("500000"), Gain: d("50000")}
	assert.Equal(t, "3.23", p.GainPercent().String())
	assert.Nil(t, InvestmentPerformance{Gain: d("10")}.GainPercent(), "sin capital no hay porcentaje")
}

func TestAccountClassOf(t *testing.T) {
	assert.Equal(t, AccountClassDeposit, AccountClassOf(1))
	assert.Equal(t, AccountClassDeposit, AccountClassOf(2))
	assert.Equal(t, AccountClassInvestment, AccountClassOf(3))
	assert.Equal(t, AccountClassCredit, AccountClassOf(4))
	assert.Equal(t, AccountClassCredit, AccountType{ID: 1, Class: AccountClassCredit}.ClassOrDefault(), "manda la de la base")
	assert.True(t, IsAccountClass("investment"))
	assert.False(t, IsAccountClass("savings"))
}
