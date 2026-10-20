package utils

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

func ParsePgError(err error) string {
	var pgErr *pgconn.PgError

	errors.As(err, &pgErr)
	if pgErr == nil {
		return ""
	}

	return pgErr.Code
}
