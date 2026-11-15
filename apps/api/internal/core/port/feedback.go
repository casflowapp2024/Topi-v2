package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=feedback.go -destination=mock/feedback.go -package=mock

// FeedbackRepository stores "¿Qué le falta a Topi?" (plan/27 §E)
type FeedbackRepository interface {
	Create(ctx context.Context, feedback *domain.Feedback) error
	CountSince(ctx context.Context, userID string, since time.Time) (int, error)
	List(ctx context.Context, unreadOnly bool, limit int) ([]domain.Feedback, error)
	CountUnread(ctx context.Context) (int64, error)
	MarkRead(ctx context.Context, id uint64) error
}

// FeedbackService: users send opinions, the admin panel reads them
type FeedbackService interface {
	Submit(ctx context.Context, userID string, feedback domain.Feedback) error
	List(ctx context.Context, unreadOnly bool) (*domain.FeedbackPage, error)
	MarkRead(ctx context.Context, adminID string, id uint64) error
}
