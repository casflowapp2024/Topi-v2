package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const validPassword = "Password123!"

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

type fakeHasher struct{}

func (fakeHasher) Hash(password string) (string, error) { return "hash:" + password, nil }
func (fakeHasher) Compare(hash, password string) (bool, error) {
	return hash == "hash:"+password, nil
}

type fakeLimiter struct {
	blocked map[string]bool
	keys    []string
}

func (l *fakeLimiter) Allow(key string) bool {
	l.keys = append(l.keys, key)
	return !l.blocked[key]
}

type fakeEvents struct {
	mu     sync.Mutex
	events []domain.AuthEvent
}

func (e *fakeEvents) Record(_ context.Context, event domain.AuthEvent) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.events = append(e.events, event)
	return nil
}

func (e *fakeEvents) names() []string {
	names := make([]string, 0, len(e.events))
	for _, event := range e.events {
		names = append(names, event.Event)
	}
	return names
}

type fakeRefreshStore struct {
	byHash map[string]*domain.RefreshToken
	nextID int64
}

func newFakeRefreshStore() *fakeRefreshStore {
	return &fakeRefreshStore{byHash: map[string]*domain.RefreshToken{}}
}

func (s *fakeRefreshStore) Create(_ context.Context, userID, tokenHash string, expiresAt time.Time) error {
	s.nextID++
	s.byHash[tokenHash] = &domain.RefreshToken{ID: s.nextID, UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt}
	return nil
}

func (s *fakeRefreshStore) GetByHash(_ context.Context, tokenHash string) (*domain.RefreshToken, error) {
	token, ok := s.byHash[tokenHash]
	if !ok {
		return nil, domain.ErrDataNotFound
	}
	copied := *token
	return &copied, nil
}

func (s *fakeRefreshStore) Revoke(_ context.Context, id int64) (bool, error) {
	for _, token := range s.byHash {
		if token.ID == id {
			if token.RevokedAt != nil {
				return false, nil
			}
			now := time.Now()
			token.RevokedAt = &now
			return true, nil
		}
	}
	return false, nil
}

func (s *fakeRefreshStore) RevokeAllForUser(_ context.Context, userID string) error {
	now := time.Now()
	for _, token := range s.byHash {
		if token.UserID == userID && token.RevokedAt == nil {
			token.RevokedAt = &now
		}
	}
	return nil
}

func (s *fakeRefreshStore) active(userID string) int {
	count := 0
	for _, token := range s.byHash {
		if token.UserID == userID && token.RevokedAt == nil {
			count++
		}
	}
	return count
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

type authTestEnv struct {
	svc     *UserService
	repo    *mock.MockUserRepository
	token   *mock.MockTokenRepository
	refresh *fakeRefreshStore
	events  *fakeEvents
	limiter *fakeLimiter
	now     time.Time
}

func newAuthTestEnv(t *testing.T, settings AuthSettings) *authTestEnv {
	ctrl := gomock.NewController(t)

	env := &authTestEnv{
		repo:    mock.NewMockUserRepository(ctrl),
		token:   mock.NewMockTokenRepository(ctrl),
		refresh: newFakeRefreshStore(),
		events:  &fakeEvents{},
		limiter: &fakeLimiter{blocked: map[string]bool{}},
		now:     time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC),
	}

	if settings.RefreshTokenTTL == 0 {
		settings.RefreshTokenTTL = 720 * time.Hour
	}

	env.svc = NewUserService(env.repo, env.token, env.refresh, env.events, fakeHasher{}, env.limiter, settings)
	env.svc.now = func() time.Time { return env.now }

	env.token.EXPECT().GenerateAccessToken(gomock.Any()).Return("access-token", int64(3600), nil).AnyTimes()

	return env
}

func strPtr(value string) *string { return &value }

func migratedUser() *domain.User {
	return &domain.User{ID: "legacy-sub-1", Email: "user@example.com", Role: domain.RoleUser, Migrated: true, Verified: true}
}

