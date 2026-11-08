package resend

import (
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSend(t *testing.T) {
	var got request
	var header http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/emails", r.URL.Path)
		header = r.Header.Clone()
		raw, _ := io.ReadAll(r.Body)
		require.NoError(t, json.Unmarshal(raw, &got))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"re_123"}`))
	}))
	defer server.Close()

	id, err := New("re_key", server.URL).Send(context.Background(), domain.EmailMessage{
		To: "a@example.com", From: "Topi <hola@mail.topi.test>", ReplyTo: "soporte@example.com",
		Subject: "Hola", HTML: "<p>h</p>", Text: "h",
		Headers: map[string]string{"List-Unsubscribe": "<https://x>"},
		Tags:    map[string]string{"template": "monthly_summary", "outbox_id": "42"},
	})

	require.NoError(t, err)
	assert.Equal(t, "re_123", id)
	assert.Equal(t, "Bearer re_key", header.Get("Authorization"))
	assert.Equal(t, "topi-outbox-42", header.Get("Idempotency-Key"))
	assert.Equal(t, []string{"a@example.com"}, got.To)
	assert.Equal(t, "soporte@example.com", got.ReplyTo)
	assert.Equal(t, "<https://x>", got.Headers["List-Unsubscribe"])
	assert.Equal(t, []tag{{"outbox_id", "42"}, {"template", "monthly_summary"}}, got.Tags)
}

func TestSendErrors(t *testing.T) {
	testCases := []struct {
		name     string
		status   int
		rejected bool
	}{
		{name: "validation is rejected", status: http.StatusUnprocessableEntity, rejected: true},
		{name: "bad request is rejected", status: http.StatusBadRequest, rejected: true},
		{name: "rate limit is retried", status: http.StatusTooManyRequests},
		{name: "server error is retried", status: http.StatusBadGateway},
		{name: "bad key is retried (fixable in Coolify)", status: http.StatusUnauthorized},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(`{"name":"error","message":"nope"}`))
			}))
			defer server.Close()

			_, err := New("re_key", server.URL).Send(context.Background(), domain.EmailMessage{To: "a@example.com"})

			require.Error(t, err)
			assert.Equal(t, tc.rejected, errors.Is(err, domain.ErrMailRejected))
		})
	}
}
