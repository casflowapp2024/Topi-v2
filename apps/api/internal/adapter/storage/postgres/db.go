//go:build !test

package postgres

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"context"
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"net/url"

	"github.com/Masterminds/squirrel"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// migrationsFS is a filesystem that embeds the migrations folder
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

// DB is a wrapper for a PostgresSQL database connection
// that uses pgxpool as a database driver.
// It also holds a reference to squirrel.StatementBuilderType
// which is used to build SQL queries that are compatible with PostgresSQL syntax
type DB struct {
	*pgxpool.Pool
	QueryBuilder *squirrel.StatementBuilderType
	url          string
}

// New creates a new PostgresSQL database instance
func New(ctx context.Context, config *config.DB) *DB {
	slog.Info("Starting to connect to the database")

	encodedPassword := url.QueryEscape(config.Password)
	pgUrl := fmt.Sprintf("%s://%s:%s@%s:%s/%s?sslmode=%s&statement_timeout=%s",
		config.Connection,
		config.User,
		encodedPassword,
		config.Host,
		config.Port,
		config.Name,
		config.SslMode,
		config.TimeOut,
	)

	// Parse the connection string and configure pool settings
	poolConfig, err := pgxpool.ParseConfig(pgUrl)
	if err != nil {
		slog.Error(domain.ErrInitializingDb.Error(), "error", err)
		panic(domain.ErrInitializingDb)
	}

	// Configure connection pool settings from config
	poolConfig.MaxConns = config.MaxOpenConns
	poolConfig.MinConns = config.MaxIdleConns
	poolConfig.MaxConnLifetime = config.ConnMaxLifetime

	slog.With(
		"max_open_connections", config.MaxOpenConns,
		"max_idle_connections", config.MaxIdleConns,
		"max_life_time", config.ConnMaxLifetime,
	).Debug("connection pool configured")

	db, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		slog.Error(domain.ErrInitializingDb.Error(), "error", err)
		panic(domain.ErrInitializingDb)
	}

	err = db.Ping(ctx)
	if err != nil {
		slog.Error(domain.ErrPingDb.Error(), "error", err)
		panic(domain.ErrPingDb)
	}

	slog.Info("Successfully connected to the database")

	psql := squirrel.StatementBuilder.PlaceholderFormat(squirrel.Dollar)

	return &DB{
		db,
		&psql,
		pgUrl,
	}
}

// Migrate runs the database migration
func (db *DB) Migrate() {
	migrations := db.initMigration()

	err := migrations.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		slog.Error(domain.ErrMigration.Error(), "error", err)
		panic(domain.ErrMigration)
	}
}

// RemoveMigration rolls back to the specified version and forces the version number
func (db *DB) RemoveMigration(targetVersion uint) {
	migrations := db.initMigration()

	// Get current version
	currentVersion, dirty, err := migrations.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		slog.Error("error getting current migration version", "error", err)
		panic(fmt.Errorf("failed to get migration version: %w", err))
	}

	// If dirty, force to the current version first
	if dirty {
		err = migrations.Force(int(currentVersion))
		if err != nil {
			slog.Error("error forcing migration version", "error", err)
			panic(fmt.Errorf("failed to force migration version: %w", err))
		}
	}

	// Only migrate down if the current version is higher than target
	if currentVersion > targetVersion {
		err = migrations.Migrate(targetVersion)
		if err != nil && !errors.Is(err, migrate.ErrNoChange) {
			slog.Error(domain.ErrRemovingMigration.Error(), "error", err)
			panic(domain.ErrRemovingMigration)
		}
	}
}

func (db *DB) initMigration() *migrate.Migrate {
	driver, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		slog.Error(domain.ErrInitializingDriver.Error(), "error", err)
		panic(domain.ErrInitializingDriver)
	}

	migrations, err := migrate.NewWithSourceInstance(enums.MigrationSourceName, driver, db.url)
	if err != nil {
		slog.Error(domain.ErrInstantiatingMigrator.Error(), "error", err)
		panic(domain.ErrInstantiatingMigrator)
	}

	return migrations
}

// ErrorCode returns the error code of the given error
func (db *DB) ErrorCode(err error) string {
	var pgErr *pgconn.PgError

	errors.As(err, &pgErr)
	if pgErr == nil {
		return ""
	}

	return pgErr.Code
}

// Close closes the database connection
func (db *DB) Close() {
	db.Pool.Close()
}