func userWithPassword(password string) *domain.User {
	user := migratedUser()
	user.PasswordHash = strPtr("hash:" + password)
	return user
}

var meta = domain.RequestMeta{IP: "10.0.0.1", UserAgent: "test"}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

func TestUserService_Register(t *testing.T) {
	t.Run("creates the user and logs it in", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})

		var created *domain.User
		env.repo.EXPECT().CreateUser(gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, user *domain.User) error {
			created = user
			return nil
		})

		user := &domain.User{Name: "Ana", LastName: "Pérez", Email: "  Ana@Example.COM ", Password: validPassword}
		tokens, err := env.svc.Register(context.Background(), user, meta)

		require.NoError(t, err)
		assert.Equal(t, "ana@example.com", created.Email)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "hash:"+validPassword, *created.PasswordHash)
		assert.Equal(t, domain.RoleUser, created.Role)
		assert.Empty(t, created.Password, "the plain password is not kept")
		assert.Equal(t, "access-token", tokens.AccessToken)
		assert.Equal(t, tokens.AccessToken, tokens.IdToken)
		assert.NotEmpty(t, tokens.RefreshToken)
		assert.Equal(t, 1, env.refresh.active(created.ID))
		assert.Equal(t, []string{domain.EventSignup}, env.events.names())
	})

	t.Run("rejects a password that does not meet the policy", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})

		for _, password := range []string{"short1!", "password123!", "PASSWORD123!", "Password!!!", "Password123"} {
			_, err := env.svc.Register(context.Background(), &domain.User{Email: "a@example.com", Password: password}, meta)
			assert.ErrorIs(t, err, domain.ErrInvalidPasswordException, password)
		}
	})

	t.Run("existing email", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().CreateUser(gomock.Any(), gomock.Any()).Return(domain.ErrUsernameExistsException)

		_, err := env.svc.Register(context.Background(), &domain.User{Email: "a@example.com", Password: validPassword}, meta)
		assert.ErrorIs(t, err, domain.ErrUsernameExistsException)
	})

	t.Run("rate limited", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.limiter.blocked["signup:ip:10.0.0.1"] = true

		_, err := env.svc.Register(context.Background(), &domain.User{Email: "a@example.com", Password: validPassword}, meta)
		assert.ErrorIs(t, err, domain.ErrLimitExceededException)
	})
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

func TestUserService_Login(t *testing.T) {
	t.Run("ok", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(userWithPassword(validPassword), nil)

		tokens, err := env.svc.Login(context.Background(), " USER@example.com", validPassword, meta)

		require.NoError(t, err)
		assert.Equal(t, "access-token", tokens.AccessToken)
		assert.Equal(t, "Bearer", tokens.TokenType)
		assert.Equal(t, []string{domain.EventLoginOK}, env.events.names())
		assert.Contains(t, env.limiter.keys, "login:email:user@example.com")
		assert.Contains(t, env.limiter.keys, "login:ip:10.0.0.1")
	})

	t.Run("wrong password", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(userWithPassword(validPassword), nil)

		_, err := env.svc.Login(context.Background(), "user@example.com", "Wrong123!", meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
		assert.Equal(t, "user is not authorized, incorrect username or password", err.Error())
		assert.Equal(t, []string{domain.EventLoginFail}, env.events.names())
	})

	t.Run("unknown email gives the same error", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "nobody@example.com").Return(nil, domain.ErrUserNotFoundException)

		_, err := env.svc.Login(context.Background(), "nobody@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
	})

	t.Run("account without password must create one", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)

		_, err := env.svc.Login(context.Background(), "user@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrPasswordResetRequiredException)
		assert.Equal(t, "user needs to reset the password", err.Error())
		assert.Equal(t, 0, env.refresh.active("legacy-sub-1"))
	})

	t.Run("rate limited by email", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.limiter.blocked["login:email:user@example.com"] = true

		_, err := env.svc.Login(context.Background(), "user@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrLimitExceededException)
	})
}

// ---------------------------------------------------------------------------
// SetInitialPassword (the most sensitive flow)
// ---------------------------------------------------------------------------

