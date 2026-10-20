package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEmail_SetToken(t *testing.T) {
	tests := []struct {
		name     string
		initial  Email
		input    EmailToken
		expected EmailToken
	}{
		{
			name:    "should set token fields when valid token is provided",
			initial: Email{},
			input: EmailToken{
				Access:  "access123",
				Refresh: "refresh123",
				Type:    "Bearer",
			},
			expected: EmailToken{
				Access:  "access123",
				Refresh: "refresh123",
				Type:    "Bearer",
			},
		},
		{
			name:    "should overwrite existing token fields when new token is set",
			initial: Email{Token: EmailToken{Access: "old", Refresh: "old", Type: "old"}},
			input: EmailToken{
				Access:  "newAccess",
				Refresh: "newRefresh",
				Type:    "newType",
			},
			expected: EmailToken{
				Access:  "newAccess",
				Refresh: "newRefresh",
				Type:    "newType",
			},
		},
		{
			name:    "should set empty token fields when empty token is provided",
			initial: Email{Token: EmailToken{Access: "old", Refresh: "old", Type: "old"}},
			input:   EmailToken{},
			expected: EmailToken{
				Access:  "",
				Refresh: "",
				Type:    "",
			},
		},
		{
			name:    "should handle special characters in token fields",
			initial: Email{},
			input: EmailToken{
				Access:  "!@#$%^&*()",
				Refresh: "[]{}|;:',.<>/?",
				Type:    "`~",
			},
			expected: EmailToken{
				Access:  "!@#$%^&*()",
				Refresh: "[]{}|;:',.<>/?",
				Type:    "`~",
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			email := tc.initial
			email.SetToken(tc.input)
			assert.Equal(t, tc.expected, email.Token)
		})
	}
}

func TestEmail_IsValidRefreshToken(t *testing.T) {
	tests := []struct {
		name     string
		input    EmailToken
		expected bool
	}{
		{
			name:     "should return true when refresh token is non-empty",
			input:    EmailToken{Refresh: "refresh123"},
			expected: true,
		},
		{
			name:     "should return false when refresh token is empty",
			input:    EmailToken{Refresh: ""},
			expected: false,
		},
		{
			name:     "should return true when refresh token contains only spaces",
			input:    EmailToken{Refresh: "   "},
			expected: true,
		},
		{
			name:     "should return true when refresh token contains special characters",
			input:    EmailToken{Refresh: "!@#$%^&*()"},
			expected: true,
		},
		{
			name:     "should return true when refresh token is a very long string",
			input:    EmailToken{Refresh: string(make([]byte, 10000))},
			expected: true,
		},
	}

	email := &Email{}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := email.IsValidRefreshToken(tc.input)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestEmail_IsSameEmail(t *testing.T) {
	tests := []struct {
		name     string
		e        *Email
		actual   *Email
		expected bool
	}{
		{
			name:     "should return false when actual is nil",
			e:        &Email{Active: true, Verify: true},
			actual:   nil,
			expected: false,
		},
		{
			name:     "should return false when receiver is nil",
			e:        nil,
			actual:   &Email{Active: true, Verify: true},
			expected: false,
		},
		{
			name:     "should return true when active matches and verify is true and actual error is nil",
			e:        &Email{Active: true, Verify: true},
			actual:   &Email{Active: true, Error: nil},
			expected: true,
		},
		{
			name:     "should return false when active does not match",
			e:        &Email{Active: true, Verify: true},
			actual:   &Email{Active: false, Error: nil},
			expected: false,
		},
		{
			name:     "should return false when verify is false",
			e:        &Email{Active: true, Verify: false},
			actual:   &Email{Active: true, Error: nil},
			expected: false,
		},
		{
			name:     "should return false when actual error is not nil",
			e:        &Email{Active: true, Verify: true},
			actual:   &Email{Active: true, Error: func() *string { s := "err"; return &s }()},
			expected: false,
		},
		{
			name:     "should return false when both emails are nil",
			e:        nil,
			actual:   nil,
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.e.IsSameEmail(tc.actual)
			assert.Equal(t, tc.expected, result)
		})
	}
}
