package domain

import (
	"testing"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/stretchr/testify/assert"
)

func TestIsSameTransaction(t *testing.T) {
	now := time.Now()
	otherTime := now.Add(time.Hour)

	type args struct {
		current *Transaction
		new     *Transaction
	}

	tests := []struct {
		name     string
		args     args
		expected bool
	}{
		{
			name: "should return true when all fields are equal",
			args: args{
				current: &Transaction{
					Description: "desc",
					Category:    Category{ID: 1},
					Account:     Account{ID: 2},
					Expense:     true,
					Amount:      100.0,
					Date:        now,
					Checked:     true,
				},
				new: &Transaction{
					Description: "desc",
					Category:    Category{ID: 1},
					Account:     Account{ID: 2},
					Expense:     true,
					Amount:      100.0,
					Date:        now,
					Checked:     true,
				},
			},
			expected: true,
		},
		{
			name: "should return false when description is different",
			args: args{
				current: &Transaction{Description: "desc"},
				new:     &Transaction{Description: "other"},
			},
			expected: false,
		},
		{
			name: "should return false when category is different",
			args: args{
				current: &Transaction{Category: Category{ID: 1}},
				new:     &Transaction{Category: Category{ID: 2}},
			},
			expected: false,
		},
		{
			name: "should return false when account is different",
			args: args{
				current: &Transaction{Account: Account{ID: 1}},
				new:     &Transaction{Account: Account{ID: 2}},
			},
			expected: false,
		},
		{
			name: "should return false when expense is different",
			args: args{
				current: &Transaction{Expense: true},
				new:     &Transaction{Expense: false},
			},
			expected: false,
		},
		{
			name: "should return false when amount is different",
			args: args{
				current: &Transaction{Amount: 100.0},
				new:     &Transaction{Amount: 200.0},
			},
			expected: false,
		},
		{
			name: "should return false when date is different",
			args: args{
				current: &Transaction{Date: now},
				new:     &Transaction{Date: otherTime},
			},
			expected: false,
		},
		{
			name: "should return false when checked is different",
			args: args{
				current: &Transaction{Checked: true},
				new:     &Transaction{Checked: false},
			},
			expected: false,
		},
		{
			name: "should return false when current is nil",
			args: args{
				current: nil,
				new:     &Transaction{},
			},
			expected: false,
		},
		{
			name: "should return false when new is nil",
			args: args{
				current: &Transaction{},
				new:     nil,
			},
			expected: false,
		},
		{
			name: "should return false when both are nil",
			args: args{
				current: nil,
				new:     nil,
			},
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var result bool
			if tc.args.current == nil || tc.args.new == nil {
				result = false
			} else {
				result = IsSameTransaction(tc.args.current, tc.args.new)
			}
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestExtractDescriptions(t *testing.T) {
	tests := []struct {
		name         string
		transactions Transactions
		expected     []string
	}{
		{
			name: "should return unique descriptions when all are unique",
			transactions: Transactions{
				{Description: "A"},
				{Description: "B"},
				{Description: "C"},
			},
			expected: []string{"A", "B", "C"},
		},
		{
			name: "should return single description when all are the same",
			transactions: Transactions{
				{Description: "A"},
				{Description: "A"},
				{Description: "A"},
			},
			expected: []string{"A"},
		},
		{
			name: "should skip empty descriptions",
			transactions: Transactions{
				{Description: ""},
				{Description: "A"},
				{Description: ""},
			},
			expected: []string{"A"},
		},
		{
			name: "should return empty slice when all descriptions are empty",
			transactions: Transactions{
				{Description: ""},
				{Description: ""},
			},
			expected: []string{},
		},
		{
			name: "should handle mix of empty and duplicate descriptions",
			transactions: Transactions{
				{Description: ""},
				{Description: "A"},
				{Description: "B"},
				{Description: "A"},
				{Description: ""},
				{Description: "B"},
			},
			expected: []string{"A", "B"},
		},
		{
			name:         "should return empty slice when transactions is empty",
			transactions: Transactions{},
			expected:     []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.transactions.ExtractDescriptions()
			assert.ElementsMatch(t, tc.expected, result)
		})
	}
}

func TestUpdateCategories(t *testing.T) {
	tests := []struct {
		name              string
		transactions      Transactions
		predictionsMap    map[string]uint64
		defaultCategoryID uint64
		expectedIDs       []uint64
	}{
		{
			name: "should update categories when predictions exist",
			transactions: Transactions{
				{Description: "A", Category: Category{ID: 0}},
				{Description: "B", Category: Category{ID: 0}},
			},
			predictionsMap:    map[string]uint64{"A": 1, "B": 2},
			defaultCategoryID: 99,
			expectedIDs:       []uint64{1, 2},
		},
		{
			name: "should set default category when prediction does not exist",
			transactions: Transactions{
				{Description: "C", Category: Category{ID: 0}},
			},
			predictionsMap:    map[string]uint64{"A": 1},
			defaultCategoryID: 99,
			expectedIDs:       []uint64{99},
		},
		{
			name: "should handle mix of predictions and defaults",
			transactions: Transactions{
				{Description: "A", Category: Category{ID: 0}},
				{Description: "C", Category: Category{ID: 0}},
			},
			predictionsMap:    map[string]uint64{"A": 1},
			defaultCategoryID: 99,
			expectedIDs:       []uint64{1, 99},
		},
		{
			name:              "should do nothing when transactions is empty",
			transactions:      Transactions{},
			predictionsMap:    map[string]uint64{"A": 1},
			defaultCategoryID: 99,
			expectedIDs:       []uint64{},
		},
		{
			name: "should handle empty predictions map",
			transactions: Transactions{
				{Description: "A", Category: Category{ID: 0}},
				{Description: "B", Category: Category{ID: 0}},
			},
			predictionsMap:    map[string]uint64{},
			defaultCategoryID: 42,
			expectedIDs:       []uint64{42, 42},
		},
		{
			name: "should handle empty descriptions",
			transactions: Transactions{
				{Description: "", Category: Category{ID: 0}},
			},
			predictionsMap:    map[string]uint64{"": 7},
			defaultCategoryID: 99,
			expectedIDs:       []uint64{7},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tc.transactions.UpdateCategories(tc.predictionsMap, tc.defaultCategoryID)
			actualIDs := make([]uint64, len(tc.transactions))
			for i, tr := range tc.transactions {
				actualIDs[i] = tr.Category.ID
			}
			assert.Equal(t, tc.expectedIDs, actualIDs)
		})
	}
}

func TestApplyTransactionsQueryFilters(t *testing.T) {
	now := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	later := now.Add(24 * time.Hour)
	trueVal := true
	falseVal := false

	tests := []struct {
		name    string
		filters TransactionFilters
		limits  bool
		order   bool
		wantSQL string
	}{
		{
			name: "should add category and account filters when present",
			filters: TransactionFilters{
				Category: []uint64{1, 2},
				Account:  []uint64{3},
			},
			limits:  false,
			order:   false,
			wantSQL: "WHERE t.category_id IN (?,?) AND t.account_id IN (?)",
		},
		{
			name: "should add date filters when present",
			filters: TransactionFilters{
				InitDate: now,
				EndDate:  later,
			},
			limits:  false,
			order:   false,
			wantSQL: "WHERE (t.date + interval '0 hours')::date >= ? AND (t.date + interval '0 hours')::date <= ?",
		},
		{
			name: "should add keyword filter when present",
			filters: TransactionFilters{
				Keyword: "rent",
			},
			limits:  false,
			order:   false,
			wantSQL: "WHERE t.description ILIKE ?",
		},
		{
			name: "should add boolean filters when present",
			filters: TransactionFilters{
				Expense:      &trueVal,
				Automated:    &falseVal,
				ShouldVerify: &trueVal,
				Checked:      &falseVal,
			},
			limits:  false,
			order:   false,
			wantSQL: "WHERE t.expense = ? AND t.automated = ? AND (t.should_verify OR t.needs_counterpart) AND t.checked = ?",
		},
		{
			name:    "should keep only transfers when transfer is true",
			filters: TransactionFilters{Transfer: &trueVal},
			wantSQL: "WHERE t.transfer_group_id IS NOT NULL",
		},
		{
			name:    "should exclude transfers when transfer is false",
			filters: TransactionFilters{Transfer: &falseVal},
			wantSQL: "WHERE t.transfer_group_id IS NULL",
		},
		{
			name: "should add order and limits when enabled",
			filters: TransactionFilters{
				SortBy:    "t.amount",
				SortOrder: "asc",
				Skip:      5,
				Limit:     10,
			},
			limits:  true,
			order:   true,
			wantSQL: "ORDER BY t.amount asc LIMIT 10 OFFSET 5",
		},
		{
			name:    "should use default order when sort fields are empty",
			filters: TransactionFilters{},
			limits:  false,
			order:   true,
			wantSQL: "ORDER BY t.date::date desc, t.created_at desc",
		},
		{
			name:    "should not add anything when filters are empty",
			filters: TransactionFilters{},
			limits:  false,
			order:   false,
			wantSQL: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			query := squirrel.Select("*").From("transactions t")
			result := tc.filters.ApplyTransactionsQueryFilters(query, tc.limits, tc.order)
			sql, _, err := result.ToSql()
			assert.NoError(t, err)
			assert.Contains(t, sql, tc.wantSQL)
		})
	}
}