func TestUserService_SetInitialPassword(t *testing.T) {
	ctx := context.Background()

	t.Run("creates the password of a migrated account and logs it in", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)
		env.repo.EXPECT().SetInitialPassword(gomock.Any(), "legacy-sub-1", "hash:"+validPassword).Return(nil)

		tokens, err := env.svc.SetInitialPassword(ctx, " User@Example.com ", validPassword, meta)

		require.NoError(t, err)
		assert.Equal(t, "access-token", tokens.AccessToken)
		assert.Equal(t, 1, env.refresh.active("legacy-sub-1"))
		require.Len(t, env.events.events, 1)
		event := env.events.events[0]
		assert.Equal(t, domain.EventInitialPasswordSet, event.Event)
		assert.Equal(t, "legacy-sub-1", event.UserID)
		assert.Equal(t, "user@example.com", event.Email)
		assert.Equal(t, "10.0.0.1", event.IP)
		assert.Equal(t, "test", event.UserAgent)
	})

	t.Run("fails when the account already has a password", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(userWithPassword("Other123!"), nil)
		// SetInitialPassword must not be called

		_, err := env.svc.SetInitialPassword(ctx, "user@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
		assert.Equal(t, []string{domain.EventInitialPasswordFail}, env.events.names())
		assert.Equal(t, 0, env.refresh.active("legacy-sub-1"))
	})

	t.Run("fails for an unknown email without revealing it", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "nobody@example.com").Return(nil, domain.ErrUserNotFoundException)

		_, err := env.svc.SetInitialPassword(ctx, "nobody@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
		assert.Equal(t, []string{domain.EventInitialPasswordFail}, env.events.names())
	})

	t.Run("fails when INITIAL_PASSWORD_UNTIL already passed", func(t *testing.T) {
		until := time.Date(2026, 10, 19, 23, 59, 59, 0, time.UTC)
		env := newAuthTestEnv(t, AuthSettings{InitialPasswordUntil: &until})
		// no repository call is expected

		_, err := env.svc.SetInitialPassword(ctx, "user@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
		assert.Equal(t, []string{domain.EventInitialPasswordFail}, env.events.names())
	})

	t.Run("works before INITIAL_PASSWORD_UNTIL", func(t *testing.T) {
		until := time.Date(2026, 12, 31, 23, 59, 59, 0, time.UTC)
		env := newAuthTestEnv(t, AuthSettings{InitialPasswordUntil: &until})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)
		env.repo.EXPECT().SetInitialPassword(gomock.Any(), "legacy-sub-1", gomock.Any()).Return(nil)

		_, err := env.svc.SetInitialPassword(ctx, "user@example.com", validPassword, meta)

		assert.NoError(t, err)
	})

	t.Run("loses the race against another request", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)
		env.repo.EXPECT().SetInitialPassword(gomock.Any(), "legacy-sub-1", gomock.Any()).Return(domain.ErrNotAuthorizedException)

		_, err := env.svc.SetInitialPassword(ctx, "user@example.com", validPassword, meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
		assert.Equal(t, []string{domain.EventInitialPasswordFail}, env.events.names())
		assert.Equal(t, 0, env.refresh.active("legacy-sub-1"))
	})

	t.Run("validates the password policy before looking up the account", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})

		_, err := env.svc.SetInitialPassword(ctx, "user@example.com", "weakpassword", meta)

		assert.ErrorIs(t, err, domain.ErrInvalidPasswordException)
	})

	t.Run("rate limited by IP and by email", func(t *testing.T) {
		for _, key := range []string{"initial-password:ip:10.0.0.1", "initial-password:email:user@example.com"} {
			env := newAuthTestEnv(t, AuthSettings{})
			env.limiter.blocked[key] = true

			_, err := env.svc.SetInitialPassword(ctx, "user@example.com", validPassword, meta)

			assert.ErrorIs(t, err, domain.ErrLimitExceededException, key)
			assert.Empty(t, env.events.events)
		}
	})
}

