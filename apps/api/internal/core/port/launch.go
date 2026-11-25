package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=launch.go -destination=mock/launch.go -package=mock

// LaunchRepository stores the stages of the rollout (plan/27 §I)
type LaunchRepository interface {
	Stages(ctx context.Context) ([]domain.LaunchStage, error)
	SetStage(ctx context.Context, stage domain.LaunchStage) error
	// GmailConnections counts the distinct Gmail addresses connected today
	GmailConnections(ctx context.Context) (int64, error)
	// GmailGrants counts gmail_oauth_grants: all of them and those first connected after since (nil = none)
	GmailGrants(ctx context.Context, since *time.Time) (domain.GmailGrants, error)
}

// GmailQuotaService: Google accounts used vs. the cap of the unverified app (plan/28 §7)
type GmailQuotaService interface {
	Quota(ctx context.Context) (*domain.GmailQuota, error)
	// CanConnectNew: a new Gmail account may start the OAuth consent (reconnecting one never asks this)
	CanConnectNew(ctx context.Context) (bool, error)
}

// LaunchService is the panel's "Lanzamiento"
type LaunchService interface {
	Report(ctx context.Context) (*domain.LaunchReport, error)
	SetStage(ctx context.Context, adminID string, stage domain.LaunchStage) error
}
