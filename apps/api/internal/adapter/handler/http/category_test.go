package http

import (
	"bytes"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/enums"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestCategoryHandler_GetCategory(t *testing.T) {
	sampleCategory := &domain.Category{
		ID:        1,
		UserID:    "user123",
		Name:      "Food",
		Budget:    1000.0,
		Editable:  true,
		Emoji:     "🍔",
		Income:    false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		categoryID     string
		setupMock      func(*mock.MockCategoryService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return category successfully when category exists",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategory(gomock.Any(), "user123", uint64(1)).
					Return(sampleCategory, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when category not found",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "999",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategory(gomock.Any(), "user123", uint64(999)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  true,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			categoryID:     "1",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "invalid",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is zero",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "0",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is negative",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "-1",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategory(gomock.Any(), "user123", uint64(1)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should handle large category ID",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "9223372036854775807", // max int64
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategory(gomock.Any(), "user123", uint64(9223372036854775807)).
					Return(nil, domain.ErrDataNotFound).
					Times(1)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupCategoryTest(t)
			tt.setupMock(mockService)

			router.GET("/categories/:id", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetCategory(ctx)
			})

			url := fmt.Sprintf("/categories/%s", tt.categoryID)
			req, err := http.NewRequest("GET", url, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])

				data := response["data"].(map[string]interface{})
				assert.Equal(t, float64(sampleCategory.ID), data["id"])
				assert.Equal(t, sampleCategory.Name, data["name"])
				assert.Equal(t, sampleCategory.Budget, data["budget"])
			}
		})
	}
}

func TestCategoryHandler_GetCategories(t *testing.T) {
	sampleCategories := []domain.Category{
		{
			ID:       1,
			UserID:   "user123",
			Name:     "Food",
			Budget:   1000.0,
			Editable: true,
			Emoji:    "🍔",
			Income:   false,
		},
		{
			ID:       2,
			UserID:   "user123",
			Name:     "Transport",
			Budget:   500.0,
			Editable: true,
			Emoji:    "🚗",
			Income:   false,
		},
	}

	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		queryParams    map[string]string
		setupMock      func(*mock.MockCategoryService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should return categories successfully when categories exist",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "0",
				"limit": "10",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategories(gomock.Any(), "user123", uint64(0), uint64(10)).
					Return(sampleCategories, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return empty list when no categories exist",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "0",
				"limit": "10",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategories(gomock.Any(), "user123", uint64(0), uint64(10)).
					Return([]domain.Category{}, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should use default values when skip and limit are not provided",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategories(gomock.Any(), "user123", uint64(0), uint64(0)).
					Return(sampleCategories, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			queryParams:    map[string]string{},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when skip is negative",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "-1",
				"limit": "10",
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when limit is too small",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "0",
				"limit": "3",
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when skip is not a number",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "invalid",
				"limit": "10",
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when limit is not a number",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "0",
				"limit": "invalid",
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "0",
				"limit": "10",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategories(gomock.Any(), "user123", uint64(0), uint64(10)).
					Return(nil, domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should handle large skip and limit values",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			queryParams: map[string]string{
				"skip":  "1000000",
				"limit": "1000000",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					GetCategories(gomock.Any(), "user123", uint64(1000000), uint64(1000000)).
					Return([]domain.Category{}, nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupCategoryTest(t)
			tt.setupMock(mockService)

			router.GET("/categories", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.GetCategories(ctx)
			})

			url := "/categories"
			if len(tt.queryParams) > 0 {
				url += "?"
				first := true
				for key, value := range tt.queryParams {
					if !first {
						url += "&"
					}
					url += fmt.Sprintf("%s=%s", key, value)
					first = false
				}
			}

			req, err := http.NewRequest("GET", url, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])

				data := response["data"].(map[string]interface{})
				assert.NotNil(t, data["meta"])
				assert.NotNil(t, data["categories"])
			}
		})
	}
}

