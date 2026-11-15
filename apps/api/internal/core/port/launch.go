package port

import (
	"cash-flow/internal/core/domain"
	"context"
)

//go:generate mockgen -source=launch.go -destination=mock/launch.go -package=mock

// LaunchRepository stores the stages of the rollout (plan/27 §I)
type LaunchRepository interface {
	Stages(ctx context.Context) ([]domain.LaunchStage, error)
	SetStage(ctx context.Context, stage domain.LaunchStage) error
	// GmailConnections counts the distinct Gmail addresses connected today
	GmailConnections(ctx context.Context) (int64, error)
}

// LaunchService is the panel's "Lanzamiento"
type LaunchService interface {
	Report(ctx context.Context) (*domain.LaunchReport, error)
	SetStage(ctx context.Context, adminID string, stage domain.LaunchStage) error
}
