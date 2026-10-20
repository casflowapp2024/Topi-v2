//go:build integration

package repository_test

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/storage/postgres"
	"context"
	"os"
	"testing"
)

// integrationDB connects to the database in DB_* (skips when DB_HOST is empty) and
// applies pending migrations.
//
//	DB_HOST=localhost DB_PORT=5432 DB_USER=... DB_PASSWORD=... DB_NAME=... \
//	  go test -tags integration ./internal/adapter/storage/postgres/repository/
func integrationDB(t *testing.T) *postgres.DB {
	t.Helper()
	if os.Getenv("DB_HOST") == "" {
		t.Skip("DB_HOST not set")
	}

	db := postgres.New(context.Background(), &config.DB{
		Connection:   "postgres",
		Host:         os.Getenv("DB_HOST"),
		Port:         os.Getenv("DB_PORT"),
		User:         os.Getenv("DB_USER"),
		Password:     os.Getenv("DB_PASSWORD"),
		Name:         os.Getenv("DB_NAME"),
		SslMode:      "disable",
		TimeOut:      "5000",
		MaxOpenConns: 4,
		MaxIdleConns: 1,
	})
	db.Migrate()
	t.Cleanup(db.Close)

	return db
}
