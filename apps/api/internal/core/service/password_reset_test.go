package service

import (
	"cash-flow/internal/core/domain"
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

type fakeCodes struct {
	mu    sync.Mutex
	codes []*domain.AuthCode
	seq   int64
	now   func() time.Time
}

func (f *fakeCodes) Create(_ context.Context, userID, purpose, codeHash string, expiresAt time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	now := f.now()
	for _, c := range f.codes {
		if c.UserID == userID && c.Purpose == purpose && c.UsedAt == nil {
			c.UsedAt = &now
		}
	}
	f.seq++
	f.codes = append(f.codes, &domain.AuthCode{ID: f.seq, UserID: userID, Purpose: purpose, CodeHash: codeHash,
		ExpiresAt: expiresAt, CreatedAt: now})
	return nil
}

func (f *fakeCodes) GetLatest(_ context.Context, userID, purpose string) (*domain.AuthCode, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := len(f.codes) - 1; i >= 0; i-- {
		c := f.codes[i]
		if c.UserID == userID && c.Purpose == purpose && c.UsedAt == nil {
			copy := *c
			return &copy, nil
		}
	}
	return nil, domain.ErrDataNotFound
}

func (f *fakeCodes) IncrementAttempts(_ context.Context, id int64) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.codes {
		if c.ID == id {
			c.Attempts++
			return c.Attempts, nil
		}
	}
	return 0, domain.ErrDataNotFound
}

func (f *fakeCodes) MarkUsed(_ context.Context, id int64) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.codes {
		if c.ID == id && c.UsedAt == nil {
			now := f.now()
			c.UsedAt = &now
			return true, nil
		}
	}
	return false, nil
}

// fakeMailService records what would be sent
type fakeMailService struct {
	mu      sync.Mutex
	secrets []sentSecret
	queued  []domain.OutboxEmail
}

type sentSecret struct {
	email  domain.OutboxEmail
	secret map[string]any
}

func (m *fakeMailService) Enqueue(_ context.Context, email domain.OutboxEmail) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.queued = append(m.queued, email)
	return int64(len(m.queued)), nil
}

func (m *fakeMailService) SendSecret(_ context.Context, email domain.OutboxEmail, secret map[string]any) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.secrets = append(m.secrets, sentSecret{email: email, secret: secret})
	return nil
}

func (m *fakeMailService) ProcessOnce(context.Context) (int, error)            { return 0, nil }
func (m *fakeMailService) HandleEvent(context.Context, domain.MailEvent) error { return nil }
func (m *fakeMailService) Run(context.Context, time.Duration)                  {}

func (m *fakeMailService) lastCode(t *testing.T) string {
	t.Helper()
	m.mu.Lock()
	defer m.mu.Unlock()
	require.NotEmpty(t, m.secrets, "no code was sent")
	return m.secrets[len(m.secrets)-1].secret["code"].(string)
}

type resetEnv struct {
	*authTestEnv
	codes       *fakeCodes
	mail        *fakeMailService
	codeLimiter *fakeLimiter
}

func newResetEnv(t *testing.T) *resetEnv {
	env := &resetEnv{authTestEnv: newAuthTestEnv(t, AuthSettings{}), mail: &fakeMailService{},
		codeLimiter: &fakeLimiter{blocked: map[string]bool{}}}
	env.codes = &fakeCodes{now: func() time.Time { return env.now }}
	env.svc.SetMail(env.mail, env.codes, env.codeLimiter)
	return env
}

// forgot asks for a code for user@example.com (an account without password) and returns it
func (env *resetEnv) forgot(t *testing.T, user *domain.User) string {
	t.Helper()
	env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(user, nil)
	require.NoError(t, env.svc.ForgotPassword(context.Background(), "User@Example.com", meta))
	return env.mail.lastCode(t)
}

const newPassword = "Nueva123!"

// ---------------------------------------------------------------------------
// ForgotPassword
// ---------------------------------------------------------------------------

