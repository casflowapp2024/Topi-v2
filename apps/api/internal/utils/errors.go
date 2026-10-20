package utils

import (
	"errors"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/jackc/pgx/v5/pgconn"
)

func ParseError(err error) awserr.Error {
	if err != nil {
		var awsErr awserr.Error
		if errors.As(err, &awsErr) {
			return awsErr
		}
	}
	return nil
}

func ParsePgError(err error) string {
	var pgErr *pgconn.PgError

	errors.As(err, &pgErr)
	if pgErr == nil {
		return ""
	}

	return pgErr.Code
}
