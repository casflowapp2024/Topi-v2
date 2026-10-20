# Changelog

## [1.2.6] - 2026-02-07
- Feature: Admin user accounts by bank.

## [1.2.5] - 2026-01-30
- Feature: Official banks.

## [1.2.4] - 2026-01-30
- Update: dev - main.

## [1.2.3] - 2026-01-06
- Fix: Refactor balance calculation logic to simplify total balance computation and reset expense to zero if greater than zero

## [1.2.0] - 2025-12-31
- Feature: Read email async.

## [1.2.0] - 2025-12-13
- Feature: User extra basic information and sync.

## [1.1.22] - 2025-11-29
- Fix: Enhance expense report query to include account type filtering and adjust expense condition

## [1.1.22] - 2025-11-27
- Feature: Filter metrics

## [1.1.21] - 2025-11-27
- Update: Calculate Initial Balance in financial summary.

## [1.1.20] - 2025-11-24
- Update: Read email endpoint.

## [1.1.19] - 2025-11-17
- Update: Refactor error handling by removing logger calls and implementing centralized logging for handler errors

## [1.1.18] - 2025-11-09
- Feature: Return user id

## [1.1.18] - 2025-11-03
- Fix: Refactor financial summary retrieval to separate credit, investment, savings account types behavior.

## [1.1.18] - 2025-11-03
- Fix: Refactor financial summary retrieval to separate account types and accounts, and update environment variable loading.

## [1.1.17] - 2025-11-03
### Feature
- Feature: Enhance account analysis by adding an account type to metrics and creating utility for integer slice containment.

## [1.1.16] - 2025-11-01
### Feature
- Feature: Accounts Analysis

## [1.1.15] - 2025-10-26
### Feature
- Feature: Accounts Report
- Update: Add logging for financial analysis operations and enhance configuration for logging levels

## [1.1.14] - 2025-10-23
### Update
- Update: Add logging for account and user operations

## [1.1.13] - 2025-10-05
### Update
- Feature: Implement category analysis endpoint
- Update: Financial analysis logic

## [1.1.12] - 2025-10-05
### Update
- Update: Add sorting functionality for a category expense report
- Update: Automatic categorization schedule and add updated at column

## [1.1.11] - 2025-10-04
### Update
- Update: Update isSameTransaction to allow update check field only.

## [1.1.10] - 2025-09-27
### Update
- Update: Automatic transaction categorization.
- Remove categoryID in the transaction admin endpoint.

## [1.1.9] - 2025-09-03
### Update
- Update: update error handling in the transaction service and add unit tests.
- Update: Return created ids for admin-created transactions.

## [1.1.8] - 2025-09-02
### Update
- Remove duplicated account type validation and enhance tests for account methods.

## [1.1.7] - 2025-09-01
### Fix
- Type ID validator in account creation/update.

## [1.1.6] - 2025-08-31
### Fix
- Create emails tag to validate multiple emails from a string.

## [1.1.5] - 2025-08-31
### Update
- Split accounts with banks that have multiple emails in admin get account list.

## [1.1.4] - 2025-08-31
### Update
- Fix transaction ordering to prioritize date and creation time

## [1.1.3] - 2025-08-30
### Update
- Unify financial analysis logics for report and analysis endpoints.

## [1.1.2] - 2025-08-24
### Update
- Refactor financial analysis to use past period values for metrics calculation and update SQL views accordingly P2

## [1.1.1] - 2025-08-24
### Update
- Income, Expense, Savings and Balance metrics analysis P1.

## [1.1.0] - 2025-08-23
### Deprecated
- Deprecate balance history in financial analysis.

## [1.0.6] - 2025-08-22
### Update
- Add transaction logs in handler.

## [1.0.5] - 2025-08-21
### Fix
- Refactor financial analysis calculations and add unit tests for SetMonthlyUsage

## [1.0.4] - 2025-08-21
### Fix
- Remove absolute denominator from the first time report expense percentage to avoid wrong signs.

## [1.0.3] - 2025-08-20
### Updated
- Set the percentage to 100% for a first time report when income or expense is different from 0.

## [1.0.2] - 2025-08-18
### Updated
- Daily no cumulative income and expense.

## [1.0.1] - 2025-08-18
### Updated
- Update financial analysis format response.

## [1.0.0] - 2025-08-17
### Updated
- Set expense as 0 if expense is positive [ECS-77](https://cashflowapp2025.atlassian.net/browse/ECS-77)


<!--
Guidelines:
- Group entries under the headings above.
- Use short, imperative descriptions.
- Reference issue or PR IDs when helpful, for example, (#123).
- Mark breaking changes clearly, for example, BREAKING: description.
- Possible sections:
  - Added: new features
  - Changed: updates to existing features
  - Deprecated: features that will be removed in the future
  - Removed: features that are no longer available
  - Fixed: bug fixes
  - Security: security fixes

Optional sections you can add:
### Performance
### Docs
### Migration
-->

<!-- Compare links: update OWNER/REPO and tags as you release -->
[Unreleased]: https://github.com/OWNER/REPO/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/OWNER/REPO/releases/tag/v1.0.0