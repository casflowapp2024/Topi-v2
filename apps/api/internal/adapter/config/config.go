package config

import (
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"github.com/shopspring/decimal"
)

var once sync.Once
var c Configuration

// Configuration contains environment variables for the application, database, cache, token, and Http server
type (
	Configuration struct {
		App     *App
		Redis   *Redis
		DB      *DB
		HTTP    *HTTP
		Auth    *Auth
		Gmail   *Gmail
		Outlook *Outlook
		Mail    *Mail
		Metrics *Metrics
	}
	// Metrics contains the settings of the admin panel (plan/25-admin-metricas.md)
	Metrics struct {
		// FounderCutoff: users created before it are founder eligible (nil = nobody is marked yet)
		FounderCutoff *time.Time
		// Prices of the LLM in USD per million tokens (0 = unknown: the panel shows tokens without cost)
		LLMPriceInPerMTok  decimal.Decimal
		LLMPriceOutPerMTok decimal.Decimal
		// ServerMonthlyCostUSD is spread among the active users in the cost per user
		ServerMonthlyCostUSD decimal.Decimal
		err                  error
	}
	// Mail contains the email sending settings (plan/23-correo-transaccional.md)
	Mail struct {
		// Provider is "log" (default: writes to the log, sends nothing) or "resend"
		Provider            string
		ResendAPIKey        string
		ResendWebhookSecret string
		From                string
		ReplyTo             string
		DailyQuota          int
		// OnlyTo is the allow list of recipients; required with resend outside production
		OnlyTo     []string
		AppBaseURL string
		APIBaseURL string
		// OutboxInterval is how often the outbox is processed
		OutboxInterval time.Duration
	}
	// App contains all the environment variables for the application
	App struct {
		Name     string
		Env      string
		LogLevel string
	}
	// Redis contains all the environment variables for the cache service
	Redis struct {
		Addr     string
		Password string
	}
	// DB contains all the environment variables for the database
	DB struct {
		Connection      string
		Host            string
		Port            string
		User            string
		Password        string
		Name            string
		SslMode         string
		TimeOut         string
		MaxOpenConns    int32
		MaxIdleConns    int32
		ConnMaxLifetime time.Duration
	}
	// HTTP contains all the environment variables for the Http server
	HTTP struct {
		Env            string
		URL            string
		Port           string
		AllowedOrigins string
		AllowedHeaders []string
		// TrustedProxies are the proxies allowed to set X-Forwarded-For (empty = none,
		// the client IP is the remote address). Matters for rate limiting.
		TrustedProxies []string
	}
	// Auth contains the environment variables of the own auth (email + password)
	Auth struct {
		JWTSecret       string
		JWTIssuer       string
		AccessTokenTTL  time.Duration
		RefreshTokenTTL time.Duration
		// InitialPasswordUntil closes set-initial-password after this instant (nil = always open)
		InitialPasswordUntil *time.Time
		// InternalAPIKey authenticates the worker with X-API-Key (empty = disabled)
		InternalAPIKey     string
		RateLimitPerMinute int
		initialPasswordErr error
	}
	// HTTPClient contains the Http client and the url
	HTTPClient struct {
		URL     string
		Timeout time.Duration
	}
	Web struct {
		ClientID          string   `json:"client_id"`
		ProjectID         string   `json:"project_id"`
		AuthURI           string   `json:"auth_uri"`
		TokenURI          string   `json:"token_uri"`
		AuthProvider      string   `json:"auth_provider_x509_cert_url"`
		ClientSecret      string   `json:"client_secret"`
		RedirectURIs      []string `json:"redirect_uris"`
		JavaScriptOrigins []string `json:"javascript_origins"`
	}

	Gmail struct {
		Web Web `json:"web"`
	}

	Outlook struct {
		ClientID    string
		SecretID    string
		RedirectURL string
		Scopes      string
		Http        HTTPClient
	}
)

