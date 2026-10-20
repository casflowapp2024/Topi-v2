package domain

import (
	"cash-flow/internal/enums"
	"time"
)

type Category struct {
	ID        uint64    `json:"id" example:"1"`
	UserID    string    `json:"user_id" example:"1"`
	Name      string    `json:"name" example:"Food"`
	Budget    float64   `json:"budget" example:"1000000"`
	Editable  bool      `json:"default" example:"false"`
	Emoji     string    `json:"emoji" example:"🍔"`
	Income    bool      `json:"income" example:"false"`
	CreatedAt time.Time `json:"created_at" example:"2021-01-01T00:00:00Z"`
	UpdatedAt time.Time `json:"updated_at" example:"2021-01-01T00:00:00Z"`
}

func IsSameCategory(actual, expected Category) bool {
	sameName := actual.Name == expected.Name
	sameBudget := actual.Budget == expected.Budget
	sameEmoji := actual.Emoji == expected.Emoji
	sameIncome := actual.Income == expected.Income
	return sameName && sameBudget && sameEmoji && sameIncome
}

func IsEmptyCategory(category Category) bool {
	return category.Name == "" && category.Budget == 0 && category.Emoji == "" && !category.Income
}

func (c *Category) CanUpdateCategory(actual Category) bool {
	diffName := c.Name != actual.Name
	diffIncome := c.Income != actual.Income
	isOtherCategory := actual.Name == enums.OtherCategory

	if c.IsDefault() && (diffName || diffIncome) && isOtherCategory {
		return false
	}

	return true
}

func (c *Category) IsDefault() bool {
	return c.Editable == false
}

func DefaultCategories(userID string) []Category {
	return []Category{
		{
			UserID:   userID,
			Name:     "Otros",
			Budget:   0,
			Emoji:    "1F4E6", // 📦
			Income:   false,
			Editable: false,
		},
	}
}