func TestUserService_ForgotPassword(t *testing.T) {
	t.Run("sends a 6 digit code by email, stores only its hash", func(t *testing.T) {
		env := newResetEnv(t)
		code := env.forgot(t, migratedUser())

		assert.Regexp(t, `^\d{6}$`, code)
		sent := env.mail.secrets[0]
		assert.Equal(t, "user@example.com", sent.email.To)
		assert.Equal(t, domain.TemplatePasswordCode, sent.email.Template)
		assert.Equal(t, "legacy-sub-1", *sent.email.UserID)
		assert.NotContains(t, string(sent.email.Payload), code, "the code is not in the outbox payload")
		var payload map[string]any
		require.NoError(t, json.Unmarshal(sent.email.Payload, &payload))
		assert.Equal(t, float64(10), payload["minutes"])

		require.Len(t, env.codes.codes, 1)
		assert.Equal(t, "hash:"+code, env.codes.codes[0].CodeHash)
		assert.Equal(t, env.now.Add(10*time.Minute), env.codes.codes[0].ExpiresAt)
		assert.Equal(t, []string{domain.EventResetRequested}, env.events.names())
	})

	t.Run("unknown email: same answer and nothing is sent", func(t *testing.T) {
		env := newResetEnv(t)
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "nobody@example.com").Return(nil, domain.ErrUserNotFoundException)

		err := env.svc.ForgotPassword(context.Background(), "nobody@example.com", meta)

		assert.NoError(t, err)
		assert.Empty(t, env.mail.secrets)
		assert.Empty(t, env.codes.codes)
	})

	t.Run("limited per email and per IP", func(t *testing.T) {
		env := newResetEnv(t)
		env.codeLimiter.blocked["forgot:code:user@example.com"] = true
		err := env.svc.ForgotPassword(context.Background(), "user@example.com", meta)
		assert.ErrorIs(t, err, domain.ErrLimitExceededException)

		env = newResetEnv(t)
		env.limiter.blocked["forgot:ip:10.0.0.1"] = true
		err = env.svc.ForgotPassword(context.Background(), "nobody@example.com", meta)
		assert.ErrorIs(t, err, domain.ErrLimitExceededException, "the limit applies whether the email exists or not")
		assert.Empty(t, env.mail.secrets)
	})

	t.Run("a new code invalidates the previous one", func(t *testing.T) {
		env := newResetEnv(t)
		first := env.forgot(t, migratedUser())
		second := env.forgot(t, migratedUser())
		if first == second {
			t.Skip("same random code twice")
		}

		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)
		_, err := env.svc.ResetPassword(context.Background(), "user@example.com", first, newPassword, meta)
		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
	})
}

// ---------------------------------------------------------------------------
// ResetPassword
// ---------------------------------------------------------------------------

