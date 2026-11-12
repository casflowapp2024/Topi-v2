package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"context"
	"encoding/json"
)

// ProductEventRepository implements port.ProductEventRepository on product_events
type ProductEventRepository struct {
	db *postgres.DB
}

// NewProductEventRepository creates a new ProductEventRepository instance
func NewProductEventRepository(db *postgres.DB) *ProductEventRepository {
	return &ProductEventRepository{db: db}
}

// Record inserts the event (props as a JSON object; the name is checked again by the table)
func (r *ProductEventRepository) Record(ctx context.Context, event domain.ProductEvent) error {
	props := event.Props
	if props == nil {
		props = map[string]any{}
	}
	payload, err := json.Marshal(props)
	if err != nil {
		return err
	}
	if _, err = r.db.Exec(ctx, `INSERT INTO product_events (user_id, name, props) VALUES ($1, $2, $3::jsonb)`,
		event.UserID, event.Name, string(payload)); err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	return nil
}
