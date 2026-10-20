package utils

import (
	"database/sql"
	"reflect"
	"strconv"
	"time"
)

// StringToUint64 is a helper function to convert a string to uint64
func StringToUint64(str string) (uint64, error) {
	num, err := strconv.ParseUint(str, 10, 64)

	return num, err
}

// NullString converts a string to sql.NullString for an empty string check
func NullString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}

	return sql.NullString{
		String: value,
		Valid:  true,
	}
}

// NullPointerString converts a string to sql.NullString for an empty string check
func NullPointerString(value *string) sql.NullString {
	if value == nil || *value == "" {
		return sql.NullString{}
	}

	return sql.NullString{
		String: *value,
		Valid:  true,
	}
}

// NullUint64 converts an uint64 to sql.NullInt64 for empty uint64 check
func NullUint64(value uint64) sql.NullInt64 {
	if value == 0 {
		return sql.NullInt64{}
	}

	valueInt64 := int64(value)

	return sql.NullInt64{
		Int64: valueInt64,
		Valid: true,
	}
}

// NullUint16 converts an uint64 to sql.NullInt16 for an empty uint16 check
func NullUint16(value uint16) sql.NullInt16 {
	if value == 0 {
		return sql.NullInt16{}
	}

	valueInt16 := int16(value)

	return sql.NullInt16{
		Int16: valueInt16,
		Valid: true,
	}
}

// NullPointerUint64 converts an uint64 to sql.NullInt64 for empty uint64 check
func NullPointerUint64(value *uint64) sql.NullInt64 {
	if value == nil || *value == 0 {
		return sql.NullInt64{}
	}

	valueInt64 := int64(*value)

	return sql.NullInt64{
		Int64: valueInt64,
		Valid: true,
	}
}

// NullInt64 converts an int64 to sql.NullInt64 for empty int64 check
func NullInt64(value int64) sql.NullInt64 {
	if value == 0 {
		return sql.NullInt64{}
	}

	return sql.NullInt64{
		Int64: value,
		Valid: true,
	}
}

// NullFloat64 converts a float64 to sql.NullFloat64 for empty float64 check
func NullFloat64(value float64) sql.NullFloat64 {
	if value == 0 {
		return sql.NullFloat64{}
	}

	return sql.NullFloat64{
		Float64: value,
		Valid:   true,
	}
}

// NullDate converts a time.Time to sql.NullTime for empty time.Time check
func NullDate(value time.Time) sql.NullTime {
	if value.IsZero() {
		return sql.NullTime{}
	}

	return sql.NullTime{
		Time:  value,
		Valid: true,
	}
}

func NullBool(value bool) sql.NullBool {
	return sql.NullBool{
		Bool:  value,
		Valid: true,
	}
}

// PrepareQueryArgs flattens slices and combines multiple parameters
// into a single interface slice for SQL query execution.
//
// Any slice type will be flattened, and individual values are passed through directly.
func PrepareQueryArgs(params ...interface{}) []interface{} {
	finalArgs := make([]interface{}, 0)

	for _, param := range params {
		// Use reflection to check if a param is a slice
		paramValue := reflect.ValueOf(param)

		if paramValue.Kind() == reflect.Slice && param != nil {
			// For any slice type, iterate and append individual elements
			for i := 0; i < paramValue.Len(); i++ {
				finalArgs = append(finalArgs, paramValue.Index(i).Interface())
			}
		} else {
			// Handle individual values
			finalArgs = append(finalArgs, param)
		}
	}

	return finalArgs
}
