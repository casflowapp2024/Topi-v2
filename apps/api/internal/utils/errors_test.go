package utils_test

import (
	"cash-flow/internal/utils"
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/stretchr/testify/assert"
)

func TestParseError(t *testing.T) {
	tests := []struct {
		name     string
		input    error
		expected awserr.Error
	}{
		{
			name:     "should return nil when error is nil",
			input:    nil,
			expected: nil,
		},
		{
			name:     "should return awserr.Error when input is awserr.Error",
			input:    awserr.New("Code", "Message", nil),
			expected: awserr.New("Code", "Message", nil),
		},
		{
			name:     "should return nil when input is a standard error",
			input:    errors.New("standard error"),
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ParseError(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
