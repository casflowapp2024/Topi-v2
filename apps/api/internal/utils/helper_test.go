package utils_test

import (
	"context"
	"database/sql"
	"testing"

	"cash-flow/internal/core/domain"
	"cash-flow/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestStringToUint64(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected uint64
		hasError bool
	}{
		{
			name:     "valid string",
			input:    "123",
			expected: 123,
			hasError: false,
		},
		{
			name:     "invalid string",
			input:    "abc",
			expected: 0,
			hasError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := utils.StringToUint64(tt.input)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestGetAuthPayload(t *testing.T) {
	tests := []struct {
		name     string
		setup    func() *gin.Context
		key      string
		expected *domain.TokenPayload
		hasError bool
	}{
		{
			name: "should return auth payload when it exists",
			setup: func() *gin.Context {
				ctx := &gin.Context{}
				ctx.Set("auth", &domain.TokenPayload{Email: "test@example.com"})
				return ctx
			},
			key:      "auth",
			expected: &domain.TokenPayload{Email: "test@example.com"},
			hasError: false,
		},
		{
			name: "should return error when auth payload does not exist",
			setup: func() *gin.Context {
				return &gin.Context{}
			},
			key:      "auth",
			expected: nil,
			hasError: true,
		},
		{
			name: "should return error when auth payload isn't a TokenPayload",
			setup: func() *gin.Context {
				ctx := &gin.Context{}
				ctx.Set("auth", &domain.User{Email: "test@example.com"})
				return ctx
			},
			key:      "auth",
			expected: nil,
			hasError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setup()
			result, err := domain.GetAuthPayload(ctx, tt.key)

			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestGetAuthToken(t *testing.T) {
	tests := []struct {
		name     string
		setup    func() context.Context
		key      string
		expected string
		hasError bool
	}{
		{
			name: "should return auth token when it exists",
			setup: func() context.Context {
				ctx := context.Background()
				ctx = context.WithValue(ctx, "auth", "Bearer token123")
				return ctx
			},
			key:      "auth",
			expected: "token123",
			hasError: false,
		},
		{
			name: "should return error when auth token is invalid",
			setup: func() context.Context {
				ctx := context.Background()
				ctx = context.WithValue(ctx, "auth", "InvalidToken")
				return ctx
			},
			key:      "auth",
			expected: "",
			hasError: true,
		},
		{
			name: "should return error when auth token is empty",
			setup: func() context.Context {
				return context.Background()
			},
			key:      "auth",
			expected: "",
			hasError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setup()
			result, err := domain.GetAuthToken(ctx, tt.key)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestNullString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected sql.NullString
	}{
		{
			name:     "empty string",
			input:    "",
			expected: sql.NullString{},
		},
		{
			name:  "non-empty string",
			input: "test",
			expected: sql.NullString{
				String: "test",
				Valid:  true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.NullString(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNullUint64(t *testing.T) {
	tests := []struct {
		name     string
		input    uint64
		expected sql.NullInt64
	}{
		{
			name:     "zero value",
			input:    0,
			expected: sql.NullInt64{},
		},
		{
			name:  "non-zero value",
			input: 123,
			expected: sql.NullInt64{
				Int64: 123,
				Valid: true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.NullUint64(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNullInt64(t *testing.T) {
	tests := []struct {
		name     string
		input    int64
		expected sql.NullInt64
	}{
		{
			name:     "zero value",
			input:    0,
			expected: sql.NullInt64{},
		},
		{
			name:  "non-zero value",
			input: 123,
			expected: sql.NullInt64{
				Int64: 123,
				Valid: true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.NullInt64(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNullFloat64(t *testing.T) {
	tests := []struct {
		name     string
		input    float64
		expected sql.NullFloat64
	}{
		{
			name:     "zero value",
			input:    0,
			expected: sql.NullFloat64{},
		},
		{
			name:  "non-zero value",
			input: 123.45,
			expected: sql.NullFloat64{
				Float64: 123.45,
				Valid:   true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.NullFloat64(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestPrepareQueryArgs(t *testing.T) {
	tests := []struct {
		name     string
		params   []interface{}
		expected []interface{}
	}{
		{
			name:     "mix of slices and individual values",
			params:   []interface{}{[]uint64{1, 2, 3}, "user123", []uint64{4, 5}, "date"},
			expected: []interface{}{uint64(1), uint64(2), uint64(3), "user123", uint64(4), uint64(5), "date"},
		},
		{
			name:     "only uint64 slices",
			params:   []interface{}{[]uint64{1, 2}, []uint64{3, 4}},
			expected: []interface{}{uint64(1), uint64(2), uint64(3), uint64(4)},
		},
		{
			name:     "only individual values",
			params:   []interface{}{"user123", uint64(42), "date"},
			expected: []interface{}{"user123", uint64(42), "date"},
		},
		{
			name:     "string slice",
			params:   []interface{}{[]string{"a", "b"}, "c"},
			expected: []interface{}{"a", "b", "c"},
		},
		{
			name:     "interface slice",
			params:   []interface{}{[]interface{}{"x", uint64(1)}, "y"},
			expected: []interface{}{"x", uint64(1), "y"},
		},
		{
			name:     "empty input",
			params:   []interface{}{},
			expected: []interface{}{},
		},
		{
			name:     "empty slices",
			params:   []interface{}{[]uint64{}, []string{}, "value"},
			expected: []interface{}{"value"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.PrepareQueryArgs(tt.params...)
			assert.Equal(t, tt.expected, result)
		})
	}
}
