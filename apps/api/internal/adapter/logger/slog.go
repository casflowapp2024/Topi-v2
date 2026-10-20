package logger

import (
	"cash-flow/internal/adapter/config"
	"log/slog"
	"os"
)

// Logger is the default Logger used by the application
var Logger *Log

type Log struct {
	*slog.Logger
}

// Set sets the logger configuration based on the environment
func Set(config *config.App) {
	if Logger == nil {
		Logger = &Log{}
	}

	var level slog.Level

	switch config.LogLevel {
	case "INFO":
		level = slog.LevelInfo
	case "DEBUG":
		level = slog.LevelDebug
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	// Use JSON handler for CloudWatch compatibility
	Logger.Logger = slog.New(slog.NewJSONHandler(
		os.Stderr,
		&slog.HandlerOptions{Level: level},
	))

	Logger.Info("logger initialized",
		slog.String("log_level", config.LogLevel),
		slog.String("env", config.Env),
	)

	slog.SetDefault(Logger.Logger)
}

// WithField adds a single field to the logger
func (l *Log) WithField(key string, value any) *Log {
	return &Log{l.Logger.With(slog.Any(key, value))}
}

// WithUser adds user context to the logger
func (l *Log) WithUser(userID string) *Log {
	return &Log{l.Logger.With(slog.String("user_id", userID))}
}

// WithRequest adds request context to the logger
func (l *Log) WithRequest(requestID, method, endpoint string) *Log {
	return &Log{l.Logger.With(
		slog.String("request_id", requestID),
		slog.String("method", method),
		slog.String("endpoint", endpoint),
	)}
}

// LogMetric logs a structured metric event for CloudWatch filtering
func (l *Log) LogMetric(status int, err error) {
	args := []any{
		slog.Int("status", status),
	}

	if err != nil {
		args = append(args, slog.String("error", err.Error()))
	}

	// Log metric based on status code (mutually exclusive)
	if status >= 500 {
		args = append(args, slog.String("metric_name", "api.endpoint.error"))
		l.Error("metric", args...)
	} else if status >= 400 {
		args = append(args, slog.String("metric_name", "api.client.error"))
		l.Warn("metric", args...)
	} else {
		args = append(args, slog.String("metric_name", "api.endpoint.request"))
		l.Info("metric", args...)
	}
}
