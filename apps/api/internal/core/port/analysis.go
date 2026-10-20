package port

import (
	"cash-flow/internal/core/domain"
	"context"
	"time"
)

//go:generate mockgen -source=analysis.go -destination=mock/analysis.go -package=mock

type AnalysisRepository interface {
	// GetFinancialSummary returns the financial report for the given user within the specified time range
	GetFinancialSummary(ctx context.Context, userID string, start time.Time, end time.Time) (domain.FinancialSummary, error)

	// GetBalanceSummary returns the balance summary for the given user within the specified time range
	GetBalanceSummary(
		ctx context.Context,
		userID string,
		start time.Time,
		end time.Time,
		accountTypes []uint64,
		accounts []int64,
	) (domain.BalanceSummary, error)

	// GetBalanceByAccount returns the balance by account for the given user
	GetBalanceByAccount(
		ctx context.Context,
		userID string,
		accountTypes []uint64,
	) ([]domain.BalanceByAccount, error)

	// GetCategoriesReport returns a report of the income and expense categories
	GetCategoriesReport(
		ctx context.Context,
		userID string,
		filter time.Time,
	) (domain.CategoriesReport, error)

	// GetDailyAnalysis populates the Daily field of the provided response for a given date range [start,end]
	GetDailyAnalysis(
		ctx context.Context,
		fr *domain.FinancialResolver,
	)

	// GetMonthlyAnalysis populates the Monthly field of the provided response for a given date range [start,end]
	GetMonthlyAnalysis(
		ctx context.Context,
		fr *domain.FinancialResolver,
	)

	// GetCategoryAnalysis returns the category behavior analysis over time for the given user and category
	GetCategoryAnalysis(
		ctx context.Context,
		userID string,
		categoryID uint64,
		start time.Time,
		end time.Time,
	) (domain.CategoryAnalysis, error)

	// GetAccountAnalysis returns the account behavior analysis over time for the given user and account
	GetAccountAnalysis(
		ctx context.Context,
		userID string,
		accountID uint64,
		start time.Time,
		end time.Time,
	) (domain.AccountAnalysis, error)

	// GetFinancialAccountSummary returns the financial summary for accounts within a specified time range
	GetFinancialAccountSummary(
		ctx context.Context,
		userID string,
		start time.Time,
		end time.Time,
		accountTypes domain.AccountTypes,
		accounts []int64,
	) (domain.FinancialSummary, error)
}

type AnalysisService interface {
	// GetFinancialReport returns the financial monthly report for a given user
	GetFinancialReport(
		ctx context.Context,
		userID string,
		filter time.Time,
	) (domain.FinancialReport, error)

	// GetAccountsBalance returns the balance by account for the given user
	GetAccountsBalance(
		ctx context.Context,
		userID string,
		filter string,
	) ([]domain.BalanceByAccount, error)

	// GetCategoriesExpenseReport returns the category expense report for the given user
	GetCategoriesReport(
		ctx context.Context,
		userID string,
		filter time.Time,
		sortBy *string,
	) (domain.CategoriesReport, error)

	// GetFinancialAnalysis aggregates daily and monthly analysis for a date range
	GetFinancialAnalysis(
		ctx context.Context,
		userID string,
		date string,
	) (domain.FinancialAnalysis, error)

	// GetCategoryAnalysis returns the category behavior analysis over time for the given user and category
	GetCategoryAnalysis(
		ctx context.Context,
		userID string,
		categoryID uint64,
		date string,
	) (domain.CategoryAnalysis, error)

	// GetAccountAnalysis returns the account behavior analysis over time for the given user and account
	GetAccountAnalysis(
		ctx context.Context,
		userID string,
		accountID uint64,
		date string,
	) (domain.AccountAnalysis, error)

	// GetAccountsReport populates the AccountsReport struct for the given user
	GetAccountsReport(
		ctx context.Context,
		report *domain.AccountsReport,
	) error
}