// ---------------------------------------------------------------------------
// Refresh / Logout
// ---------------------------------------------------------------------------

func loginForRefresh(t *testing.T, env *authTestEnv) *domain.AuthTokens {
	env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(userWithPassword(validPassword), nil)
	tokens, err := env.svc.Login(context.Background(), "user@example.com", validPassword, meta)
	require.NoError(t, err)
	return tokens
}

func TestUserService_Refresh(t *testing.T) {
	ctx := context.Background()

	t.Run("rotates the refresh token", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		first := loginForRefresh(t, env)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(userWithPassword(validPassword), nil)

		second, err := env.svc.Refresh(ctx, first.RefreshToken, meta)

		require.NoError(t, err)
		assert.NotEqual(t, first.RefreshToken, second.RefreshToken)
		assert.Equal(t, 1, env.refresh.active("legacy-sub-1"), "the old token is revoked")
	})

	t.Run("reusing a rotated token revokes every session", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		first := loginForRefresh(t, env)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(userWithPassword(validPassword), nil)
		_, err := env.svc.Refresh(ctx, first.RefreshToken, meta)
		require.NoError(t, err)

		_, err = env.svc.Refresh(ctx, first.RefreshToken, meta)

		assert.ErrorIs(t, err, domain.ErrUnauthorized)
		assert.Equal(t, 0, env.refresh.active("legacy-sub-1"))
		assert.Contains(t, env.events.names(), domain.EventRefreshReuse)
	})

	t.Run("expired token", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{RefreshTokenTTL: time.Hour})
		first := loginForRefresh(t, env)
		env.now = env.now.Add(2 * time.Hour)

		_, err := env.svc.Refresh(ctx, first.RefreshToken, meta)

		assert.ErrorIs(t, err, domain.ErrUnauthorized)
	})

	t.Run("unknown token", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})

		_, err := env.svc.Refresh(ctx, "not-a-token", meta)

		assert.ErrorIs(t, err, domain.ErrUnauthorized)
	})

	t.Run("account reset by the admin", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		first := loginForRefresh(t, env)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(migratedUser(), nil)

		_, err := env.svc.Refresh(ctx, first.RefreshToken, meta)

		assert.ErrorIs(t, err, domain.ErrUnauthorized)
	})
}

func TestUserService_Logout(t *testing.T) {
	env := newAuthTestEnv(t, AuthSettings{})
	tokens := loginForRefresh(t, env)

	require.NoError(t, env.svc.Logout(context.Background(), tokens.RefreshToken))
	assert.Equal(t, 0, env.refresh.active("legacy-sub-1"))

	// idempotent, also for unknown tokens
	assert.NoError(t, env.svc.Logout(context.Background(), tokens.RefreshToken))
	assert.NoError(t, env.svc.Logout(context.Background(), "unknown"))

	_, err := env.svc.Refresh(context.Background(), tokens.RefreshToken, meta)
	assert.ErrorIs(t, err, domain.ErrUnauthorized)
}

// ---------------------------------------------------------------------------
// ChangePassword / token_version
// ---------------------------------------------------------------------------

