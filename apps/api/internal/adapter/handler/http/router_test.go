package http

import (
	"cash-flow/internal/adapter/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewRouter(t *testing.T) {
	testCases := []struct {
		name          string
		httpConfig    *config.HTTP
		expectedAddr  string
		expectedPanic bool
	}{
		{
			name: "should create router with correct address when config is valid",
			httpConfig: &config.HTTP{
				Env:            "development",
				URL:            "localhost",
				Port:           "8080",
				AllowedOrigins: "http://localhost",
			},
			expectedAddr:  "localhost:8080",
			expectedPanic: false,
		},
		{
			name:          "should panic when config is nil",
			httpConfig:    nil,
			expectedAddr:  "",
			expectedPanic: true,
		},
		{
			name: "should panic when URL is empty",
			httpConfig: &config.HTTP{
				Env:            "development",
				URL:            "",
				Port:           "8080",
				AllowedOrigins: "http://localhost",
			},
			expectedAddr:  "",
			expectedPanic: true,
		},
		{
			name: "should panic when Port is empty",
			httpConfig: &config.HTTP{
				Env:            "development",
				URL:            "http://localhost",
				Port:           "",
				AllowedOrigins: "http://localhost",
			},
			expectedAddr:  "",
			expectedPanic: true,
		},
		{
			name: "should create router with multiple allowed origins",
			httpConfig: &config.HTTP{
				Env:            "development",
				URL:            "localhost",
				Port:           "8080",
				AllowedOrigins: "http://localhost,http://example.com",
			},
			expectedAddr:  "localhost:8080",
			expectedPanic: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.expectedPanic {
				assert.Panics(t, func() {
					NewRouter(tc.httpConfig)
				})
			} else {
				router, addr := NewRouter(tc.httpConfig)
				assert.NotNil(t, router)
				assert.Equal(t, tc.expectedAddr, addr)
			}
		})
	}
}