// New creates a new container instance.
// Configuration is read from environment variables only. If a .env file exists
// (or the file pointed by ENV_FILE) it is loaded first without overriding
// variables already present in the environment.
func New() *Configuration {
	loadEnvFile()

	once.Do(func() {
		c = Configuration{
			&App{
				Name:     os.Getenv("APP_NAME"),
				Env:      appEnv(),
				LogLevel: os.Getenv("LOG_LEVEL"),
			},
			&Redis{
				Addr:     os.Getenv("REDIS_ADDR"),
				Password: os.Getenv("REDIS_PASSWORD"),
			},
			&DB{
				Connection:      os.Getenv("DB_CONNECTION"),
				Host:            os.Getenv("DB_HOST"),
				Port:            os.Getenv("DB_PORT"),
				User:            os.Getenv("DB_USER"),
				Password:        os.Getenv("DB_PASSWORD"),
				Name:            os.Getenv("DB_NAME"),
				SslMode:         os.Getenv("DB_SSL_MODE"),
				TimeOut:         "1000",
				MaxOpenConns:    getEnvAsInt32("DB_MAX_OPEN_CONNS", 25),
				MaxIdleConns:    getEnvAsInt32("DB_MAX_IDLE_CONNS", 5),
				ConnMaxLifetime: getEnvAsDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),
			},
			&HTTP{
				Env:            appEnv(),
				URL:            os.Getenv("HTTP_URL"),
				Port:           os.Getenv("HTTP_PORT"),
				AllowedOrigins: os.Getenv("HTTP_ALLOWED_ORIGINS"),
				AllowedHeaders: c.getEnvironmentList("HTTP_ALLOWED_HEADERS"),
				TrustedProxies: getEnvList("TRUSTED_PROXIES"),
			},
			newAuth(),
			&Gmail{
				Web: Web{
					ClientID:          os.Getenv("GMAIL_CLIENT_ID"),
					ProjectID:         os.Getenv("GMAIL_PROJECT_ID"),
					AuthURI:           os.Getenv("GMAIL_AUTH_URI"),
					TokenURI:          os.Getenv("GMAIL_TOKEN_URI"),
					AuthProvider:      os.Getenv("GMAIL_AUTH_PROVIDER"),
					ClientSecret:      os.Getenv("GMAIL_CLIENT_SECRET"),
					RedirectURIs:      strings.Split(os.Getenv("GMAIL_REDIRECT_URIS"), ","),
					JavaScriptOrigins: strings.Split(os.Getenv("GMAIL_JAVASCRIPT_ORIGINS"), ","),
				},
			},
			&Outlook{
				ClientID:    os.Getenv("OUTLOOK_CLIENT_ID"),
				SecretID:    os.Getenv("OUTLOOK_CLIENT_SECRET"),
				RedirectURL: os.Getenv("OUTLOOK_REDIRECT_URL"),
				Scopes:      os.Getenv("OUTLOOK_SCOPES"),
				Http: HTTPClient{
					URL:     os.Getenv("OUTLOOK_LOGIN_URL"),
					Timeout: utils.GetTimeDuration(os.Getenv("OUTLOOK_LOGIN_TIMEOUT")),
				},
			},
			newMail(),
			newMetrics(),
		}
	})

	return &c
}

// loadEnvFile loads ENV_FILE (default ".env") when it exists
func loadEnvFile() {
	path := getEnvOrDefault("ENV_FILE", ".env")

	err := godotenv.Load(path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		slog.Warn("could not load env file", "path", path, "error", err)
	}
}

// minJWTSecretLength is the minimum JWT_SECRET size in bytes (HS256)
const minJWTSecretLength = 32

func newAuth() *Auth {
	auth := &Auth{
		JWTSecret:          os.Getenv("JWT_SECRET"),
		JWTIssuer:          getEnvOrDefault("JWT_ISSUER", "topi-api"),
		AccessTokenTTL:     getEnvAsDuration("ACCESS_TOKEN_TTL", time.Hour),
		RefreshTokenTTL:    getEnvAsDuration("REFRESH_TOKEN_TTL", 720*time.Hour),
		InternalAPIKey:     os.Getenv("INTERNAL_API_KEY"),
		RateLimitPerMinute: int(getEnvAsInt32("RATE_LIMIT_PER_MIN", 10)),
	}

	auth.InitialPasswordUntil, auth.initialPasswordErr = parseDeadline(os.Getenv("INITIAL_PASSWORD_UNTIL"))

	return auth
}

// Mail providers (MAIL_PROVIDER)
const (
	MailProviderLog    = "log"
	MailProviderResend = "resend"
)

func newMail() *Mail {
	return &Mail{
		Provider:            strings.ToLower(getEnvOrDefault("MAIL_PROVIDER", MailProviderLog)),
		ResendAPIKey:        os.Getenv("RESEND_API_KEY"),
		ResendWebhookSecret: os.Getenv("RESEND_WEBHOOK_SECRET"),
		From:                getEnvOrDefault("MAIL_FROM", "Topi <hola@mail.topi.cash>"),
		ReplyTo:             os.Getenv("MAIL_REPLY_TO"),
		DailyQuota:          int(getEnvAsInt32("MAIL_DAILY_QUOTA", 100)),
		OnlyTo:              getEnvList("MAIL_ONLY_TO"),
		AppBaseURL:          strings.TrimRight(getEnvOrDefault("APP_BASE_URL", "http://localhost:3000"), "/"),
		APIBaseURL:          strings.TrimRight(getEnvOrDefault("API_BASE_URL", "http://localhost:8080"), "/"),
		OutboxInterval:      getEnvAsDuration("MAIL_OUTBOX_INTERVAL", 30*time.Second),
	}
}

