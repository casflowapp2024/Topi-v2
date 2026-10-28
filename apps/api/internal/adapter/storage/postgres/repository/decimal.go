package repository

import (
	"fmt"

	"github.com/shopspring/decimal"
)

// decimalScanner scans a numeric column read as text (col::text) into a *decimal.Decimal
// without going through float64. NULL leaves the destination nil.
type decimalScanner struct {
	dst **decimal.Decimal
}

func scanDecimal(dst **decimal.Decimal) *decimalScanner {
	return &decimalScanner{dst: dst}
}

func (s *decimalScanner) Scan(src any) error {
	var text string
	switch v := src.(type) {
	case nil:
		*s.dst = nil
		return nil
	case string:
		text = v
	case []byte:
		text = string(v)
	default:
		return fmt.Errorf("decimalScanner: unsupported type %T", src)
	}
	d, err := decimal.NewFromString(text)
	if err != nil {
		return err
	}
	*s.dst = &d
	return nil
}

// decimalText is the value to send to a numeric parameter (NULL for nil)
func decimalText(d *decimal.Decimal) *string {
	if d == nil {
		return nil
	}
	s := d.String()
	return &s
}
