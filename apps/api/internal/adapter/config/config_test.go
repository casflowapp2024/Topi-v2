package config

import (
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNew(t *testing.T) {
	testCases := []struct {
		name           string
		envVars        map[string]string
		cognitoEnabled bool
	}{
		{
			name: "should load configuration from environment variables",
			envVars: map[string]string{
				"APP_NAME":             "TestApp",
				"APP_ENV":              "development",
				"REGION":               "us-east-1",
				"COGNITO_USER_POOL_ID": "123456789",
				"COGNITO_CLIENT_ID":    "123456789",
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
			cognitoEnabled: true,
		},
		{
			name: "should start without env file and without cognito settings",
			envVars: map[string]string{
				"APP_NAME": "TestApp",
				"ENV_FILE": filepath.Join(os.TempDir(), "does-not-exist.env"),
			},
			cognitoEnabled: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			clearEnv(t)
			for key, value := range tc.envVars {
				t.Setenv(key, value)
			}

			// Reset the once variable to allow reinitialization
			once = sync.Once{}

			config := New()

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
			assert.Equal(t, tc.cognitoEnabled, config.Auth.Enabled())
		})
	}
}

func TestNew_LoadsEnvFile(t *testing.T) {
	clearEnv(t)

	envFile := filepath.Join(t.TempDir(), "test.env")
	err := os.WriteFile(envFile, []byte("APP_NAME=FromFile\nDB_HOST=db\n"), 0o600)
	assert.NoError(t, err)

	t.Setenv("ENV_FILE", envFile)
	t.Setenv("DB_HOST", "from-env")

	once = sync.Once{}
	config := New()

	assert.Equal(t, "FromFile", config.App.Name)
	// variables already present in the environment win over the file
	assert.Equal(t, "from-env", config.DB.Host)
}

// clearEnv unsets the variables read by New so cases do not leak into each other
func clearEnv(t *testing.T) {
	t.Helper()
	keys := []string{
		"APP_NAME", "APP_ENV", "REGION", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID",
		"COGNITO_CLIENT_SECRET", "REDIS_ADDR", "REDIS_PASSWORD", "DB_CONNECTION", "DB_HOST",
		"DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "HTTP_URL", "HTTP_PORT",
		"HTTP_ALLOWED_ORIGINS", "ENV_FILE",
	}
	for _, key := range keys {
		t.Setenv(key, "")
		_ = os.Unsetenv(key)
	}
}