func TestCategoryHandler_UpdateCategory(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		categoryID     string
		requestBody    interface{}
		setupMock      func(*mock.MockCategoryService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should update category successfully when valid data is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			requestBody: updateCategoryRequest{
				Name:   "Updated Food",
				Budget: 1500.0,
				Emoji:  "🍕",
				Income: false,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					UpdateCategory(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx interface{}, category *domain.Category) error {
						// Verify the category data
						assert.Equal(t, uint64(1), category.ID)
						assert.Equal(t, "user123", category.UserID)
						assert.Equal(t, "Updated Food", category.Name)
						assert.Equal(t, 1500.0, category.Budget)
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when name is empty",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			requestBody: updateCategoryRequest{
				Name:   "",
				Budget: 1500.0,
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when name is missing",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			requestBody: map[string]interface{}{
				"budget": 1500.0,
				"emoji":  "🍕",
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "invalid",
			requestBody: updateCategoryRequest{
				Name:   "Updated Food",
				Budget: 1500.0,
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			categoryID: "1",
			requestBody: updateCategoryRequest{
				Name:   "Updated Food",
				Budget: 1500.0,
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			requestBody: updateCategoryRequest{
				Name:   "Updated Food",
				Budget: 1500.0,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					UpdateCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when category not found",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "999",
			requestBody: updateCategoryRequest{
				Name:   "Updated Food",
				Budget: 1500.0,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					UpdateCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrDataNotFound).
					Times(1)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  true,
		},
		{
			name: "should return error when trying to update default category",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "123")
			},
			categoryID: "1",
			requestBody: updateCategoryRequest{
				Name:   "Updated Other",
				Budget: 1500.0,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					UpdateCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrDefaultCategoryLocked).
					Times(1)
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should handle negative budget values",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			requestBody: updateCategoryRequest{
				Name:   "Negative Budget",
				Budget: -1000.0,
				Emoji:  "💸",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					UpdateCategory(gomock.Any(), gomock.Any()).
					Return(nil).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should handle invalid JSON",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "1",
			requestBody:    "invalid json",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupCategoryTest(t)
			tt.setupMock(mockService)

			router.PUT("/categories/:id", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.UpdateCategory(ctx)
			})

			var body []byte
			var err error
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, err = json.Marshal(tt.requestBody)
				assert.NoError(t, err)
			}

			url := fmt.Sprintf("/categories/%s", tt.categoryID)
			req, err := http.NewRequest("PUT", url, bytes.NewBuffer(body))
			assert.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}

func TestCategoryHandler_DeleteCategory(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		categoryID     string
		setupMock      func(*mock.MockCategoryService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should delete category successfully when category exists",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					DeleteCategory(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx interface{}, category domain.Category) error {
						assert.Equal(t, uint64(1), category.ID)
						assert.Equal(t, "user123", category.UserID)
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "should return error when category not found",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "999",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					DeleteCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrDataNotFound).
					Times(1)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  true,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set auth context
			},
			categoryID:     "1",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is invalid",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "invalid",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is zero",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "0",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when category ID is negative",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID:     "-1",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					DeleteCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when trying to delete default category",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "123")
			},
			categoryID: "1",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					DeleteCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrDefaultCategoryLocked).
					Times(1)
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should handle large category ID",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "9223372036854775807", // max int64
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					DeleteCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrDataNotFound).
					Times(1)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  true,
		},
		{
			name: "should return error when category is referenced by transactions",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			categoryID: "1",
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					DeleteCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrConflictingData).
					Times(1)
			},
			expectedStatus: http.StatusConflict,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupCategoryTest(t)
			tt.setupMock(mockService)

			router.DELETE("/categories/:id", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.DeleteCategory(ctx)
			})

			url := fmt.Sprintf("/categories/%s", tt.categoryID)
			req, err := http.NewRequest("DELETE", url, nil)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				// Delete operations typically return null data
				assert.Nil(t, response["data"])
			}
		})
	}
}

