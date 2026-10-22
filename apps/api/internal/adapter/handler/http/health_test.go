package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthHandler_Health(t *testing.T) {
	gin.SetMode(gin.TestMode)
	lastSeen := time.Date(2026, 10, 22, 11, 0, 0, 0, time.UTC)

	tests := []struct {
		name       string
		health     domain.Health
		wantStatus int
	}{
		{"todo ok", domain.Health{Status: "ok", DB: "ok", Worker: "ok", WorkerLastSeen: &lastSeen}, http.StatusOK},
		{"worker stale sigue en 200", domain.Health{Status: "ok", DB: "ok", Worker: "stale", WorkerLastSeen: &lastSeen}, http.StatusOK},
		{"db caída da 503", domain.Health{Status: "error", DB: "error", Worker: "stale"}, http.StatusServiceUnavailable},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			svc := mock.NewMockHealthService(ctrl)
			svc.EXPECT().Check(gomock.Any()).Return(tc.health)

			router := gin.New()
			router.GET("/health", NewHealthHandler(svc).Health)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))

			assert.Equal(t, tc.wantStatus, w.Code)
			var body map[string]any
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			assert.Equal(t, tc.health.Status, body["status"])
			assert.Equal(t, tc.health.DB, body["db"])
			assert.Equal(t, tc.health.Worker, body["worker"])
			if tc.health.WorkerLastSeen != nil {
				assert.Equal(t, "2026-10-22T11:00:00Z", body["worker_last_seen"])
			} else {
				assert.Nil(t, body["worker_last_seen"])
			}
		})
	}
}
