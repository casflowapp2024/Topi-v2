package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestReactivationTarget_Reason(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	rules := ReactivationRules{DailyLimit: 5}
	ok := ReactivationTarget{PersonalAllowed: true}
	recent := now.Add(-30 * 24 * time.Hour)
	old := now.Add(-91 * 24 * time.Hour)

	cases := []struct {
		name   string
		target ReactivationTarget
		sent   int
		rules  ReactivationRules
		want   string
	}{
		{"allowed", ok, 0, rules, ReactivationOK},
		{"bounced", ReactivationTarget{PersonalAllowed: true, EmailStatus: EmailStatusBounced}, 0, rules, ReactivationSuppressed},
		{"complained", ReactivationTarget{PersonalAllowed: true, EmailStatus: EmailStatusComplained}, 0, rules, ReactivationSuppressed},
		{"unsubscribed", ReactivationTarget{}, 0, rules, ReactivationUnsubscribed},
		{"written 30 days ago", ReactivationTarget{PersonalAllowed: true, LastSentAt: &recent}, 0, rules, ReactivationRecent},
		{"written 91 days ago", ReactivationTarget{PersonalAllowed: true, LastSentAt: &old}, 0, rules, ReactivationOK},
		{"connection down, banner not live", ReactivationTarget{PersonalAllowed: true, ConnectionDown: true}, 0, rules, ReactivationConnectionDown},
		{"connection down, banner live", ReactivationTarget{PersonalAllowed: true, ConnectionDown: true}, 0,
			ReactivationRules{DailyLimit: 5, AllowBroken: true}, ReactivationOK},
		{"daily limit", ok, 5, rules, ReactivationDailyLimit},
		{"limit 0 = off", ok, 0, ReactivationRules{}, ReactivationDailyLimit},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.target.Reason(now, tc.sent, tc.rules))
		})
	}
}

func TestReactivationDraft(t *testing.T) {
	ana := ReactivationTarget{Email: "ana.perez@example.com", Name: "ana maría pérez"}
	assert.Equal(t, "Ana", ana.FirstName())
	assert.Equal(t, "", ReactivationTarget{}.FirstName())

	good := ReactivationDraft{Subject: DefaultReactivationSubject, Body: DefaultReactivationBody}
	assert.NoError(t, good.Validate(ana))

	bad := []ReactivationDraft{
		{Subject: "", Body: "hola"},
		{Subject: "Hola {nombre}", Body: "hola"},                                // no names in subjects
		{Subject: "Hola", Body: "Hola Ana, ¿qué pasó?"},                          // the name typed in: use {nombre}
		{Subject: "Hola", Body: "Te escribo a ana.perez@example.com"},           // the email typed in
		{Subject: "Hola", Body: string(make([]rune, 3001))},                     // too long
	}
	for _, d := range bad {
		assert.ErrorIs(t, d.Validate(ana), ErrInvalidReactivation, d.Body)
	}
	// "Anabel" or "banana" are not the name
	assert.NoError(t, (&ReactivationDraft{Subject: "Hola", Body: "Como dijo Anabel, una banana al día"}).Validate(ana))

	paragraphs := ReactivationDraft{Body: "Hola {nombre},\n\nSoy JuanMa.\r\n\n\nGracias"}.Paragraphs("Ana")
	assert.Equal(t, []string{"Hola Ana,", "Soy JuanMa.", "Gracias"}, paragraphs)
	assert.Equal(t, "Hola,", ReactivationDraft{Body: "Hola {nombre},\n\nx"}.Paragraphs("")[0])
}
