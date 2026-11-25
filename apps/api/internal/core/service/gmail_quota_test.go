package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newGmailQuota(t *testing.T, grants domain.GmailGrants, settings domain.GmailQuotaSettings) (*GmailQuotaAppService, *mock.MockAdminService, *fakeMailService) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockLaunchRepository(ctrl)
	repo.EXPECT().GmailGrants(gomock.Any(), settings.BaselineAt).Return(grants, nil).AnyTimes()
	repo.EXPECT().GmailConnections(gomock.Any()).Return(int64(12), nil).AnyTimes()
	admin := mock.NewMockAdminService(ctrl)
	mail := &fakeMailService{}
	svc := NewGmailQuotaService(repo, mail, admin, settings, "equipo@topi.test")
	svc.now = func() time.Time { return time.Date(2026, 11, 18, 15, 0, 0, 0, time.UTC) }
	return svc, admin, mail
}

func dedupeKeys(emails []domain.OutboxEmail) []string {
	out := []string{}
	for _, e := range emails {
		out = append(out, *e.DedupeKey)
	}
	return out
}

func TestGmailQuota_AlertsEveryTenAndWeeklyFromThirty(t *testing.T) {
	ctx := context.Background()
	svc, _, _ := newGmailQuota(t, domain.GmailGrants{Total: 9}, domain.GmailQuotaSettings{})
	n, err := svc.ScheduleAlerts(ctx)
	require.NoError(t, err)
	assert.Zero(t, n, "below 10 nobody is told")

	svc, _, mail := newGmailQuota(t, domain.GmailGrants{Total: 23}, domain.GmailQuotaSettings{})
	_, err = svc.ScheduleAlerts(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"gmail_quota:20"}, dedupeKeys(mail.queued))
	assert.Equal(t, "equipo@topi.test", mail.queued[0].To)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(mail.queued[0].Payload, &payload))
	assert.Equal(t, map[string]any{"threshold": float64(20), "blocked": false}, payload,
		"only the threshold: the numbers are filled when sending")

	svc, _, mail = newGmailQuota(t, domain.GmailGrants{Total: 34}, domain.GmailQuotaSettings{})
	_, err = svc.ScheduleAlerts(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"gmail_quota:30", "gmail_quota_weekly:2026-W47"}, dedupeKeys(mail.queued))

	svc, _, mail = newGmailQuota(t, domain.GmailGrants{Total: 87}, domain.GmailQuotaSettings{})
	_, err = svc.ScheduleAlerts(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"gmail_quota:80", "gmail_quota:blocked:86", "gmail_quota_weekly:2026-W47"}, dedupeKeys(mail.queued))
}

func TestGmailQuota_NothingWhenVerifiedOrWithoutTeamMailbox(t *testing.T) {
	ctx := context.Background()
	svc, _, _ := newGmailQuota(t, domain.GmailGrants{Total: 90}, domain.GmailQuotaSettings{Verified: true})
	n, err := svc.ScheduleAlerts(ctx)
	require.NoError(t, err)
	assert.Zero(t, n)
	ok, err := svc.CanConnectNew(ctx)
	require.NoError(t, err)
	assert.True(t, ok, "verified: no cap")
	assert.ErrorIs(t, svc.Enrich(ctx, domain.OutboxEmail{Template: domain.TemplateGmailQuota}, map[string]any{}), domain.ErrMailCancelled)

	svc, _, mail := newGmailQuota(t, domain.GmailGrants{Total: 50}, domain.GmailQuotaSettings{})
	svc.team = ""
	n, err = svc.ScheduleAlerts(ctx)
	require.NoError(t, err)
	assert.Zero(t, n)
	assert.Empty(t, mail.queued)
}

func TestGmailQuota_CanConnectNew(t *testing.T) {
	ctx := context.Background()
	at := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)
	svc, _, _ := newGmailQuota(t, domain.GmailGrants{Total: 20, Since: 67}, domain.GmailQuotaSettings{Baseline: 18, BaselineAt: &at})
	ok, err := svc.CanConnectNew(ctx)
	require.NoError(t, err)
	assert.True(t, ok, "85 used: still room")

	svc, _, _ = newGmailQuota(t, domain.GmailGrants{Total: 20, Since: 68}, domain.GmailQuotaSettings{Baseline: 18, BaselineAt: &at})
	ok, err = svc.CanConnectNew(ctx)
	require.NoError(t, err)
	assert.False(t, ok, "86 used: no more new Gmail")
}

func TestGmailQuota_EnrichWeeklyWithActiveUsers(t *testing.T) {
	ctx := context.Background()
	svc, admin, _ := newGmailQuota(t, domain.GmailGrants{Total: 31}, domain.GmailQuotaSettings{})
	admin.EXPECT().Summary(gomock.Any()).Return(&domain.AdminSummary{NorthStar: 7, WAU: 12, Signups7d: 5}, nil)
	data := map[string]any{"week": "2026-W47"}
	require.NoError(t, svc.Enrich(ctx, domain.OutboxEmail{Template: domain.TemplateGmailQuotaWeekly}, data))
	assert.Equal(t, int64(31), data["used"])
	assert.Equal(t, int64(69), data["left"])
	assert.Equal(t, int64(12), data["connected"])
	assert.Equal(t, int64(7), data["uas"])
	assert.Equal(t, int64(12), data["wau"])
	assert.Equal(t, true, data["casa"])

	svc, admin, _ = newGmailQuota(t, domain.GmailGrants{Total: 31}, domain.GmailQuotaSettings{})
	admin.EXPECT().Summary(gomock.Any()).Return(nil, errors.New("db down"))
	assert.Error(t, svc.Enrich(ctx, domain.OutboxEmail{Template: domain.TemplateGmailQuotaWeekly}, map[string]any{}))
}
