package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewGmailQuota(t *testing.T) {
	at := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		name            string
		settings        GmailQuotaSettings
		grants          GmailGrants
		used, threshold int64
		blocked, weekly bool
	}{
		{"no baseline: what the database saw", GmailQuotaSettings{}, GmailGrants{Total: 9}, 9, 0, false, false},
		{"baseline from Google plus the new ones", GmailQuotaSettings{Baseline: 18, BaselineAt: &at}, GmailGrants{Total: 16, Since: 3}, 21, 20, false, false},
		{"never less than the database", GmailQuotaSettings{Baseline: 2, BaselineAt: &at}, GmailGrants{Total: 40, Since: 1}, 40, 40, false, true},
		{"weekly from 30", GmailQuotaSettings{Baseline: 18, BaselineAt: &at}, GmailGrants{Total: 30, Since: 12}, 30, 30, false, true},
		{"blocked at 86", GmailQuotaSettings{Baseline: 18, BaselineAt: &at}, GmailGrants{Total: 70, Since: 68}, 86, 80, true, true},
		{"custom block", GmailQuotaSettings{BlockAt: 50}, GmailGrants{Total: 55}, 55, 50, true, true},
		{"verified: no cap", GmailQuotaSettings{Verified: true}, GmailGrants{Total: 99}, 99, 0, false, false},
	}
	for _, c := range cases {
		q := NewGmailQuota(c.settings, c.grants, 7)
		assert.Equal(t, c.used, q.Used, c.name)
		assert.Equal(t, c.threshold, q.Threshold, c.name)
		assert.Equal(t, c.blocked, q.Blocked, c.name)
		assert.Equal(t, c.weekly, q.Weekly, c.name)
		assert.Equal(t, int64(7), q.Connected, c.name)
		assert.Equal(t, int64(GmailUserCap)-c.used, q.Left(), c.name)
	}
	assert.Equal(t, int64(GmailDefaultBlockAt), NewGmailQuota(GmailQuotaSettings{}, GmailGrants{}, 0).BlockAt)
}

func TestGmailWeekKey(t *testing.T) {
	// 05:30 UTC on Monday is 00:30 Monday in Bogotá
	assert.Equal(t, "2026-W47", GmailWeekKey(time.Date(2026, 11, 16, 5, 30, 0, 0, time.UTC)))
	// 03:00 UTC on Monday is still Sunday in Bogotá: previous week
	assert.Equal(t, "2026-W46", GmailWeekKey(time.Date(2026, 11, 16, 3, 0, 0, 0, time.UTC)))
}