func TestUserService_ResetPassword(t *testing.T) {
	ctx := context.Background()

	t.Run("a user without password creates one with the code and is logged in", func(t *testing.T) {
		env := newResetEnv(t)
		user := migratedUser()
		code := env.forgot(t, user)
		env.refresh.byHash["old"] = &domain.RefreshToken{ID: 99, UserID: user.ID, TokenHash: "old"}

		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(user, nil)
		env.repo.EXPECT().UpdatePassword(gomock.Any(), "legacy-sub-1", "hash:"+newPassword).Return(3, nil)
		env.repo.EXPECT().MarkEmailVerified(gomock.Any(), "legacy-sub-1").Return(nil)

		tokens, err := env.svc.ResetPassword(ctx, " USER@example.com", code, newPassword, meta)

		require.NoError(t, err)
		assert.Equal(t, "access-token", tokens.AccessToken)
		assert.NotNil(t, env.refresh.byHash["old"].RevokedAt, "old sessions are closed")
		assert.Equal(t, 1, env.refresh.active("legacy-sub-1"), "only the new session")
		assert.Equal(t, []string{domain.EventResetRequested, domain.EventResetOK}, env.events.names())

		// the code cannot be used twice
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(user, nil)
		_, err = env.svc.ResetPassword(ctx, "user@example.com", code, newPassword, meta)
		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
	})

	t.Run("token_version goes up so old access tokens stop working", func(t *testing.T) {
		env := newResetEnv(t)
		user := userWithPassword(validPassword)
		verified := env.now
		user.EmailVerifiedAt = &verified
		code := env.forgot(t, user)

		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(user, nil)
		env.repo.EXPECT().UpdatePassword(gomock.Any(), user.ID, gomock.Any()).Return(7, nil)

		tokens, err := env.svc.ResetPassword(ctx, "user@example.com", code, newPassword, meta)
		require.NoError(t, err)
		require.NotNil(t, tokens)
		assert.Equal(t, 7, user.TokenVersion, "the new tokens carry the new version")
		// already verified: MarkEmailVerified is not called (gomock fails on unexpected calls)
	})

	t.Run("wrong code", func(t *testing.T) {
		env := newResetEnv(t)
		code := env.forgot(t, migratedUser())
		wrong := "000000"
		if code == wrong {
			wrong = "111111"
		}

		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)
		_, err := env.svc.ResetPassword(ctx, "user@example.com", wrong, newPassword, meta)

		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
		assert.Equal(t, "invalid verification code provided", err.Error())
		assert.Contains(t, env.events.names(), domain.EventResetFail)
	})

	t.Run("expires after 10 minutes", func(t *testing.T) {
		env := newResetEnv(t)
		code := env.forgot(t, migratedUser())
		env.now = env.now.Add(10 * time.Minute)

		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)
		_, err := env.svc.ResetPassword(ctx, "user@example.com", code, newPassword, meta)

		assert.ErrorIs(t, err, domain.ErrExpiredCodeException)
	})

	t.Run("5 attempts, then even the right code is refused", func(t *testing.T) {
		env := newResetEnv(t)
		code := env.forgot(t, migratedUser())
		wrong := "000000"
		if code == wrong {
			wrong = "111111"
		}

		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil).Times(6)
		for i := 1; i <= 4; i++ {
			_, err := env.svc.ResetPassword(ctx, "user@example.com", wrong, newPassword, meta)
			assert.ErrorIs(t, err, domain.ErrCodeMismatchException, "attempt %d", i)
		}
		_, err := env.svc.ResetPassword(ctx, "user@example.com", wrong, newPassword, meta)
		assert.ErrorIs(t, err, domain.ErrExpiredCodeException, "the 5th failure asks for a new code")

		_, err = env.svc.ResetPassword(ctx, "user@example.com", code, newPassword, meta)
		assert.ErrorIs(t, err, domain.ErrExpiredCodeException)
	})

	t.Run("unknown email looks like a wrong code", func(t *testing.T) {
		env := newResetEnv(t)
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "nobody@example.com").Return(nil, domain.ErrUserNotFoundException)

		_, err := env.svc.ResetPassword(ctx, "nobody@example.com", "123456", newPassword, meta)

		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
	})

	t.Run("no code requested", func(t *testing.T) {
		env := newResetEnv(t)
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "user@example.com").Return(migratedUser(), nil)

		_, err := env.svc.ResetPassword(ctx, "user@example.com", "123456", newPassword, meta)

		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
	})

	t.Run("password policy is checked before spending an attempt", func(t *testing.T) {
		env := newResetEnv(t)
		code := env.forgot(t, migratedUser())

		_, err := env.svc.ResetPassword(ctx, "user@example.com", code, "corta", meta)

		assert.ErrorIs(t, err, domain.ErrInvalidPasswordException)
		assert.Equal(t, 0, env.codes.codes[0].Attempts)
	})

	t.Run("rate limited", func(t *testing.T) {
		env := newResetEnv(t)
		env.limiter.blocked["reset:email:user@example.com"] = true

		_, err := env.svc.ResetPassword(ctx, "user@example.com", "123456", newPassword, meta)

		assert.ErrorIs(t, err, domain.ErrLimitExceededException)
	})
}

