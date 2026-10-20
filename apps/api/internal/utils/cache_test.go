package utils_test

import (
	"cash-flow/internal/utils"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateCacheKey(t *testing.T) {
	tests := []struct {
		name     string
		prefix   string
		params   any
		expected string
	}{
		{
			name:     "should return correct key for string parameter",
			prefix:   "user",
			params:   "123",
			expected: "user:123",
		},
		{
			name:     "should return correct key for integer parameter",
			prefix:   "order",
			params:   456,
			expected: "order:456",
		},
		{
			name:     "should return correct key for struct parameter",
			prefix:   "payment",
			params:   struct{ ID int }{ID: 789},
			expected: "payment:{789}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.GenerateCacheKey(tt.prefix, tt.params)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGenerateCacheKeyParams(t *testing.T) {
	tests := []struct {
		name     string
		params   []any
		expected string
	}{
		{
			name:     "should return correct key for single string parameter",
			params:   []any{"123"},
			expected: "123",
		},
		{
			name:     "should return correct key for multiple string parameters",
			params:   []any{"123", "456"},
			expected: "123-456",
		},
		{
			name:     "should return correct key for integer parameters",
			params:   []any{123, 456},
			expected: "123-456",
		},
		{
			name:     "should return correct key for mixed parameters",
			params:   []any{"user", 123, "order", 456},
			expected: "user-123-order-456",
		},
		{
			name:     "should return correct key for struct parameter",
			params:   []any{struct{ ID int }{ID: 789}},
			expected: "{789}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.GenerateCacheKeyParams(tt.params...)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSerialize(t *testing.T) {
	tests := []struct {
		name     string
		input    any
		expected string
	}{
		{
			name:     "should serialize a simple struct",
			input:    struct{ Name string }{Name: "test"},
			expected: `{"Name":"test"}`,
		},
		{
			name:     "should serialize a map",
			input:    map[string]int{"one": 1, "two": 2},
			expected: `{"one":1,"two":2}`,
		},
		{
			name:     "should serialize a slice",
			input:    []int{1, 2, 3},
			expected: `[1,2,3]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := utils.Serialize(tt.input)
			assert.NoError(t, err)
			assert.JSONEq(t, tt.expected, string(result))
		})
	}
}

func TestDeserialize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		output   any
		expected any
	}{
		{
			name:     "should deserialize a simple struct",
			input:    `{"Name":"test"}`,
			output:   &struct{ Name string }{},
			expected: &struct{ Name string }{Name: "test"},
		},
		{
			name:     "should deserialize a map",
			input:    `{"one":1,"two":2}`,
			output:   &map[string]int{},
			expected: &map[string]int{"one": 1, "two": 2},
		},
		{
			name:     "should deserialize a slice",
			input:    `[1,2,3]`,
			output:   &[]int{},
			expected: &[]int{1, 2, 3},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := utils.Deserialize([]byte(tt.input), tt.output)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, tt.output)
		})
	}
}
