package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
)

type CategoryService struct {
	repo port.CategoryRepository
}

func NewCategoryService(repo port.CategoryRepository) *CategoryService {
	return &CategoryService{
		repo: repo,
	}
}

func (cs CategoryService) CreateCategory(ctx context.Context, category *domain.Category) error {
	err := cs.repo.CreateCategory(ctx, category)
	if err != nil {
		return err
	}
	return nil
}

func (cs CategoryService) CreateCategories(ctx context.Context, categories []domain.Category) error {
	err := cs.repo.CreateCategories(ctx, categories)
	if err != nil {
		return err
	}
	return nil
}

func (cs CategoryService) GetCategory(ctx context.Context, userID string, id uint64) (*domain.Category, error) {
	var category *domain.Category

	category, err := cs.repo.GetCategory(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	return category, nil
}

func (cs CategoryService) GetCategoryByName(
	ctx context.Context,
	userID string,
	name string,
) (*domain.Category, error) {
	var category *domain.Category

	category, err := cs.repo.GetCategoryByName(ctx, userID, name)
	if err != nil {
		return nil, err
	}

	return category, nil
}

func (cs CategoryService) GetCategories(
	ctx context.Context,
	userID string,
	skip uint64,
	limit uint64,
) ([]domain.Category, error) {
	var categories []domain.Category

	categories, err := cs.repo.GetCategoryList(ctx, userID, skip, limit)
	if err != nil {
		return nil, err
	}

	return categories, nil
}

// GetDefaultCategory retrieves the default category concurrently and updates the resolver
func (cs CategoryService) GetDefaultCategory(
	ctx context.Context,
	cpr *domain.CategoryPredictionResolver,
) {
	defer cpr.Wg.Done()

	category, err := cs.repo.GetCategoryByName(ctx, cpr.UserID, enums.OtherCategory)

	if err != nil || category.ID == 0 {
		cpr.DefaultCategoryErr = domain.ErrGettingOtherCategoryId
		return
	}

	defer cpr.Mu.Unlock()
	cpr.Mu.Lock()

	cpr.DefaultCategoryID = category.ID
}

func (cs CategoryService) UpdateCategory(ctx context.Context, category *domain.Category) error {
	if category == nil {
		return domain.ErrNilCategory
	}

	actualCategory, err := cs.repo.GetCategory(ctx, category.UserID, category.ID)
	if err != nil {
		return err
	}

	if !category.CanUpdateCategory(*actualCategory) {
		return domain.ErrDefaultCategoryLocked
	}

	if domain.IsSameCategory(*actualCategory, *category) || domain.IsEmptyCategory(*category) {
		return domain.ErrNoUpdatedData
	}

	err = cs.repo.UpdateCategory(ctx, category)
	if err != nil {
		return err
	}

	return nil
}

func (cs CategoryService) DeleteCategory(ctx context.Context, category domain.Category) error {
	_, err := cs.repo.GetCategory(ctx, category.UserID, category.ID)
	if err != nil {
		return err
	}

	return cs.repo.DeleteCategory(ctx, category.UserID, category.ID)
}