func TestUserService_ChangePassword(t *testing.T) {
	ctx := context.Background()

	t.Run("changes the password, bumps token_version and closes other sessions", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		env := newAuthTestEnv(t, AuthSettings{})
		// tokens issued after the change must carry the new token_version
		token := mock.NewMockTokenRepository(ctrl)
		env.svc.token = token
		env.refresh.Create(ctx, "legacy-sub-1", "other-session", env.now.Add(time.Hour))

		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(userWithPassword(validPassword), nil)
		env.repo.EXPECT().UpdatePassword(gomock.Any(), "legacy-sub-1", "hash:NewPassword123!").Return(1, nil)
		token.EXPECT().GenerateAccessToken(gomock.Any()).DoAndReturn(func(user *domain.User) (string, int64, error) {
			assert.Equal(t, 1, user.TokenVersion)
			return "new-access", int64(3600), nil
		})

		tokens, err := env.svc.ChangePassword(ctx, "legacy-sub-1", validPassword, "NewPassword123!", meta)

		require.NoError(t, err)
		assert.Equal(t, "new-access", tokens.AccessToken)
		stored, _ := env.refresh.GetByHash(ctx, "other-session")
		assert.True(t, stored.IsRevoked())
		assert.Equal(t, 1, env.refresh.active("legacy-sub-1"), "only the new session")
		assert.Equal(t, []string{domain.EventPasswordChanged}, env.events.names())
	})

	t.Run("wrong current password", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(userWithPassword(validPassword), nil)

		_, err := env.svc.ChangePassword(ctx, "legacy-sub-1", "Wrong123!", "NewPassword123!", meta)

		assert.ErrorIs(t, err, domain.ErrNotAuthorizedException)
	})

	t.Run("new password does not meet the policy", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(userWithPassword(validPassword), nil)

		_, err := env.svc.ChangePassword(ctx, "legacy-sub-1", validPassword, "weak", meta)

		assert.ErrorIs(t, err, domain.ErrInvalidPasswordException)
	})
}

func TestUserService_Authorize(t *testing.T) {
	ctx := context.Background()

	t.Run("ok, role comes from the database", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		admin := userWithPassword(validPassword)
		admin.Role = domain.RoleAdmin
		admin.TokenVersion = 2
		env.token.EXPECT().VerifyToken("jwt").Return(&domain.TokenPayload{UserID: "legacy-sub-1", TokenVersion: 2, Use: "access"}, nil)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(admin, nil)

		payload, err := env.svc.Authorize(ctx, "jwt")

		require.NoError(t, err)
		assert.True(t, payload.Groups["admin"])
		assert.Equal(t, "user@example.com", payload.Email)
	})

	t.Run("token_version mismatch is rejected (password changed or reset)", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		user := userWithPassword(validPassword)
		user.TokenVersion = 3
		env.token.EXPECT().VerifyToken("jwt").Return(&domain.TokenPayload{UserID: "legacy-sub-1", TokenVersion: 2}, nil)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "legacy-sub-1").Return(user, nil)

		_, err := env.svc.Authorize(ctx, "jwt")

		assert.ErrorIs(t, err, domain.ErrUnauthorized)
	})

	t.Run("deleted user", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.token.EXPECT().VerifyToken("jwt").Return(&domain.TokenPayload{UserID: "gone"}, nil)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "gone").Return(nil, domain.ErrUserNotFoundException)

		_, err := env.svc.Authorize(ctx, "jwt")

		assert.ErrorIs(t, err, domain.ErrUnauthorized)
	})

	t.Run("invalid token", func(t *testing.T) {
		env := newAuthTestEnv(t, AuthSettings{})
		env.token.EXPECT().VerifyToken("jwt").Return(nil, domain.ErrExpiredToken)

		_, err := env.svc.Authorize(ctx, "jwt")

		assert.ErrorIs(t, err, domain.ErrExpiredToken)
	})
}

func TestUserService_AuthorizeAPIKey(t *testing.T) {
	env := newAuthTestEnv(t, AuthSettings{InternalAPIKey: "internal-secret-key"})

	payload, err := env.svc.AuthorizeAPIKey("internal-secret-key")
	require.NoError(t, err)
	assert.Equal(t, ServiceUserID, payload.UserID)
	assert.True(t, payload.Groups["admin"])
	assert.Equal(t, "access", payload.Use)

	for _, wrong := range []string{"", "internal-secret-ke", "internal-secret-key2", "INTERNAL-SECRET-KEY"} {
		_, err = env.svc.AuthorizeAPIKey(wrong)
		assert.ErrorIs(t, err, domain.ErrUnauthorized, wrong)
	}

	disabled := newAuthTestEnv(t, AuthSettings{})
	_, err = disabled.svc.AuthorizeAPIKey("")
	assert.ErrorIs(t, err, domain.ErrUnauthorized, "no key configured = disabled")
}