// ---------------------------------------------------------------------------
// Email verification (new users; existing ones are verified by the migration)
// ---------------------------------------------------------------------------

func newUser() *domain.User {
	return &domain.User{ID: "new-1", Email: "nuevo@example.com", Role: domain.RoleUser, Verified: true,
		PasswordHash: strPtr("hash:" + validPassword)}
}

func TestUserService_RegisterSendsVerificationCode(t *testing.T) {
	env := newResetEnv(t)
	env.repo.EXPECT().CreateUser(gomock.Any(), gomock.Any()).Return(nil)

	_, err := env.svc.Register(context.Background(), &domain.User{Email: "Nuevo@Example.com", Password: validPassword}, meta)

	require.NoError(t, err)
	require.Len(t, env.mail.secrets, 1)
	assert.Equal(t, domain.TemplateVerifyEmail, env.mail.secrets[0].email.Template)
	assert.Equal(t, "nuevo@example.com", env.mail.secrets[0].email.To)
	assert.Equal(t, domain.CodeVerifyEmail, env.codes.codes[0].Purpose)
}

func TestUserService_VerifyEmail(t *testing.T) {
	ctx := context.Background()

	t.Run("resend + verify", func(t *testing.T) {
		env := newResetEnv(t)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "new-1").Return(newUser(), nil).Times(2)
		env.repo.EXPECT().MarkEmailVerified(gomock.Any(), "new-1").Return(nil)

		require.NoError(t, env.svc.SendVerification(ctx, "new-1", meta))
		code := env.mail.lastCode(t)

		require.NoError(t, env.svc.VerifyEmail(ctx, "new-1", code, meta))
		assert.Contains(t, env.events.names(), domain.EventEmailVerified)
	})

	t.Run("wrong code", func(t *testing.T) {
		env := newResetEnv(t)
		env.repo.EXPECT().GetUserByID(gomock.Any(), "new-1").Return(newUser(), nil).Times(2)
		require.NoError(t, env.svc.SendVerification(ctx, "new-1", meta))
		code := env.mail.lastCode(t)
		wrong := "000000"
		if code == wrong {
			wrong = "111111"
		}

		err := env.svc.VerifyEmail(ctx, "new-1", wrong, meta)
		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
	})

	t.Run("a reset code does not verify the email (separate purposes)", func(t *testing.T) {
		env := newResetEnv(t)
		user := newUser()
		env.repo.EXPECT().GetUserByEmail(gomock.Any(), "nuevo@example.com").Return(user, nil)
		require.NoError(t, env.svc.ForgotPassword(ctx, "nuevo@example.com", meta))
		resetCode := env.mail.lastCode(t)

		env.repo.EXPECT().GetUserByID(gomock.Any(), "new-1").Return(user, nil)
		err := env.svc.VerifyEmail(ctx, "new-1", resetCode, meta)
		assert.ErrorIs(t, err, domain.ErrCodeMismatchException)
	})

	t.Run("already verified: nothing is sent", func(t *testing.T) {
		env := newResetEnv(t)
		user := newUser()
		verified := env.now
		user.EmailVerifiedAt = &verified
		env.repo.EXPECT().GetUserByID(gomock.Any(), "new-1").Return(user, nil).Times(2)

		require.NoError(t, env.svc.SendVerification(ctx, "new-1", meta))
		require.NoError(t, env.svc.VerifyEmail(ctx, "new-1", "123456", meta))
		assert.Empty(t, env.mail.secrets)
	})

	t.Run("resend is limited", func(t *testing.T) {
		env := newResetEnv(t)
		env.codeLimiter.blocked["verify:code:nuevo@example.com"] = true
		env.repo.EXPECT().GetUserByID(gomock.Any(), "new-1").Return(newUser(), nil)

		err := env.svc.SendVerification(ctx, "new-1", meta)
		assert.ErrorIs(t, err, domain.ErrLimitExceededException)
	})
}