// Additional edge case tests for breaking the code
func TestCategoryHandler_EdgeCases(t *testing.T) {
	t.Run("should handle concurrent requests gracefully", func(t *testing.T) {
		handler, mockService, router := setupCategoryTest(t)

		// Mock service to handle concurrent calls
		mockService.EXPECT().
			CreateCategory(gomock.Any(), gomock.Any()).
			Return(nil).
			AnyTimes()

		router.POST("/categories", func(ctx *gin.Context) {
			setupAuthContext(ctx, "user123")
			handler.CreateCategory(ctx)
		})

		// Create multiple concurrent requests
		done := make(chan bool)
		for i := 0; i < 10; i++ {
			go func(id int) {
				body, _ := json.Marshal(createCategoryRequest{
					Name:   fmt.Sprintf("Concurrent Category %d", id),
					Budget: float64(id * 100),
				})

				req, _ := http.NewRequest("POST", "/categories", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")

				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				done <- true
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < 10; i++ {
			<-done
		}
	})

	t.Run("should handle extremely long category name", func(t *testing.T) {
		handler, mockService, router := setupCategoryTest(t)

		longName := string(make([]byte, 10000)) // Very long name
		for i := range longName {
			longName = string(rune('a' + (i % 26)))
		}

		mockService.EXPECT().
			CreateCategory(gomock.Any(), gomock.Any()).
			Return(errors.New("category name too long")).
			Times(1)

		router.POST("/categories", func(ctx *gin.Context) {
			setupAuthContext(ctx, "user123")
			handler.CreateCategory(ctx)
		})

		body, _ := json.Marshal(createCategoryRequest{
			Name: longName,
		})

		req, _ := http.NewRequest("POST", "/categories", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("should handle malformed unicode in emoji", func(t *testing.T) {
		handler, mockService, router := setupCategoryTest(t)

		mockService.EXPECT().
			CreateCategory(gomock.Any(), gomock.Any()).
			Return(nil).
			Times(1)

		router.POST("/categories", func(ctx *gin.Context) {
			setupAuthContext(ctx, "user123")
			handler.CreateCategory(ctx)
		})

		// Test with malformed unicode
		body := []byte(`{"name":"Test","emoji":"\uD800"}`) // Invalid unicode

		req, _ := http.NewRequest("POST", "/categories", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should still process the request even with malformed unicode
		assert.True(t, w.Code == http.StatusCreated || w.Code == http.StatusBadRequest)
	})

	t.Run("should handle NaN and Infinity budget values", func(t *testing.T) {
		handler, _, router := setupCategoryTest(t)

		router.POST("/categories", func(ctx *gin.Context) {
			setupAuthContext(ctx, "user123")
			handler.CreateCategory(ctx)
		})

		testCases := []string{
			`{"name":"Test","budget":"NaN"}`,
			`{"name":"Test","budget":"Infinity"}`,
			`{"name":"Test","budget":"-Infinity"}`,
		}

		for _, testCase := range testCases {
			req, _ := http.NewRequest("POST", "/categories", bytes.NewBufferString(testCase))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Should return bad request for invalid number formats
			assert.Equal(t, http.StatusBadRequest, w.Code)
		}
	})

	t.Run("should handle request timeout scenarios", func(t *testing.T) {
		handler, mockService, router := setupCategoryTest(t)

		// Mock service to simulate timeout
		mockService.EXPECT().
			GetCategory(gomock.Any(), gomock.Any(), gomock.Any()).
			DoAndReturn(func(ctx, userID, id interface{}) (*domain.Category, error) {
				// Simulate a timeout scenario
				return nil, errors.New("context deadline exceeded")
			}).
			Times(1)

		router.GET("/categories/:id", func(ctx *gin.Context) {
			setupAuthContext(ctx, "user123")
			handler.GetCategory(ctx)
		})

		req, _ := http.NewRequest("GET", "/categories/1", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// Test helper functions
func TestNewCategoryHandler(t *testing.T) {
	tests := []struct {
		name     string
		service  func() port.CategoryService
		expected bool
	}{
		{
			name: "should create handler successfully when valid service is provided",
			service: func() port.CategoryService {
				ctrl := gomock.NewController(t)
				return mock.NewMockCategoryService(ctrl)
			},
			expected: true,
		},
		{
			name: "should create handler when nil service is provided",
			service: func() port.CategoryService {
				return nil
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewCategoryHandler(tt.service())

			if tt.expected {
				assert.NotNil(t, handler)
			} else {
				assert.Nil(t, handler)
			}
		})
	}
}

func setupCategoryTest(t *testing.T) (*CategoryHandler, *mock.MockCategoryService, *gin.Engine) {
	ctrl := gomock.NewController(t)
	mockService := mock.NewMockCategoryService(ctrl)
	handler := NewCategoryHandler(mockService)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	return handler, mockService, router
}

func setupAuthContext(ctx *gin.Context, userID string) {
	payload := &domain.TokenPayload{
		UserID:   userID,
		Name:     "Test",
		LastName: "User",
		Email:    "test@example.com",
		Verified: true,
		Groups:   map[string]bool{},
		Use:      "id",
	}
	ctx.Set(enums.AuthorizationPayloadKey, payload)
}

func TestCategoryHandler_CreateCategory(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*gin.Context)
		requestBody    interface{}
		setupMock      func(*mock.MockCategoryService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "should create category successfully when valid data is provided",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name:   "Food",
				Budget: 1000.0,
				Emoji:  "🍔",
				Income: false,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					CreateCategory(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx interface{}, category *domain.Category) error {
						// Simulate database assignment of ID
						category.ID = 1
						category.CreatedAt = time.Now()
						category.UpdatedAt = time.Now()
						category.Editable = true
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "should return error when name is empty",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name:   "",
				Budget: 1000.0,
				Emoji:  "🍔",
				Income: false,
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should return error when name is missing",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: map[string]interface{}{
				"budget": 1000.0,
				"emoji":  "🍔",
				"income": false,
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "should create category with minimum required fields",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name: "Minimum Category",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					CreateCategory(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx interface{}, category *domain.Category) error {
						category.ID = 2
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "should return error when user is not authenticated",
			setupAuth: func(ctx *gin.Context) {
				// Don't set any auth context
			},
			requestBody: createCategoryRequest{
				Name:   "Food",
				Budget: 1000.0,
			},
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return error when service fails",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name:   "Food",
				Budget: 1000.0,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					CreateCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrInternal).
					Times(1)
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
		{
			name: "should return conflict error when category name already exists",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name:   "Duplicate Food",
				Budget: 1000.0,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					CreateCategory(gomock.Any(), gomock.Any()).
					Return(domain.ErrConflictingData).
					Times(1)
			},
			expectedStatus: http.StatusConflict,
			expectedError:  true,
		},
		{
			name: "should handle negative budget values",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name:   "Negative Budget",
				Budget: -500.0,
				Emoji:  "💰",
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					CreateCategory(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx interface{}, category *domain.Category) error {
						category.ID = 3
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "should handle extreme budget values",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody: createCategoryRequest{
				Name:   "Extreme Budget",
				Budget: 1e12,
				Income: true,
			},
			setupMock: func(mockSvc *mock.MockCategoryService) {
				mockSvc.EXPECT().
					CreateCategory(gomock.Any(), gomock.Any()).
					DoAndReturn(func(ctx interface{}, category *domain.Category) error {
						category.ID = 4
						return nil
					}).
					Times(1)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "should handle invalid JSON",
			setupAuth: func(ctx *gin.Context) {
				setupAuthContext(ctx, "user123")
			},
			requestBody:    "invalid json",
			setupMock:      func(mockSvc *mock.MockCategoryService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler, mockService, router := setupCategoryTest(t)
			tt.setupMock(mockService)

			router.POST("/categories", func(ctx *gin.Context) {
				tt.setupAuth(ctx)
				handler.CreateCategory(ctx)
			})

			var body []byte
			var err error
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, err = json.Marshal(tt.requestBody)
				assert.NoError(t, err)
			}

			req, err := http.NewRequest("POST", "/categories", bytes.NewBuffer(body))
			assert.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError {
				assert.False(t, response["success"].(bool))
				assert.NotNil(t, response["messages"])
			} else {
				assert.True(t, response["success"].(bool))
				assert.NotNil(t, response["data"])
			}
		})
	}
}
