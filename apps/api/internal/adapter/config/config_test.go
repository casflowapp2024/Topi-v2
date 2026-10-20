package config

import (
	"cash-flow/internal/core/domain"
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNew(t *testing.T) {
	testCases := []struct {
		name          string
		envVars       map[string]string
		expectedError error
	}{
		{
			name: "should load configuration from environment variables",
			envVars: map[string]string{
				"APP_NAME":             "TestApp",
				"APP_ENV":              "development",
				"REGION":               "us-east-1",
				"USER_POOL_ID":         "us-east-1_123456789",
				"COGNITO_USER_POOL_ID": "123456789",
				"COGNITO_CLIENT_ID":    "123456789",
				"TOKEN_USE":            "access",
				"REDIS_ADDR":           "localhost:6379",
				"REDIS_PASSWORD":       "password",
				"DB_CONNECTION":        "postgres",
				"DB_HOST":              "localhost",
				"DB_PORT":              "5432",
				"DB_USER":              "user",
				"DB_PASSWORD":          "password",
				"DB_NAME":              "testdb",
				"HTTP_URL":             "http://localhost",
				"HTTP_PORT":            "8080",
				"HTTP_ALLOWED_ORIGINS": "*",
			},
			expectedError: nil,
		},
		{
			name: "should panic when environment variables are missing",
			envVars: map[string]string{
				"APP_NAME": "TestApp",
			},
			expectedError: domain.ErrLoadingEnv,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Set environment variables
			for key, value := range tc.envVars {
				err := os.Setenv(key, value)
				if err != nil {
					return
				}
			}

			// Reset the once variable to allow reinitialization
			once = sync.Once{}

			// Capture panic if expected
			defer func() {
				if r := recover(); r != nil {
					assert.Equal(t, tc.expectedError, r)
				}
			}()

			// Call the New function
			config := New()

			// Assert the configuration values
			if tc.expectedError == nil {
				assert.NotNil(t, config)
				assert.Equal(t, tc.envVars["APP_NAME"], config.App.Name)
				assert.Equal(t, tc.envVars["APP_ENV"], config.App.Env)

				assert.Equal(t, tc.envVars["REGION"], config.Token.Region)
				assert.Equal(t, tc.envVars["COGNITO_USER_POOL_ID"], config.Token.UserPoolID)
				assert.Equal(t, tc.envVars["COGNITO_CLIENT_ID"], config.Token.ClientID)

				assert.Equal(t, tc.envVars["REDIS_ADDR"], config.Redis.Addr)
				assert.Equal(t, tc.envVars["REDIS_PASSWORD"], config.Redis.Password)

				assert.Equal(t, tc.envVars["DB_CONNECTION"], config.DB.Connection)
				assert.Equal(t, tc.envVars["DB_HOST"], config.DB.Host)
				assert.Equal(t, tc.envVars["DB_PORT"], config.DB.Port)
				assert.Equal(t, tc.envVars["DB_USER"], config.DB.User)
				assert.Equal(t, tc.envVars["DB_PASSWORD"], config.DB.Password)
				assert.Equal(t, tc.envVars["DB_NAME"], config.DB.Name)

				assert.Equal(t, tc.envVars["HTTP_URL"], config.HTTP.URL)
				assert.Equal(t, tc.envVars["HTTP_PORT"], config.HTTP.Port)
				assert.Equal(t, tc.envVars["HTTP_ALLOWED_ORIGINS"], config.HTTP.AllowedOrigins)

				assert.Equal(t, tc.envVars["REGION"], config.Auth.Region)
				assert.Equal(t, tc.envVars["COGNITO_CLIENT_ID"], config.Auth.ClientID)
				assert.Equal(t, tc.envVars["COGNITO_CLIENT_SECRET"], config.Auth.ClientSecret)
				assert.Equal(t, tc.envVars["COGNITO_USER_POOL_ID"], config.Auth.UserPoolID)

			}
		})
	}
}
