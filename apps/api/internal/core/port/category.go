package port

import (
	"cash-flow/internal/core/domain"
	"context"
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
}
