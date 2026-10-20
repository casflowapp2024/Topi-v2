package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"context"
	"sync"
	"time"
)

// AnalysisService implements port.AnalysisService interface
type AnalysisService struct {
	repo port.AnalysisRepository
}

// NewAnalysisService creates a new analysis service instance
func NewAnalysisService(repo port.AnalysisRepository) *AnalysisService {
	return &AnalysisService{
		repo: repo,
	}
}

func (as *AnalysisService) GetFinancialReport(
	ctx context.Context,
	userID string,
	filter time.Time,
) (domain.FinancialReport, error) {
	var (
		report             domain.FinancialReport
		financial          domain.FinancialSummary
		savingsBalance     domain.BalanceSummary
		creditsBalance     domain.BalanceSummary
		wg                 sync.WaitGroup
		fErr               error
		bErr               error
		cErr               error
		start, bStart, end = utils.FormatFRDates(filter)
	)

	wg.Add(3)

	go func() {
		defer wg.Done()

		financial, fErr = as.repo.GetFinancialSummary(
			ctx,
			userID,
			start,
			end,
		)
	}()

	go func() {
		defer wg.Done()

		savingsBalance, bErr = as.repo.GetBalanceSummary(
			ctx,
			userID,
			bStart,
			end,
			enums.SavingAndInvestmentTypes,
			nil,
		)
	}()

	go func() {
		defer wg.Done()

		creditsBalance, cErr = as.repo.GetBalanceSummary(
			ctx,
			userID,
			bStart,
			end,
			enums.CreditTypes,
			nil,
		)
	}()

	wg.Wait()

	if fErr != nil {
		return report, fErr
	}

	if bErr != nil {
		return report, bErr
	}

	if cErr != nil {
		return report, cErr
	}

	report.SetFinancialReport(financial, savingsBalance, creditsBalance)

	return report, nil
}

// GetAccountsBalance retrieves the balance for each account of a given user,
// optionally filtered by account types derived from the filter string.
// It concurrently fetches the current balance and the initial balance for each account
// and then combines this information.
//
// Parameters:
//   - ctx: The context for the database operation.
//   - userID: The ID of the user whose account balances are being retrieved.
//   - filter: A string indicating which account types to include (e.g., "savings", "credits", "all").
//
// Returns:
//   - A slice of domain.BalanceByAccount, each containing details and balance for an account.
//   - An error if any underlying repository operation fails.
func (as *AnalysisService) GetAccountsBalance(
	ctx context.Context,
	userID string,
	filter string,
) ([]domain.BalanceByAccount, error) {
	var accountTypes = domain.GetTypesToFilter(filter)

	report, err := as.repo.GetBalanceByAccount(ctx, userID, accountTypes)
	if err != nil {
		return nil, err
	}

	return report, nil
}

func (as *AnalysisService) GetCategoriesReport(
	ctx context.Context,
	userID string,
	filter time.Time,
	sortBy *string,
) (domain.CategoriesReport, error) {
	report, err := as.repo.GetCategoriesReport(ctx, userID, filter)
	if err != nil {
		return domain.CategoriesReport{}, err
	}

	report.SortReport(sortBy)

	report.CalculateFlowReport()

	return report, nil
}

// GetFinancialAnalysis aggregates data from daily and monthly analysis concurrently
func (as *AnalysisService) GetFinancialAnalysis(
	ctx context.Context,
	userID string,
	date string,
) (domain.FinancialAnalysis, error) {
	var (
		wg  sync.WaitGroup
		mu  sync.Mutex
		rsp domain.FinancialAnalysis
	)

	start, end, err := utils.FormatDateTime(date, -11, 0)
	if err != nil {
		return rsp, err
	}

	wg.Add(2)
	fr := domain.NewFinancialResolver(userID, start, end, &rsp, &mu, &wg)

	// Daily analysis
	go as.repo.GetDailyAnalysis(ctx, fr)

	// Monthly analysis
	go as.repo.GetMonthlyAnalysis(ctx, fr)

	wg.Wait()

	if fr.DailyErr != nil {
		return rsp, fr.DailyErr
	}

	if fr.MonthlyErr != nil {
		return rsp, fr.MonthlyErr
	}

	return rsp, nil
}

// GetCategoryAnalysis retrieves the category behavior analysis over time for the given user and category.
// It parses the date string to determine the analysis period and delegates to the repository.
//
// Parameters:
//   - ctx: The context for the operation
//   - userID: The ID of the user whose category analysis is being retrieved
//   - categoryID: The ID of the category to analyze
//   - date: The date string in YYYY-MM format to determine the analysis period
//
// Returns:
//   - domain.CategoryAnalysis containing budget and monthly metrics for the category
//   - An error if the date parsing or repository operation fails
func (as *AnalysisService) GetCategoryAnalysis(
	ctx context.Context,
	userID string,
	categoryID uint64,
	date string,
) (domain.CategoryAnalysis, error) {
	start, end, err := utils.FormatDateTime(date, -11, 1)
	if err != nil {
		return domain.CategoryAnalysis{}, err
	}

	return as.repo.GetCategoryAnalysis(ctx, userID, categoryID, start, end)
}

func (as *AnalysisService) GetAccountsReport(ctx context.Context, report *domain.AccountsReport) error {
	var (
		financial domain.FinancialSummary
		balance   domain.BalanceSummary
		wg        sync.WaitGroup
		fErr      error
		bErr      error
	)

	err := report.ValidateDates()
	if err != nil {
		return err
	}

	report.SetAccountTypeIDs()

	wg.Add(2)

	go func() {
		defer wg.Done()

		financial, fErr = as.repo.GetFinancialAccountSummary(
			ctx,
			report.UserID,
			report.Start,
			report.End,
			report.AccountTypeIDs,
			report.Accounts,
		)
	}()

	go func() {
		defer wg.Done()

		balance, bErr = as.repo.GetBalanceSummary(
			ctx,
			report.UserID,
			report.Start,
			report.End,
			report.AccountTypeIDs,
			report.Accounts,
		)
	}()

	wg.Wait()

	if fErr != nil {
		return fErr
	}

	if bErr != nil {
		return bErr
	}

	report.SetAccountsReport(financial, balance)

	return nil
}

// GetAccountAnalysis retrieves the account behavior analysis over time for the given user and account.
// It parses the date string to determine the analysis period and delegates to the repository.
//
// Parameters:
//   - ctx: The context for the operation
//   - userID: The ID of the user whose account analysis is being retrieved
//   - accountID: The ID of the account to analyze
//   - date: The date string in YYYY-MM format to determine the analysis period
//
// Returns:
//   - domain.AccountAnalysis containing monthly metrics for the account
//   - An error if the date parsing or repository operation fails
func (as *AnalysisService) GetAccountAnalysis(
	ctx context.Context,
	userID string,
	accountID uint64,
	date string,
) (domain.AccountAnalysis, error) {
	start, end, err := utils.FormatDateTime(date, -11, 1)
	if err != nil {
		return domain.AccountAnalysis{}, err
	}

	response, err := as.repo.GetAccountAnalysis(ctx, userID, accountID, start, end)
	if err != nil {
		return domain.AccountAnalysis{}, err
	}

	return response, nil
}
