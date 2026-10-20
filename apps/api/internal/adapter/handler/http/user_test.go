package http

import (
	"bytes"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testTokens = &domain.AuthTokens{
	IdToken:      "jwt",
	AccessToken:  "jwt",
	RefreshToken: "refresh",
	ExpiresIn:    3600,
	TokenType:    "Bearer",
}

// newUserRouter registers the real /users routes with a mocked service
func newUserRouter(t *testing.T) (*gin.Engine, *mock.MockUserService) {
	ctrl := gomock.NewController(t)
	svc := mock.NewMockUserService(ctrl)

	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})
	registerValidators()

	routes := Routes{UserHandler: NewUserHandler(svc), Router: gin.New()}
	routes.UserRoutes()

	return routes.Router, svc
}

func postJSON(router *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestUserHandler_Login(t *testing.T) {
	t.Run("returns the AuthTokens shape in data", func(t *testing.T) {
		router, svc := newUserRouter(t)
		svc.EXPECT().Login(gomock.Any(), "user@example.com", "Password123!", gomock.Any()).Return(testTokens, nil)

		w := postJSON(router, http.MethodPost, "/users/login", loginRequest{Email: "user@example.com", Password: "Password123!"})

		require.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data map[string]any `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, "jwt", body.Data["access_token"])
		assert.Equal(t, "jwt", body.Data["id_token"])
		assert.Equal(t, "refresh", body.Data["refresh_token"])
		assert.Equal(t, float64(3600), body.Data["expires_in"])
		assert.Equal(t, "Bearer", body.Data["token_type"])
	})

	t.Run("keeps the error strings the front compares", func(t *testing.T) {
		cases := []struct {
			err    error
			status int
			text   string
		}{
			{domain.ErrNotAuthorizedException, http.StatusUnauthorized, "user is not authorized, incorrect username or password"},
			{domain.ErrPasswordResetRequiredException, http.StatusForbidden, "user needs to reset the password"},
			{domain.ErrLimitExceededException, http.StatusTooManyRequests, "limit exceeded, too many requests"},
		}

		for _, tc := range cases {
			router, svc := newUserRouter(t)
			svc.EXPECT().Login(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Return(nil, tc.err)

			w := postJSON(router, http.MethodPost, "/users/login", loginRequest{Email: "user@example.com", Password: "Password123!"})

			assert.Equal(t, tc.status, w.Code, tc.text)
			assert.Equal(t, []string{tc.text}, errorMessages(t, w))
		}
	})

	t.Run("passes the client IP to the service", func(t *testing.T) {
		router, svc := newUserRouter(t)
		svc.EXPECT().Login(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ any, _ string, _ string, meta domain.RequestMeta) (*domain.AuthTokens, error) {
				assert.Equal(t, "192.0.2.1", meta.IP)
				return testTokens, nil
			})

		postJSON(router, http.MethodPost, "/users/login", loginRequest{Email: "user@example.com", Password: "Password123!"})
	})
}

func TestUserHandler_Signup(t *testing.T) {
	router, svc := newUserRouter(t)
	svc.EXPECT().Register(gomock.Any(), gomock.Any(), gomock.Any()).Return(testTokens, nil)

	w := postJSON(router, http.MethodPost, "/users/signup", registerRequest{
		Name: "Ana", LastName: "Pérez", Email: "ana@example.com", Password: "Password123!", ConfirmPassword: "Password123!",
	})

	require.Equal(t, http.StatusCreated, w.Code)
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "User created", body.Data["message"], "keeps the previous body")
	assert.Equal(t, "jwt", body.Data["access_token"], "and adds the tokens")
}

func TestUserHandler_SetInitialPassword(t *testing.T) {
	t.Run("ok", func(t *testing.T) {
		router, svc := newUserRouter(t)
		svc.EXPECT().SetInitialPassword(gomock.Any(), "user@example.com", "Password123!", gomock.Any()).Return(testTokens, nil)

		w := postJSON(router, http.MethodPost, "/users/set-initial-password", setInitialPasswordRequest{
			Email: "user@example.com", Password: "Password123!", ConfirmPassword: "Password123!",
		})

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("confirmation mismatch never reaches the service", func(t *testing.T) {
		router, _ := newUserRouter(t)

		w := postJSON(router, http.MethodPost, "/users/set-initial-password", setInitialPasswordRequest{
			Email: "user@example.com", Password: "Password123!", ConfirmPassword: "Password123?",
		})

		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Equal(t, []string{domain.ErrDifferentConfirmPassword.Error()}, errorMessages(t, w))
	})

	t.Run("account that already has a password", func(t *testing.T) {
		router, svc := newUserRouter(t)
		svc.EXPECT().SetInitialPassword(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Return(nil, domain.ErrNotAuthorizedException)

		w := postJSON(router, http.MethodPost, "/users/set-initial-password", setInitialPasswordRequest{
			Email: "user@example.com", Password: "Password123!", ConfirmPassword: "Password123!",
		})

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Equal(t, []string{domain.ErrNotAuthorizedException.Error()}, errorMessages(t, w))
	})
}

func TestUserHandler_RefreshAndLogout(t *testing.T) {
	router, svc := newUserRouter(t)
	svc.EXPECT().Refresh(gomock.Any(), "refresh", gomock.Any()).Return(testTokens, nil)
	svc.EXPECT().Refresh(gomock.Any(), "reused", gomock.Any()).Return(nil, domain.ErrUnauthorized)
	svc.EXPECT().Logout(gomock.Any(), "refresh").Return(nil)

	assert.Equal(t, http.StatusOK, postJSON(router, http.MethodPost, "/users/refresh", refreshTokenRequest{RefreshToken: "refresh"}).Code)
	assert.Equal(t, http.StatusUnauthorized, postJSON(router, http.MethodPost, "/users/refresh", refreshTokenRequest{RefreshToken: "reused"}).Code)
	assert.Equal(t, http.StatusOK, postJSON(router, http.MethodPost, "/users/logout", refreshTokenRequest{RefreshToken: "refresh"}).Code)
	assert.Equal(t, http.StatusBadRequest, postJSON(router, http.MethodPost, "/users/refresh", map[string]string{}).Code)
}

func TestUserHandler_ChangePassword(t *testing.T) {
	router, svc := newUserRouter(t)
	svc.EXPECT().Authorize(gomock.Any(), "jwt").Return(&domain.TokenPayload{UserID: "u1", Groups: map[string]bool{}}, nil)
	svc.EXPECT().ChangePassword(gomock.Any(), "u1", "Password123!", "NewPassword123!", gomock.Any()).Return(testTokens, nil)

	raw, _ := json.Marshal(changePasswordRequest{CurrentPassword: "Password123!", Password: "NewPassword123!", ConfirmPassword: "NewPassword123!"})
	req := httptest.NewRequest(http.MethodPut, "/users/password", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer jwt")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestUserHandler_DeprecatedAndRemovedRoutes(t *testing.T) {
	router, _ := newUserRouter(t)

	// kept as no-op 200
	assert.Equal(t, http.StatusOK, postJSON(router, http.MethodPost, "/users/confirm", map[string]string{"email": "a@b.co", "code": "123456"}).Code)
	assert.Equal(t, http.StatusOK, postJSON(router, http.MethodPost, "/users/resend-confirmation", map[string]string{"email": "a@b.co"}).Code)

	// removed
	assert.Equal(t, http.StatusNotFound, postJSON(router, http.MethodPost, "/users/forgot-password", map[string]string{"email": "a@b.co"}).Code)
	assert.Equal(t, http.StatusNotFound, postJSON(router, http.MethodPut, "/users/forgot-password/confirm", map[string]string{}).Code)
	assert.Equal(t, http.StatusNotFound, postJSON(router, http.MethodGet, "/users/social-auth-url", nil).Code)
}
