package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func criteria(r LaunchReport) map[string]*bool {
	r.EvaluateLaunch()
	out := map[string]*bool{}
	for _, c := range r.Criteria {
		out[c.Stage+" "+c.Label] = c.OK
	}
	return out
}

func weeks(values ...float64) []DayValue {
	out := make([]DayValue, len(values))
	for i, v := range values {
		out[i] = DayValue{Day: "w", Value: v}
	}
	return out
}

func TestEvaluateLaunch(t *testing.T) {
	w4 := 35.0
	good := LaunchReport{
		Activation: ActivationRates{Signups: 20, Connection24hPct: 65, FirstAuto48hPct: 55},
		UASNow:     60, UASWeeks: weeks(10, 52, 55, 58, 60), RetentionW4Pct: &w4, Gmail: GmailQuota{Connected: 40},
	}
	c := criteria(good)
	assert.True(t, *c["I.1 Correo conectado en 24 h"])
	assert.True(t, *c["I.1 1.ª transacción automática en 48 h"])
	assert.True(t, *c["I.1 Usuarios al día semanales (UAS)"])
	assert.Nil(t, c["I.1 Errores graves abiertos"], "checked by hand")
	assert.True(t, *c["I.2 UAS ≥ 50 sostenido"])
	assert.True(t, *c["I.2 Retención S4 (al día en la semana 4)"])
	assert.True(t, *c["I.3 UAS ≥ 50 sostenido (encender Apoyar a Topi)"])
	assert.Nil(t, c["I.3 Verificación de Google aprobada"])
	assert.True(t, *c["I.1 Cupos de Gmail (app sin verificar)"])

	bad := LaunchReport{
		Activation: ActivationRates{Signups: 0}, UASNow: 9, UASWeeks: weeks(60, 49, 60), Gmail: GmailQuota{Connected: 95},
	}
	c = criteria(bad)
	assert.False(t, *c["I.1 Correo conectado en 24 h"], "no signups: not passed")
	assert.False(t, *c["I.1 Usuarios al día semanales (UAS)"])
	assert.False(t, *c["I.2 UAS ≥ 50 sostenido"], "49 in the last two weeks breaks it")
	assert.False(t, *c["I.2 Retención S4 (al día en la semana 4)"], "no eligible cohort yet")
	assert.False(t, *c["I.3 UAS ≥ 50 sostenido (encender Apoyar a Topi)"], "fewer than 4 points ≥ 50")
	assert.False(t, *c["I.1 Cupos de Gmail (app sin verificar)"], "keep a margin of 10 for support")
}

func TestLaunchStage(t *testing.T) {
	today := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	ok := LaunchStage{Stage: StageI1, StartedAt: " 2026-11-14 ", Note: " Empezamos con 20 cercanos "}
	require.NoError(t, ok.Validate(today))
	assert.Equal(t, "2026-11-14", ok.StartedAt)
	assert.Equal(t, "Empezamos con 20 cercanos", ok.Note)

	for _, s := range []LaunchStage{
		{Stage: "I.4", StartedAt: "2026-11-14"},
		{Stage: StageI1, StartedAt: "14/11/2026"},
		{Stage: StageI1, StartedAt: "2026-12-01"},
		{Stage: StageI1, StartedAt: "2026-11-01", Note: string(make([]rune, 501))},
	} {
		assert.ErrorIs(t, s.Validate(today), ErrInvalidLaunchStage, s.Stage+" "+s.StartedAt)
	}

	assert.Nil(t, CurrentStage(nil))
	assert.Equal(t, StageI2, CurrentStage([]LaunchStage{{Stage: StageI2}, {Stage: StageI1}}).Stage)
}