// validateMail: resend needs its key and, outside production, MAIL_ONLY_TO (privacy)
func (c *Configuration) validateMail() error {
	m := c.Mail
	switch m.Provider {
	case MailProviderLog:
		return nil
	case MailProviderResend:
	default:
		return fmt.Errorf("MAIL_PROVIDER must be %q or %q", MailProviderLog, MailProviderResend)
	}

	if m.ResendAPIKey == "" {
		return errors.New("RESEND_API_KEY is required with MAIL_PROVIDER=resend")
	}
	if m.From == "" || m.AppBaseURL == "" || m.APIBaseURL == "" {
		return errors.New("MAIL_FROM, APP_BASE_URL and API_BASE_URL are required with MAIL_PROVIDER=resend")
	}
	if c.App.Env != enums.Production && len(m.OnlyTo) == 0 {
		return errors.New("MAIL_ONLY_TO is required with MAIL_PROVIDER=resend outside production")
	}
	if m.DailyQuota <= 0 {
		return errors.New("MAIL_DAILY_QUOTA must be positive")
	}

	return nil
}

// Validate checks the settings that must be correct before starting the API
func (c *Configuration) Validate() error {
	if len(c.Auth.JWTSecret) < minJWTSecretLength {
		return fmt.Errorf("JWT_SECRET is required and must have at least %d bytes", minJWTSecretLength)
	}

	if c.Auth.initialPasswordErr != nil {
		return fmt.Errorf("INITIAL_PASSWORD_UNTIL: %w", c.Auth.initialPasswordErr)
	}

	if c.Metrics.err != nil {
		return c.Metrics.err
	}

	return c.validateMail()
}

func newMetrics() *Metrics {
	m := &Metrics{}
	var err error
	m.FounderCutoff, err = parseCutoff(os.Getenv("FOUNDER_CUTOFF"))
	if err != nil {
		m.err = fmt.Errorf("FOUNDER_CUTOFF: %w", err)
		return m
	}
	for key, target := range map[string]*decimal.Decimal{
		"LLM_PRICE_IN_USD_PER_MTOK":  &m.LLMPriceInPerMTok,
		"LLM_PRICE_OUT_USD_PER_MTOK": &m.LLMPriceOutPerMTok,
		"SERVER_MONTHLY_COST_USD":    &m.ServerMonthlyCostUSD,
	} {
		value := strings.TrimSpace(os.Getenv(key))
		if value == "" {
			continue
		}
		parsed, perr := decimal.NewFromString(value)
		if perr != nil || parsed.IsNegative() {
			m.err = fmt.Errorf("%s must be a non negative decimal", key)
			return m
		}
		*target = parsed
	}
	return m
}

// parseCutoff accepts RFC3339 or a date ("2026-11-15" = the start of that day in America/Bogota,
// the day the stage 1 is deployed). Empty = no cutoff.
func parseCutoff(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if cutoff, err := time.Parse(time.RFC3339, value); err == nil {
		return &cutoff, nil
	}
	date, err := time.ParseInLocation(time.DateOnly, value, bogota())
	if err != nil {
		return nil, errors.New("use RFC3339 or YYYY-MM-DD")
	}
	return &date, nil
}

func bogota() *time.Location {
	if loc, err := time.LoadLocation("America/Bogota"); err == nil {
		return loc
	}
	return time.FixedZone("America/Bogota", -5*60*60)
}

// parseDeadline accepts RFC3339 ("2026-12-31T23:59:59-05:00") or a date ("2026-12-31",
// valid until the end of that day in UTC). Empty = no deadline.
func parseDeadline(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	if deadline, err := time.Parse(time.RFC3339, value); err == nil {
		return &deadline, nil
	}

	date, err := time.Parse(time.DateOnly, value)
	if err != nil {
		return nil, errors.New("use RFC3339 or YYYY-MM-DD")
	}

	deadline := date.Add(24*time.Hour - time.Nanosecond)
	return &deadline, nil
}

// appEnv reads APP_ENV; "production" is accepted as an alias of enums.Production ("prod"),
// so Swagger and the other production switches work with either value.
func appEnv() string {
	env := strings.TrimSpace(os.Getenv("APP_ENV"))
	if strings.EqualFold(env, "production") {
		return enums.Production
	}
	return env
}

// getEnvList splits a comma separated variable, ignoring empty items
func getEnvList(key string) []string {
	var values []string
	for _, item := range strings.Split(os.Getenv(key), ",") {
		if item = strings.TrimSpace(item); item != "" {
			values = append(values, item)
		}
	}
	return values
}

func (c *Configuration) getEnvironmentList(key string) []string {
	return strings.Split(os.Getenv(key), ",")
}

// getEnvOrDefault returns the environment variable value or a default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt32 returns the environment variable as int32 or a default if not set or invalid
func getEnvAsInt32(key string, defaultValue int32) int32 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseInt(value, 10, 32); err == nil {
			return int32(parsed)
		}
	}
	return defaultValue
}

// getEnvAsDuration returns the environment variable as time.Duration or a default if not set or invalid
func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if parsed, err := time.ParseDuration(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}
