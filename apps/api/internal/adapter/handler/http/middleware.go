package http

import (
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestIDMiddleware generates a unique request ID for each request
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if request ID already exists in the header
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			// Generate a new UUID if not provided
			requestID = uuid.New().String()
		}

		// Store in context for later retrieval
		c.Set("id", requestID)

		// Set response header
		c.Header("X-Request-ID", requestID)

		c.Next()
	}
}

// AuthMiddleware is a middleware to check if the user is authenticated.
// Internal callers (worker, n8n) can use the X-API-Key header instead of a bearer token:
// they get an admin payload with UserID "service".
func AuthMiddleware(auth port.UserService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if apiKey := ctx.GetHeader(enums.APIKeyHeader); apiKey != "" {
			payload, err := auth.AuthorizeAPIKey(apiKey)
			if err != nil {
				handleAbort(ctx, err)
				return
			}

			ctx.Set(enums.AuthorizationPayloadKey, payload)

			defer logRequestMetricWithPayload(ctx, payload, nil)

			ctx.Next()
			return
		}

		authorizationHeader := ctx.GetHeader(enums.AuthorizationHeaderKey)

		isEmpty := len(authorizationHeader) == 0
		if isEmpty {
			err := domain.ErrEmptyAuthorizationHeader
			handleAbort(ctx, err)
			return
		}

		fields := strings.Fields(authorizationHeader)
		isValid := len(fields) == 2
		if !isValid {
			err := domain.ErrInvalidAuthorizationHeader
			handleAbort(ctx, err)
			return
		}

		currentAuthorizationType := strings.ToLower(fields[0])
		if currentAuthorizationType != enums.AuthorizationType {
			err := domain.ErrInvalidAuthorizationType
			handleAbort(ctx, err)
			return
		}

		token := fields[1]
		if token == "" {
			err := domain.ErrEmptyAccessToken
			handleAbort(ctx, err)
			return
		}

		payload, err := auth.Authorize(ctx, token)
		if err != nil {
			handleAbort(ctx, err)
			return
		}

		ctx.Set(enums.AuthorizationPayloadKey, payload)
		ctx.Set(enums.AuthorizationHeaderKey, authorizationHeader)

		// Defer logging request metric with payload after handler completes
		defer logRequestMetricWithPayload(ctx, payload, err)

		ctx.Next()
	}
}

// AdminMiddleware is a middleware to check if the user is an admin
func AdminMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := domain.GetAuthPayload(ctx, enums.AuthorizationPayloadKey)
		if err != nil {
			handleAbort(ctx, err)
			return
		}

		isAdmin := payload.Groups[enums.AdminRole]
		if !isAdmin {
			err = domain.ErrForbidden
			handleAbort(ctx, err)
			return
		}

		ctx.Next()
	}
}

// logRequestMetric logs structured metrics for a request
// This should be called after authentication to ensure user_id is available
func logRequestMetric(c *gin.Context, userID string, err error) {
	// Get request ID from slog-gin middleware (it uses "id" key)
	requestID, exists := c.Get("id")
	if !exists {
		requestID = "unknown"
	}

	// Get response status
	status := c.Writer.Status()

	// Build logger with context
	requestIDStr, ok := requestID.(string)
	if !ok {
		requestIDStr = "unknown"
	}

	ctxLogger := logger.Logger.WithRequest(requestIDStr, c.Request.Method, c.FullPath())
	if userID != "" {
		ctxLogger = ctxLogger.WithUser(userID)
	}

	ctxLogger.LogMetric(status, err)
}

// logRequestMetricWithPayload logs structured metrics for a request with full payload
// This should be called after authentication to ensure payload is available
func logRequestMetricWithPayload(c *gin.Context, payload *domain.TokenPayload, err error) {
	// Get request ID from slog-gin middleware (it uses "id" key)
	requestID, exists := c.Get("id")
	if !exists {
		requestID = "unknown"
	}

	// Get response status
	status := c.Writer.Status()

	// Build logger with context
	requestIDStr, ok := requestID.(string)
	if !ok {
		requestIDStr = "unknown"
	}

	ctxLogger := logger.Logger.WithRequest(requestIDStr, c.Request.Method, c.FullPath())
	if payload != nil {
		ctxLogger = ctxLogger.WithUser(payload.UserID)
		ctxLogger = ctxLogger.WithField("email", payload.Email)
	}

	ctxLogger.LogMetric(status, err)
}
