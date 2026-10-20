package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestCategoryService_CreateCategory(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	tests := []struct {
		name        string
		category    *domain.Category
		setupMock   func()
		expectedErr error
	}{
		{
			name: "should create category successfully when valid data is provided",
			category: &domain.Category{
				UserID: "user123",
				Name:   "Food",
				Budget: 1000.0,
				Emoji:  "🍔",
				Income: false,
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategory(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should return error when repository fails",
			category: &domain.Category{
				UserID: "user123",
				Name:   "Food",
				Budget: 1000.0,
				Emoji:  "🍔",
				Income: false,
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategory(ctx, gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
		},
		{
			name:     "should handle nil category gracefully when nil is passed",
			category: nil,
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategory(ctx, nil).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name:     "should handle category with empty fields when empty category is provided",
			category: &domain.Category{},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategory(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should handle category with negative budget when negative budget is provided",
			category: &domain.Category{
				UserID: "user123",
				Name:   "Food",
				Budget: -1000.0,
				Emoji:  "🍔",
				Income: false,
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategory(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			err := service.CreateCategory(ctx, tt.category)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCategoryService_CreateCategories(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	tests := []struct {
		name        string
		categories  []domain.Category
		setupMock   func()
		expectedErr error
	}{
		{
			name: "should create multiple categories successfully when valid data is provided",
			categories: []domain.Category{
				{UserID: "user123", Name: "Food", Budget: 1000.0, Emoji: "🍔", Income: false},
				{UserID: "user123", Name: "Transport", Budget: 500.0, Emoji: "🚗", Income: false},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategories(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should return error when repository fails",
			categories: []domain.Category{
				{UserID: "user123", Name: "Food", Budget: 1000.0, Emoji: "🍔", Income: false},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategories(ctx, gomock.Any()).
					Return(domain.ErrConflictingData).
					Times(1)
			},
			expectedErr: domain.ErrConflictingData,
		},
		{
			name:       "should handle empty slice when empty slice is provided",
			categories: []domain.Category{},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategories(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name:       "should handle nil slice when nil slice is provided",
			categories: nil,
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategories(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should handle categories with duplicate names when duplicate names are provided",
			categories: []domain.Category{
				{UserID: "user123", Name: "Food", Budget: 1000.0, Emoji: "🍔", Income: false},
				{UserID: "user123", Name: "Food", Budget: 2000.0, Emoji: "🍕", Income: false},
			},
			setupMock: func() {
				mockRepo.EXPECT().
					CreateCategories(ctx, gomock.Any()).
					Return(domain.ErrUniqueConstraintViolated).
					Times(1)
			},
			expectedErr: domain.ErrUniqueConstraintViolated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			err := service.CreateCategories(ctx, tt.categories)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCategoryService_GetCategory(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	expectedCategory := &domain.Category{
		ID:        1,
		UserID:    "user123",
		Name:      "Food",
		Budget:    1000.0,
		Emoji:     "🍔",
		Income:    false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tests := []struct {
		name             string
		userID           string
		categoryID       uint64
		setupMock        func()
		expectedCategory *domain.Category
		expectedErr      error
	}{
		{
			name:       "should return category successfully when category exists",
			userID:     "user123",
			categoryID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(expectedCategory, nil).
					Times(1)
			},
			expectedCategory: expectedCategory,
			expectedErr:      nil,
		},
		{
			name:       "should return error when category not found",
			userID:     "user123",
			categoryID: 999,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrDataNotFound,
		},
		{
			name:       "should return error when userID is empty",
			userID:     "",
			categoryID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "", uint64(1)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrDataNotFound,
		},
		{
			name:       "should return error when categoryID is zero",
			userID:     "user123",
			categoryID: 0,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(0)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrDataNotFound,
		},
		{
			name:       "should return error when repository fails",
			userID:     "user123",
			categoryID: 1,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrInternal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			result, err := service.GetCategory(ctx, tt.userID, tt.categoryID)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedCategory, result)
			}
		})
	}
}

func TestCategoryService_GetCategoryByName(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	expectedCategory := &domain.Category{
		ID:        1,
		UserID:    "user123",
		Name:      "Food",
		Budget:    1000.0,
		Emoji:     "🍔",
		Income:    false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tests := []struct {
		name             string
		userID           string
		categoryName     string
		setupMock        func()
		expectedCategory *domain.Category
		expectedErr      error
	}{
		{
			name:         "should return category successfully when category exists",
			userID:       "user123",
			categoryName: "Food",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", "Food").
					Return(expectedCategory, nil).
					Times(1)
			},
			expectedCategory: expectedCategory,
			expectedErr:      nil,
		},
		{
			name:         "should return error when category not found",
			userID:       "user123",
			categoryName: "NonExistent",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", "NonExistent").
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrDataNotFound,
		},
		{
			name:         "should return error when userID is empty",
			userID:       "",
			categoryName: "Food",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "", "Food").
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrDataNotFound,
		},
		{
			name:         "should return error when category name is empty",
			userID:       "user123",
			categoryName: "",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", "").
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrDataNotFound,
		},
		{
			name:         "should handle special characters in category name when special characters are provided",
			userID:       "user123",
			categoryName: "Food & Drinks 🍕",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", "Food & Drinks 🍕").
					Return(expectedCategory, nil).
					Times(1)
			},
			expectedCategory: expectedCategory,
			expectedErr:      nil,
		},
		{
			name:         "should return error when repository fails",
			userID:       "user123",
			categoryName: "Food",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", "Food").
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedCategory: nil,
			expectedErr:      domain.ErrInternal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			result, err := service.GetCategoryByName(ctx, tt.userID, tt.categoryName)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedCategory, result)
			}
		})
	}
}

func TestCategoryService_GetCategories(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	expectedCategories := []domain.Category{
		{ID: 1, UserID: "user123", Name: "Food", Budget: 1000.0, Emoji: "🍔", Income: false},
		{ID: 2, UserID: "user123", Name: "Transport", Budget: 500.0, Emoji: "🚗", Income: false},
	}

	tests := []struct {
		name               string
		userID             string
		skip               uint64
		limit              uint64
		setupMock          func()
		expectedCategories []domain.Category
		expectedErr        error
	}{
		{
			name:   "should return categories successfully when categories exist",
			userID: "user123",
			skip:   0,
			limit:  10,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryList(ctx, "user123", uint64(0), uint64(10)).
					Return(expectedCategories, nil).
					Times(1)
			},
			expectedCategories: expectedCategories,
			expectedErr:        nil,
		},
		{
			name:   "should return empty slice when no categories exist",
			userID: "user123",
			skip:   0,
			limit:  10,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryList(ctx, "user123", uint64(0), uint64(10)).
					Return([]domain.Category{}, nil).
					Times(1)
			},
			expectedCategories: []domain.Category{},
			expectedErr:        nil,
		},
		{
			name:   "should return error when userID is empty",
			userID: "",
			skip:   0,
			limit:  10,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryList(ctx, "", uint64(0), uint64(10)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedCategories: nil,
			expectedErr:        domain.ErrDataNotFound,
		},
		{
			name:   "should handle pagination correctly when skip and limit are provided",
			userID: "user123",
			skip:   5,
			limit:  3,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryList(ctx, "user123", uint64(5), uint64(3)).
					Return([]domain.Category{expectedCategories[0]}, nil).
					Times(1)
			},
			expectedCategories: []domain.Category{expectedCategories[0]},
			expectedErr:        nil,
		},
		{
			name:   "should handle zero limit when limit is zero",
			userID: "user123",
			skip:   0,
			limit:  0,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryList(ctx, "user123", uint64(0), uint64(0)).
					Return([]domain.Category{}, nil).
					Times(1)
			},
			expectedCategories: []domain.Category{},
			expectedErr:        nil,
		},
		{
			name:   "should return error when repository fails",
			userID: "user123",
			skip:   0,
			limit:  10,
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryList(ctx, "user123", uint64(0), uint64(10)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedCategories: nil,
			expectedErr:        domain.ErrInternal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			result, err := service.GetCategories(ctx, tt.userID, tt.skip, tt.limit)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedCategories, result)
			}
		})
	}
}

func TestCategoryService_GetDefaultCategory(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	tests := []struct {
		name                      string
		userID                    string
		setupMock                 func()
		expectedDefaultCategoryID uint64
		expectedError             error
	}{
		{
			name:   "should set default category ID successfully when default category exists",
			userID: "user123",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", enums.OtherCategory).
					Return(&domain.Category{ID: 1, Name: enums.OtherCategory}, nil).
					Times(1)
			},
			expectedDefaultCategoryID: 1,
			expectedError:             nil,
		},
		{
			name:   "should set error when default category not found",
			userID: "user123",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", enums.OtherCategory).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedDefaultCategoryID: 0,
			expectedError:             domain.ErrGettingOtherCategoryId,
		},
		{
			name:   "should set error when category ID is zero",
			userID: "user123",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", enums.OtherCategory).
					Return(&domain.Category{ID: 0, Name: enums.OtherCategory}, nil).
					Times(1)
			},
			expectedDefaultCategoryID: 0,
			expectedError:             domain.ErrGettingOtherCategoryId,
		},
		{
			name:   "should set error when repository fails",
			userID: "user123",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "user123", enums.OtherCategory).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedDefaultCategoryID: 0,
			expectedError:             domain.ErrGettingOtherCategoryId,
		},
		{
			name:   "should handle empty userID when userID is empty",
			userID: "",
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategoryByName(ctx, "", enums.OtherCategory).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedDefaultCategoryID: 0,
			expectedError:             domain.ErrGettingOtherCategoryId,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			var wg sync.WaitGroup
			var mu sync.Mutex
			wg.Add(1)

			cpr := domain.NewCategoryPredictionResolver(tt.userID, &mu, &wg)

			go service.GetDefaultCategory(ctx, cpr)
			wg.Wait()

			assert.Equal(t, tt.expectedDefaultCategoryID, cpr.DefaultCategoryID)
			assert.Equal(t, tt.expectedError, cpr.DefaultCategoryErr)
		})
	}
}

