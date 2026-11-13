DROP TRIGGER IF EXISTS categories_budget_version ON categories;
DROP FUNCTION IF EXISTS category_budget_version();
DROP FUNCTION IF EXISTS user_current_month(VARCHAR);
DROP FUNCTION IF EXISTS budget_at(BIGINT, DATE);
DROP TABLE IF EXISTS category_budgets;
