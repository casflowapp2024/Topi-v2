package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestConnectionStatus_ComputeReading(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	base := ConnectionStatus{Active: true, LinkedAccounts: 1, ConnectedAt: now.Add(-72 * time.Hour)}

	cases := []struct {
		name string
		edit func(c *ConnectionStatus)
		want string
	}{
		{"down wins", func(c *ConnectionStatus) { c.Error = "token_expired_or_revoked"; c.TransactionsCreated = 4 }, ReadingDown},
		{"turned off", func(c *ConnectionStatus) { c.Active = false }, ReadingInactive},
		{"no linked account", func(c *ConnectionStatus) { c.LinkedAccounts = 0 }, ReadingNoAccounts},
		{"reading", func(c *ConnectionStatus) { c.TransactionsCreated = 1 }, ReadingOK},
		{"connected 10 h ago", func(c *ConnectionStatus) { c.ConnectedAt = now.Add(-10 * time.Hour) }, ReadingFirst},
		{"47 h: still waiting", func(c *ConnectionStatus) { c.ConnectedAt = now.Add(-47 * time.Hour) }, ReadingFirst},
		{"48 h without transactions", func(c *ConnectionStatus) { c.ConnectedAt = now.Add(-48 * time.Hour) }, ReadingNoTransaction},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := base
			tc.edit(&c)
			c.ComputeReading(now)
			assert.Equal(t, tc.want, c.Reading)
		})
	}
}

func TestNewOnboardingStatus(t *testing.T) {
	ids := func(s OnboardingStatus) map[string]bool {
		m := map[string]bool{}
		for _, step := range s.Steps {
			m[step.ID] = step.Done
		}
		return m
	}

	empty := NewOnboardingStatus(OnboardingFacts{})
	assert.False(t, empty.Complete)
	assert.Equal(t, []string{StepConnectEmail, StepFirstAutoTx, StepReview, StepBudget}, []string{
		empty.Steps[0].ID, empty.Steps[1].ID, empty.Steps[2].ID, empty.Steps[3].ID})
	assert.Empty(t, empty.DoneSteps())

	// first transactions arrived and nothing waits in Por revisar: review counts as done
	reading := NewOnboardingStatus(OnboardingFacts{HasConnection: true, HasAutoTx: true})
	assert.Equal(t, map[string]bool{StepConnectEmail: true, StepFirstAutoTx: true, StepReview: true, StepBudget: false}, ids(reading))

	// something waits and nothing was resolved yet
	waiting := NewOnboardingStatus(OnboardingFacts{HasConnection: true, HasAutoTx: true, PendingReview: 3})
	assert.False(t, ids(waiting)[StepReview])
	assert.Equal(t, int64(3), waiting.PendingReview)

	all := NewOnboardingStatus(OnboardingFacts{HasConnection: true, HasAutoTx: true, ReviewResolved: true, PendingReview: 2, HasBudget: true})
	assert.True(t, all.Complete)
	assert.Equal(t, []string{StepBudget, StepConnectEmail, StepFirstAutoTx, StepReview}, all.DoneSteps())
}

func TestIsSupportedBank(t *testing.T) {
	assert.True(t, IsSupportedBank("Bancolombia"))
	assert.True(t, IsSupportedBank("  bancolombia "))
	assert.True(t, IsSupportedBank("lulo  bank"))
	assert.False(t, IsSupportedBank("Banco de Bogotá"))
	assert.Contains(t, SupportedBanks(), "Nubank")
}

func TestLaunchEvents_ClosedProps(t *testing.T) {
	ok := []ProductEvent{
		{UserID: "u1", Name: ProductEventOnboardingStep, Props: map[string]any{"step": StepBudget}},
		{UserID: "u1", Name: ProductEventBankSampleRequested, Props: map[string]any{"bank_id": uint64(3)}},
		{UserID: "u1", Name: ProductEventBankSampleRequested},
		{UserID: "u1", Name: ProductEventConnectionReconnected, Props: map[string]any{"email_id": uint64(9), "provider": "gmail"}},
	}
	for _, e := range ok {
		assert.NoError(t, e.Validate(), e.Name)
	}
	bad := []ProductEvent{
		{UserID: "u1", Name: ProductEventOnboardingStep, Props: map[string]any{"step": "anything"}},
		{UserID: "u1", Name: ProductEventBankSampleRequested, Props: map[string]any{"bank": "Banco de Bogotá"}},
		{UserID: "u1", Name: ProductEventConnectionReconnected, Props: map[string]any{"email": "ana@gmail.com"}},
	}
	for _, e := range bad {
		assert.ErrorIs(t, e.Validate(), ErrInvalidProductEvent, e.Name)
	}
}