func TestCategoryService_UpdateCategory(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name        string
		category    *domain.Category
		setupMock   func(*mock.MockCategoryRepository)
		expectedErr error
	}{
		{
			name: "should update category successfully when valid data is provided",
			category: &domain.Category{
				ID:       1,
				UserID:   "user123",
				Name:     "Updated Food",
				Budget:   1500.0,
				Emoji:    "🍕",
				Income:   false,
				Editable: true,
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateCategory(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should allow updating budget from default category",
			category: &domain.Category{
				ID:       1,
				UserID:   "user123",
				Name:     enums.OtherCategory,
				Budget:   101000.0,
				Emoji:    "🍔",
				Income:   false,
				Editable: false,
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     enums.OtherCategory,
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: false,
					}, nil).
					Times(1)

				mockRepo.EXPECT().
					UpdateCategory(ctx, gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should not allow updating default category when changing name from default",
			category: &domain.Category{
				ID:       1,
				UserID:   "user123",
				Name:     "Updated Name",
				Budget:   1000.0,
				Emoji:    "🍔",
				Income:   false,
				Editable: false,
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     enums.OtherCategory,
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: false,
					}, nil).
					Times(1)
			},
			expectedErr: domain.ErrDefaultCategoryLocked,
		},
		{
			name: "should return error when category not found",
			category: &domain.Category{
				ID:     999,
				UserID: "user123",
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name: "should return error when no data to update",
			category: &domain.Category{
				ID:       1,
				UserID:   "user123",
				Name:     "Food",
				Budget:   1000.0,
				Emoji:    "🍔",
				Income:   false,
				Editable: true,
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
			},
			expectedErr: domain.ErrNoUpdatedData,
		},
		{
			name: "should return error when trying to update with empty category",
			category: &domain.Category{
				ID:       1,
				UserID:   "user123",
				Name:     "",
				Budget:   0,
				Emoji:    "",
				Income:   false,
				Editable: true,
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
			},
			expectedErr: domain.ErrNoUpdatedData,
		},
		{
			name: "should return error when repository update fails",
			category: &domain.Category{
				ID:       1,
				UserID:   "user123",
				Name:     "Updated Food",
				Budget:   1500.0,
				Emoji:    "🍕",
				Income:   false,
				Editable: true,
			},
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
				mockRepo.EXPECT().
					UpdateCategory(ctx, gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
		},
		{
			name:     "should handle nil category when nil category is provided",
			category: nil,
			setupMock: func(mockRepo *mock.MockCategoryRepository) {
				// No mock expectations since we should return early with ErrNilCategory
			},
			expectedErr: domain.ErrNilCategory,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockRepo := mock.NewMockCategoryRepository(ctrl)
			service := NewCategoryService(mockRepo)

			tt.setupMock(mockRepo)

			err := service.UpdateCategory(ctx, tt.category)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCategoryService_DeleteCategory(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mock.NewMockCategoryRepository(ctrl)
	service := NewCategoryService(mockRepo)
	ctx := context.Background()

	tests := []struct {
		name        string
		category    domain.Category
		setupMock   func()
		expectedErr error
	}{
		{
			name: "should delete category successfully when category exists",
			category: domain.Category{
				ID:     1,
				UserID: "user123",
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
				mockRepo.EXPECT().
					DeleteCategory(ctx, "user123", uint64(1)).
					Return(nil).
					Times(1)
			},
			expectedErr: nil,
		},
		{
			name: "should return error when category not found",
			category: domain.Category{
				ID:     999,
				UserID: "user123",
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name: "should return error when userID is empty",
			category: domain.Category{
				ID:     1,
				UserID: "",
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "", uint64(1)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name: "should return error when category ID is zero",
			category: domain.Category{
				ID:     0,
				UserID: "user123",
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(0)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedErr: domain.ErrDataNotFound,
		},
		{
			name: "should return error when repository delete fails",
			category: domain.Category{
				ID:     1,
				UserID: "user123",
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
				mockRepo.EXPECT().
					DeleteCategory(ctx, "user123", uint64(1)).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedErr: domain.ErrInternal,
		},
		{
			name: "should handle concurrent deletion when multiple requests occur",
			category: domain.Category{
				ID:     1,
				UserID: "user123",
			},
			setupMock: func() {
				mockRepo.EXPECT().
					GetCategory(ctx, "user123", uint64(1)).
					Return(&domain.Category{
						ID:       1,
						UserID:   "user123",
						Name:     "Food",
						Budget:   1000.0,
						Emoji:    "🍔",
						Income:   false,
						Editable: true,
					}, nil).
					Times(1)
				mockRepo.EXPECT().
					DeleteCategory(ctx, "user123", uint64(1)).
					Return(errors.New("category already deleted")).
					Times(1)
			},
			expectedErr: errors.New("category already deleted"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			err := service.DeleteCategory(ctx, tt.category)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestNewCategoryService(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	tests := []struct {
		name     string
		repo     func() port.CategoryRepository
		expected bool
	}{
		{
			name: "should create service successfully when valid repository is provided",
			repo: func() port.CategoryRepository {
				return mock.NewMockCategoryRepository(ctrl)
			},
			expected: true,
		},
		{
			name: "should handle nil repository when nil repository is provided",
			repo: func() port.CategoryRepository {
				return nil
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewCategoryService(tt.repo())

			if tt.expected {
				assert.NotNil(t, service)
			} else {
				assert.Nil(t, service)
			}
		})
	}
}
