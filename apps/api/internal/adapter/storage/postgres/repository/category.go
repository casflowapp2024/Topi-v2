package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"time"

	sq "github.com/Masterminds/squirrel"
)

type CategoryRepository struct {
	db *postgres.DB
}

func NewCategoryRepository(db *postgres.DB) *CategoryRepository {
	return &CategoryRepository{
		db,
	}
}

func (cr CategoryRepository) CreateCategory(ctx context.Context, category *domain.Category) error {
	query := cr.db.QueryBuilder.Insert(enums.CategoryTableName).
		Columns("user_id", "name", "budget", "emoji", "income").
		Values(category.UserID, category.Name, category.Budget, category.Emoji, category.Income).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = cr.db.QueryRow(ctx, sql, args...).Scan(
		&category.ID,
		&category.UserID,
		&category.Name,
		&category.Budget,
		&category.Editable,
		&category.Emoji,
		&category.CreatedAt,
		&category.UpdatedAt,
		&category.Income,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (cr CategoryRepository) CreateCategories(ctx context.Context, categories []domain.Category) error {
	query := cr.db.QueryBuilder.Insert(enums.CategoryTableName).
		Columns("user_id", "name", "budget", "is_editable", "emoji", "income")

	for _, category := range categories {
		query = query.Values(
			category.UserID,
			category.Name,
			category.Budget,
			category.Editable,
			category.Emoji,
			category.Income,
		)
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	_, err = cr.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (cr CategoryRepository) GetCategory(ctx context.Context, userID string, id uint64) (*domain.Category, error) {
	var category domain.Category

	query := cr.db.QueryBuilder.Select("*").
		From(enums.CategoryTableName).
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"user_id": userID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = cr.db.QueryRow(ctx, sql, args...).Scan(
		&category.ID,
		&category.UserID,
		&category.Name,
		&category.Budget,
		&category.Editable,
		&category.Emoji,
		&category.CreatedAt,
		&category.UpdatedAt,
		&category.Income,
	)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &category, nil
}

func (cr CategoryRepository) GetCategoryByName(ctx context.Context, userID string, name string) (*domain.Category, error) {
	var category domain.Category

	query := cr.db.QueryBuilder.Select("*").
		From(enums.CategoryTableName).
		Where(sq.Eq{"name": name}).
		Where(sq.Eq{"user_id": userID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	err = cr.db.QueryRow(ctx, sql, args...).Scan(
		&category.ID,
		&category.UserID,
		&category.Name,
		&category.Budget,
		&category.Editable,
		&category.Emoji,
		&category.CreatedAt,
		&category.UpdatedAt,
		&category.Income,
	)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &category, nil
}

func (cr CategoryRepository) GetCategoryList(ctx context.Context, userID string, skip, limit uint64) ([]domain.Category, error) {
	var categories []domain.Category

	query := cr.db.QueryBuilder.Select("*").
		From(enums.CategoryTableName).
		Where(sq.Eq{"user_id": userID}).
		OrderBy("name").
		Limit(limit).
		Offset(skip)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := cr.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var category domain.Category

		err = rows.Scan(
			&category.ID,
			&category.UserID,
			&category.Name,
			&category.Budget,
			&category.Editable,
			&category.Emoji,
			&category.CreatedAt,
			&category.UpdatedAt,
			&category.Income,
		)
		if err != nil {
			return nil, err
		}

		categories = append(categories, category)
	}

	return categories, nil
}

func (cr CategoryRepository) UpdateCategory(ctx context.Context, category *domain.Category) error {
	name := utils.NullString(category.Name)
	emoji := utils.NullString(category.Emoji)

	query := cr.db.QueryBuilder.Update(enums.CategoryTableName).
		Set("name", sq.Expr("COALESCE(?, name)", name)).
		Set("budget", sq.Expr("COALESCE(?, budget)", category.Budget)).
		Set("emoji", sq.Expr("COALESCE(?, emoji)", emoji)).
		Set("income", category.Income).
		Set("updated_at", time.Now()).
		Where(sq.Eq{"id": category.ID}).
		Where(sq.Eq{"user_id": category.UserID}).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = cr.db.QueryRow(ctx, sql, args...).Scan(
		&category.ID,
		&category.UserID,
		&category.Name,
		&category.Budget,
		&category.Editable,
		&category.Emoji,
		&category.CreatedAt,
		&category.UpdatedAt,
		&category.Income,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (cr CategoryRepository) DeleteCategory(ctx context.Context, userID string, id uint64) error {
	query := cr.db.QueryBuilder.Delete(enums.CategoryTableName).
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"user_id": userID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	_, err = cr.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}
