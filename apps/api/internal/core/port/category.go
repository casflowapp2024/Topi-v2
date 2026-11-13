package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=category.go -destination=mock/category.go -package=mock

type CategoryRepository interface {
	// CreateCategory creates a new category
	CreateCategory(ctx context.Context, category *domain.Category) error
	// CreateCategories creates multiple categories
	CreateCategories(ctx context.Context, categories []domain.Category) error
	// GetCategory retrieves a category by id
	GetCategory(ctx context.Context, userID string, id uint64) (*domain.Category, error)
	// GetCategoryByName retrieves a category by name
	GetCategoryByName(ctx context.Context, userID string, name string) (*domain.Category, error)
	// GetCategoryList retrieves all categories
	GetCategoryList(ctx context.Context, userID string, skip, limit uint64) ([]domain.Category, error)
	// UpdateCategory updates a category
	UpdateCategory(ctx context.Context, category *domain.Category) error
	// DeleteCategory deletes a category by id
	DeleteCategory(ctx context.Context, userID string, id uint64) error
	// CurrentBudgetMonth returns day 1 of the user's current month (their time zone)
	CurrentBudgetMonth(ctx context.Context, userID string) (time.Time, error)
	// ListCategoryBudgets returns the budget versions of a category, from the newest to the oldest
	ListCategoryBudgets(ctx context.Context, userID string, categoryID uint64) ([]domain.CategoryBudget, error)
	// UpsertCategoryBudget saves the version of budget.EffectiveFrom and syncs categories.budget with the latest one
	UpsertCategoryBudget(ctx context.Context, budget domain.CategoryBudget) error
	// DeleteCategoryBudget deletes the version that starts in month and syncs categories.budget with the latest one
	DeleteCategoryBudget(ctx context.Context, userID string, categoryID uint64, month time.Time) error
}

type CategoryService interface {
	// CreateCategory creates a new category
	CreateCategory(ctx context.Context, category *domain.Category) error
	// CreateCategories creates multiple categories
	CreateCategories(ctx context.Context, categories []domain.Category) error
	// GetCategory retrieves a category by id
	GetCategory(ctx context.Context, userID string, id uint64) (*domain.Category, error)
	// GetCategories retrieves all categories
	GetCategories(ctx context.Context, userID string, skip uint64, limit uint64) ([]domain.Category, error)
	// GetCategoryByName retrieves a category by name
	GetCategoryByName(ctx context.Context, userID string, name string) (*domain.Category, error)
	// GetDefaultCategory retrieves the default category concurrently and updates the resolver
	GetDefaultCategory(ctx context.Context, cpr *domain.CategoryPredictionResolver)
	// UpdateCategory updates a category
	UpdateCategory(ctx context.Context, category *domain.Category) error
	// DeleteCategory deletes a category by id
	DeleteCategory(ctx context.Context, category domain.Category) error
	// ListBudgets returns the budget versions of a category, from the newest to the oldest
	ListBudgets(ctx context.Context, userID string, categoryID uint64) ([]domain.CategoryBudget, error)
	// SetBudget sets the budget of a category from a month (nil = the user's current month) until the next version
	SetBudget(ctx context.Context, userID string, categoryID uint64, budget float64, from *time.Time) ([]domain.CategoryBudget, error)
	// DeleteBudget deletes the version that starts in month; the previous one applies again
	DeleteBudget(ctx context.Context, userID string, categoryID uint64, month time.Time) ([]domain.CategoryBudget, error)
}
