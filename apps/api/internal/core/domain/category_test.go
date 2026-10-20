package domain

import (
	"cash-flow/internal/enums"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsSameCategory(t *testing.T) {
	tests := []struct {
		name     string
		actual   Category
		expected Category
		want     bool
	}{
		{
			name: "should return true when categories are identical",
			actual: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			expected: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			want: true,
		},
		{
			name: "should return false when names are different",
			actual: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			expected: Category{
				Name:   "Transportation",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			want: false,
		},
		{
			name: "should return false when budgets are different",
			actual: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			expected: Category{
				Name:   "Food",
				Budget: 2000,
				Emoji:  "🍔",
				Income: false,
			},
			want: false,
		},
		{
			name: "should return false when emojis are different",
			actual: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			expected: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍕",
				Income: false,
			},
			want: false,
		},
		{
			name: "should return false when income status is different",
			actual: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			expected: Category{
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: true,
			},
			want: false,
		},
		{
			name: "should return true when only IDs and timestamps are different",
			actual: Category{
				ID:     1,
				UserID: "user1",
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			expected: Category{
				ID:     2,
				UserID: "user2",
				Name:   "Food",
				Budget: 1000,
				Emoji:  "🍔",
				Income: false,
			},
			want: true,
		},
		{
			name: "should return true when categories have empty values but match",
			actual: Category{
				Name:   "",
				Budget: 0,
				Emoji:  "",
				Income: false,
			},
			expected: Category{
				Name:   "",
				Budget: 0,
				Emoji:  "",
				Income: false,
			},
			want: true,
		},
		{
			name: "should handle extreme budget values correctly",
			actual: Category{
				Name:   "Expensive",
				Budget: 1e10,
				Emoji:  "💰",
				Income: true,
			},
			expected: Category{
				Name:   "Expensive",
				Budget: 1e10,
				Emoji:  "💰",
				Income: true,
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsSameCategory(tt.actual, tt.expected)

			assert.Equal(t, tt.want, got)
		})
	}
}

func TestCanUpdateCategory(t *testing.T) {
	tests := []struct {
		name     string
		category Category
		actual   Category
		want     bool
	}{
		{
			name: "should allow update when trying to update only the budget of the default category",
			category: Category{
				Name:   enums.OtherCategory,
				Budget: 1000,
				Income: false,
			},
			actual: Category{
				Name:     enums.OtherCategory,
				Editable: false, // default category
				Budget:   10,
				Income:   false,
			},
			want: true,
		},
		{
			name: "should allow update when category is not default",
			category: Category{
				Name: enums.OtherCategory,
			},
			actual: Category{
				Name: enums.OtherCategory,
			},
			want: true,
		},
		{
			name: "should allow update when changing name of a non-default category",
			category: Category{
				Name:     "OldName",
				Editable: true,
			},
			actual: Category{
				Name:     "NewName",
				Editable: true,
			},
			want: true,
		},
		{
			name: "should allow update when category name is not enums.OtherCategory",
			category: Category{
				Name:   "Transportation",
				Budget: 1000,
			},
			actual: Category{
				Name:   "Transportation",
				Budget: 10,
			},
			want: true,
		},
		{
			name: "should allow update when changing income of a non-default category",
			category: Category{
				Name:     "SomeCategory",
				Editable: true,
				Income:   false,
			},
			actual: Category{
				Name:     "SomeCategory",
				Editable: true,
				Income:   true,
			},
			want: true,
		},
		{
			name: "should not allow update when trying to change the name of the default category",
			category: Category{
				Name:   "NewName",
				Budget: 1000,
				Income: false,
			},
			actual: Category{
				Name:     enums.OtherCategory,
				Editable: false, // default category
				Budget:   1000,
				Income:   false,
			},
			want: false,
		},
		{
			name: "should not allow update when trying to change the income status of the default category",
			category: Category{
				Name:   enums.OtherCategory,
				Budget: 1000,
				Income: true,
			},
			actual: Category{
				Name:     enums.OtherCategory,
				Editable: false, // default category
				Budget:   1000,
				Income:   false,
			},
			want: false,
		},
		{
			name: "should not allow update when changing both name and income of the default category",
			category: Category{
				Name:     "Other",
				Editable: false,
				Income:   false,
			},
			actual: Category{
				Name:     enums.OtherCategory,
				Editable: false,
				Income:   true,
			},
			want: false,
		},
		{
			name: "should allow update when changing only the emoji of the default category",
			category: Category{
				Name:     enums.OtherCategory,
				Editable: false,
				Emoji:    "📦",
			},
			actual: Category{
				Name:     enums.OtherCategory,
				Editable: false,
				Emoji:    "📬",
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.category.CanUpdateCategory(tt.actual)
			assert.Equal(t, tt.want, got)
		})
	}
}
