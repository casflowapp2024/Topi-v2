package config

import (
	"cash-flow/internal/enums"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNew(t *testing.T) {
	testCases := []struct {
		name        string
		envVars     map[string]string
		validConfig bool
	}{
		{
			name: "should load configuration from environment variables",
			envVars: map[string]string{
				"APP_NAME":             "TestApp",
				"APP_ENV":              "development",
				"JWT_SECRET":           "0123456789abcdef0123456789abcdef",
				"ACCESS_TOKEN_TTL":     "30m",
				"INTERNAL_API_KEY":     "internal-key",
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
			validConfig: true,
		},
		{
			name: "should load without env file and fail validation without JWT_SECRET",
			envVars: map[string]string{
				"APP_NAME": "TestApp",
				"ENV_FILE": filepath.Join(os.TempDir(), "does-not-exist.env"),
			},
			validConfig: false,
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

			assert.Equal(t, tc.envVars["JWT_SECRET"], config.Auth.JWTSecret)
			assert.Equal(t, tc.envVars["INTERNAL_API_KEY"], config.Auth.InternalAPIKey)
			assert.Equal(t, "topi-api", config.Auth.JWTIssuer)
			assert.Equal(t, 720*time.Hour, config.Auth.RefreshTokenTTL)
			assert.Equal(t, 10, config.Auth.RateLimitPerMinute)
			assert.Nil(t, config.Auth.InitialPasswordUntil)
			assert.Equal(t, tc.validConfig, config.Validate() == nil)
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
		"APP_NAME", "APP_ENV", "JWT_SECRET", "JWT_ISSUER", "ACCESS_TOKEN_TTL", "REFRESH_TOKEN_TTL",
		"INITIAL_PASSWORD_UNTIL", "INTERNAL_API_KEY", "RATE_LIMIT_PER_MIN", "TRUSTED_PROXIES", "REDIS_ADDR", "REDIS_PASSWORD", "DB_CONNECTION", "DB_HOST",
		"DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "HTTP_URL", "HTTP_PORT",
		"HTTP_ALLOWED_ORIGINS", "ENV_FILE",
	}
	for _, key := range keys {
		t.Setenv(key, "")
		_ = os.Unsetenv(key)
	}
}

func TestNew_InitialPasswordUntil(t *testing.T) {
	testCases := []struct {
		name     string
		value    string
		expected string
		valid    bool
	}{
		{name: "date is valid until the end of the day (UTC)", value: "2026-12-31", expected: "2026-12-31T23:59:59.999999999Z", valid: true},
		{name: "RFC3339", value: "2026-12-31T23:00:00-05:00", expected: "2026-12-31T23:00:00-05:00", valid: true},
		{name: "invalid value fails validation", value: "31/12/2026", valid: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			clearEnv(t)
			t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
			t.Setenv("INITIAL_PASSWORD_UNTIL", tc.value)
			t.Setenv("ENV_FILE", filepath.Join(t.TempDir(), "none.env"))

			once = sync.Once{}
			config := New()

			if !tc.valid {
				assert.Error(t, config.Validate())
				return
			}

			assert.NoError(t, config.Validate())
			assert.Equal(t, tc.expected, config.Auth.InitialPasswordUntil.Format(time.RFC3339Nano))
		})
	}
}

func TestValidate_ShortJWTSecret(t *testing.T) {
	clearEnv(t)
	t.Setenv("JWT_SECRET", "too-short")
	t.Setenv("ENV_FILE", filepath.Join(t.TempDir(), "none.env"))

	once = sync.Once{}
	assert.ErrorContains(t, New().Validate(), "JWT_SECRET")
}

func TestAppEnv_ProductionAlias(t *testing.T) {
	for value, want := range map[string]string{
		"production": enums.Production, "Production": enums.Production, " production ": enums.Production,
		"prod": enums.Production, "development": "development", "": "",
	} {
		t.Setenv("APP_ENV", value)
		assert.Equal(t, want, appEnv(), "APP_ENV=%q", value)
	}
}
