package config

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/utils"
	"encoding/json"
	"errors"
	"log"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/secretsmanager"
	"github.com/joho/godotenv"
)

var once sync.Once
var c Configuration

// Configuration contains environment variables for the application, database, cache, token, and Http server
type (
	Configuration struct {
		App     *App
		Token   *Token
		Redis   *Redis
		DB      *DB
		HTTP    *HTTP
		Auth    *Auth
		Social  *Social
		Gmail   *Gmail
		Outlook *Outlook
		Saturn  *Saturn
		SQS     *SQS
	}
	// App contains all the environment variables for the application
	App struct {
		Name     string
		Env      string
		LogLevel string
	}
	// Token contains all the environment variables for the token service
	Token struct {
		Region     string
		UserPoolID string
		ClientID   string
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
	}
	// Auth contains all the environment variables for the authentication service
	Auth struct {
		Region       string
		UserPoolID   string
		ClientID     string
		ClientSecret string
	}
	// Social contains all the environment variables for the social authentication service
	Social struct {
		Auth              Auth
		Http              HTTPClient
		CallBackURL       string
		CallBackMobileURL string
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

	Saturn struct {
		Http HTTPClient
	}

	SQS struct {
		Region   string
		QueueURL string
	}
)

// New creates a new container instance
func New() *Configuration {
	appEnv := os.Getenv("APP_ENV")

	if appEnv == "" {
		err := godotenv.Load(".env.prod")
		if err != nil {
			slog.Error(domain.ErrLoadingEnv.Error(), "error", err)
			panic(domain.ErrLoadingEnv)
		}
	}

	once.Do(func() {
		c = Configuration{
			&App{
				Name:     os.Getenv("APP_NAME"),
				Env:      os.Getenv("APP_ENV"),
				LogLevel: os.Getenv("LOG_LEVEL"),
			},
			&Token{
				Region:     os.Getenv("REGION"),
				UserPoolID: os.Getenv("COGNITO_USER_POOL_ID"),
				ClientID:   os.Getenv("COGNITO_CLIENT_ID"),
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
				Env:            os.Getenv("APP_ENV"),
				URL:            os.Getenv("HTTP_URL"),
				Port:           os.Getenv("HTTP_PORT"),
				AllowedOrigins: os.Getenv("HTTP_ALLOWED_ORIGINS"),
				AllowedHeaders: c.getEnvironmentList("HTTP_ALLOWED_HEADERS"),
			},
			&Auth{
				Region:       os.Getenv("REGION"),
				ClientID:     os.Getenv("COGNITO_CLIENT_ID"),
				ClientSecret: os.Getenv("COGNITO_CLIENT_SECRET"),
				UserPoolID:   os.Getenv("COGNITO_USER_POOL_ID"),
			},
			&Social{
				Auth: Auth{
					Region:       os.Getenv("REGION"),
					ClientID:     os.Getenv("COGNITO_CLIENT_ID"),
					ClientSecret: os.Getenv("COGNITO_CLIENT_SECRET"),
					UserPoolID:   os.Getenv("COGNITO_USER_POOL_ID"),
				},
				Http: HTTPClient{
					URL:     os.Getenv("SOCIAL_AUTH_URL"),
					Timeout: utils.GetTimeDuration(os.Getenv("SOCIAL_AUTH_TIMEOUT")),
				},
				CallBackURL:       os.Getenv("SOCIAL_AUTH_CALLBACK_URL"),
				CallBackMobileURL: os.Getenv("SOCIAL_AUTH_CALLBACK_MOBILE_URL"),
			},
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
			&Saturn{
				Http: HTTPClient{
					URL:     os.Getenv("SATURN_URL"),
					Timeout: utils.GetTimeDuration(os.Getenv("SATURN_TIMEOUT")),
				},
			},
			&SQS{
				Region:   os.Getenv("REGION"),
				QueueURL: os.Getenv("SQS_QUEUE_URL"),
			},
		}
	})

	return &c
}

func (c *Configuration) SetSecrets() error {
	var secretNames = c.getEnvironmentList("SECRETS")
	var region = os.Getenv("REGION")

	for _, secretName := range secretNames {
		variables := c.GetSecrets(secretName, region)
		err := c.SetEnvVariablesSecrets(variables)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *Configuration) GetSecrets(secretName, region string) map[string]interface{} {
	var secrets = map[string]interface{}{}

	sess := session.Must(session.NewSession())
	svc := secretsmanager.New(sess, aws.NewConfig().WithRegion(region))

	result, err := svc.GetSecretValue(&secretsmanager.GetSecretValueInput{SecretId: &secretName})
	if err != nil {
		log.Fatal(err.Error())
	}

	if err = json.Unmarshal([]byte(*result.SecretString), &secrets); err != nil {
		log.Fatal(err.Error())
	}

	return secrets
}

func (c *Configuration) SetEnvVariablesSecrets(secrets map[string]interface{}) error {
	for secret, secretValue := range secrets {
		var value string

		switch secretValue.(type) {
		case string:
			value = secretValue.(string)
		case int:
			value = strconv.Itoa(secretValue.(int))
		case bool:
			value = strconv.FormatBool(secretValue.(bool))
		default:
			return errors.New("invalid secret value type")
		}

		err := os.Setenv(secret, value)
		if err != nil {
			return err
		}
	}
	return nil
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
