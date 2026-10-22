package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ServiceUserID is the payload user id of requests authenticated with X-API-Key
const ServiceUserID = "service"

// AuthSettings contains the auth rules of the service
type AuthSettings struct {
	RefreshTokenTTL time.Duration
	// InitialPasswordUntil closes set-initial-password after this instant (nil = always open)
	InitialPasswordUntil *time.Time
	// InternalAPIKey authenticates internal callers (worker) with X-API-Key. Empty = disabled
	InternalAPIKey string
}

// UserService implements port.UserService: own email + password auth (no email service)
type UserService struct {
	repo     port.UserRepository
	token    port.TokenRepository
	refresh  port.RefreshTokenRepository
	events   port.AuthEventRepository
	hasher   port.PasswordHasher
	limiter  port.RateLimiter
	settings AuthSettings
	now      func() time.Time

	dummyOnce sync.Once
	dummyHash string
}

// NewUserService creates a new user service instance
func NewUserService(
	repo port.UserRepository,
	token port.TokenRepository,
	refresh port.RefreshTokenRepository,
	events port.AuthEventRepository,
	hasher port.PasswordHasher,
	limiter port.RateLimiter,
	settings AuthSettings,
) *UserService {
	return &UserService{
		repo:     repo,
		token:    token,
		refresh:  refresh,
		events:   events,
		hasher:   hasher,
		limiter:  limiter,
		settings: settings,
		now:      time.Now,
	}
}

// Register creates a user with a password and logs it in (there is no email verification)
func (us *UserService) Register(ctx context.Context, user *domain.User, meta domain.RequestMeta) (*domain.AuthTokens, error) {
	user.Email = domain.NormalizeEmail(user.Email)

	if !us.allow("signup", user.Email, meta) {
		return nil, domain.ErrLimitExceededException
	}

	if err := domain.ValidatePasswordPolicy(user.Password); err != nil {
		return nil, err
	}

	hash, err := us.hasher.Hash(user.Password)
	if err != nil {
		return nil, domain.ErrInternal
	}

	now := us.now()
	user.ID = uuid.NewString()
	user.PasswordHash = &hash
	user.PasswordSetAt = &now
	user.Role = domain.RoleUser
	user.Verified = true
	user.Password = ""

	if err = us.repo.CreateUser(ctx, user); err != nil {
		return nil, err
	}

	us.record(ctx, user.ID, user.Email, domain.EventSignup, meta)

	return us.issueTokens(ctx, user)
}

// Login validates the credentials. Users without a password (migrated or reset by the admin)
// get domain.ErrPasswordResetRequiredException so the front shows the "create password" form.
func (us *UserService) Login(ctx context.Context, email, password string, meta domain.RequestMeta) (*domain.AuthTokens, error) {
	email = domain.NormalizeEmail(email)

	if !us.allow("login", email, meta) {
		return nil, domain.ErrLimitExceededException
	}

	user, err := us.repo.GetUserByEmail(ctx, email)
	if errors.Is(err, domain.ErrUserNotFoundException) {
		// same work as a real comparison so the response time does not reveal the email
		_, _ = us.hasher.Compare(us.getDummyHash(), password)
		us.record(ctx, "", email, domain.EventLoginFail, meta)
		return nil, domain.ErrNotAuthorizedException
	}
	if err != nil {
		return nil, err
	}

	if !user.HasPassword() {
		return nil, domain.ErrPasswordResetRequiredException
	}

	ok, err := us.hasher.Compare(*user.PasswordHash, password)
	if err != nil || !ok {
		us.record(ctx, user.ID, email, domain.EventLoginFail, meta)
		return nil, domain.ErrNotAuthorizedException
	}

	us.record(ctx, user.ID, email, domain.EventLoginOK, meta)

	return us.issueTokens(ctx, user)
}

// SetInitialPassword lets a user without password (migrated or reset) create one without a code.
// Accepted risk (see plan/02-fase-2-auth.md), mitigated by: it only works while the account has
// no password (checked atomically), the optional INITIAL_PASSWORD_UNTIL window, rate limiting
// and auditing in auth_events.
func (us *UserService) SetInitialPassword(ctx context.Context, email, password string, meta domain.RequestMeta) (*domain.AuthTokens, error) {
	email = domain.NormalizeEmail(email)

	if !us.allow("initial-password", email, meta) {
		return nil, domain.ErrLimitExceededException
	}

	if us.settings.InitialPasswordUntil != nil && us.now().After(*us.settings.InitialPasswordUntil) {
		us.record(ctx, "", email, domain.EventInitialPasswordFail, meta)
		return nil, domain.ErrNotAuthorizedException
	}

	if err := domain.ValidatePasswordPolicy(password); err != nil {
		return nil, err
	}

	user, err := us.repo.GetUserByEmail(ctx, email)
	if errors.Is(err, domain.ErrUserNotFoundException) {
		us.record(ctx, "", email, domain.EventInitialPasswordFail, meta)
		return nil, domain.ErrNotAuthorizedException
	}
	if err != nil {
		return nil, err
	}

	if user.HasPassword() {
		us.record(ctx, user.ID, email, domain.EventInitialPasswordFail, meta)
		return nil, domain.ErrNotAuthorizedException
	}

	hash, err := us.hasher.Hash(password)
	if err != nil {
		return nil, domain.ErrInternal
	}

	if err = us.repo.SetInitialPassword(ctx, user.ID, hash); err != nil {
		if errors.Is(err, domain.ErrNotAuthorizedException) {
			// another request set the password first
			us.record(ctx, user.ID, email, domain.EventInitialPasswordFail, meta)
		}
		return nil, err
	}

	us.record(ctx, user.ID, email, domain.EventInitialPasswordSet, meta)

	user.PasswordHash = &hash

	return us.issueTokens(ctx, user)
}

// Refresh rotates a refresh token. Reusing a revoked token revokes every session of the user.
func (us *UserService) Refresh(ctx context.Context, refreshToken string, meta domain.RequestMeta) (*domain.AuthTokens, error) {
	stored, err := us.refresh.GetByHash(ctx, hashToken(refreshToken))
	if errors.Is(err, domain.ErrDataNotFound) {
		return nil, domain.ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}

	if stored.IsRevoked() {
		us.revokeAllOnReuse(ctx, stored.UserID, meta)
		return nil, domain.ErrUnauthorized
	}

	if stored.IsExpired(us.now()) {
		return nil, domain.ErrUnauthorized
	}

	revoked, err := us.refresh.Revoke(ctx, stored.ID)
	if err != nil {
		return nil, err
	}
	if !revoked {
		// used concurrently by someone else
		us.revokeAllOnReuse(ctx, stored.UserID, meta)
		return nil, domain.ErrUnauthorized
	}

	user, err := us.repo.GetUserByID(ctx, stored.UserID)
	if err != nil || !user.HasPassword() {
		return nil, domain.ErrUnauthorized
	}

	return us.issueTokens(ctx, user)
}

// Logout revokes the refresh token. It is idempotent.
func (us *UserService) Logout(ctx context.Context, refreshToken string) error {
	stored, err := us.refresh.GetByHash(ctx, hashToken(refreshToken))
	if errors.Is(err, domain.ErrDataNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	_, err = us.refresh.Revoke(ctx, stored.ID)
	return err
}

// ChangePassword replaces the password after checking the current one.
// token_version is incremented and every refresh token revoked; new tokens are returned
// so the current session continues.
func (us *UserService) ChangePassword(
	ctx context.Context,
	userID, currentPassword, newPassword string,
	meta domain.RequestMeta,
) (*domain.AuthTokens, error) {
	user, err := us.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if !user.HasPassword() {
		return nil, domain.ErrPasswordResetRequiredException
	}

	ok, err := us.hasher.Compare(*user.PasswordHash, currentPassword)
	if err != nil || !ok {
		return nil, domain.ErrNotAuthorizedException
	}

	if err = domain.ValidatePasswordPolicy(newPassword); err != nil {
		return nil, err
	}

	hash, err := us.hasher.Hash(newPassword)
	if err != nil {
		return nil, domain.ErrInternal
	}

	version, err := us.repo.UpdatePassword(ctx, user.ID, hash)
	if err != nil {
		return nil, err
	}

	if err = us.refresh.RevokeAllForUser(ctx, user.ID); err != nil {
		return nil, err
	}

	us.record(ctx, user.ID, user.Email, domain.EventPasswordChanged, meta)

	user.PasswordHash = &hash
	user.TokenVersion = version

	return us.issueTokens(ctx, user)
}

// Authorize verifies the access token and checks it against the current user:
// a token_version mismatch (password changed or reset) is rejected, and the role comes from the DB.
func (us *UserService) Authorize(ctx context.Context, token string) (*domain.TokenPayload, error) {
	payload, err := us.token.VerifyToken(token)
	if err != nil {
		return nil, err
	}

	user, err := us.repo.GetUserByID(ctx, payload.UserID)
	if err != nil {
		return nil, domain.ErrUnauthorized
	}

	if user.TokenVersion != payload.TokenVersion {
		return nil, domain.ErrUnauthorized
	}

	payload.Email = user.Email
	payload.Name = user.Name
	payload.LastName = user.LastName
	payload.Verified = true
	payload.Groups = map[string]bool{enums.AdminRole: user.IsAdmin()}

	return payload, nil
}

// AuthorizeAPIKey authenticates internal callers. The comparison is constant time
// (on SHA-256 digests, so the key length does not leak either).
func (us *UserService) AuthorizeAPIKey(apiKey string) (*domain.TokenPayload, error) {
	if us.settings.InternalAPIKey == "" || apiKey == "" {
		return nil, domain.ErrUnauthorized
	}

	given := sha256.Sum256([]byte(apiKey))
	expected := sha256.Sum256([]byte(us.settings.InternalAPIKey))
	if subtle.ConstantTimeCompare(given[:], expected[:]) != 1 {
		return nil, domain.ErrUnauthorized
	}

	return &domain.TokenPayload{
		UserID:   ServiceUserID,
		Verified: true,
		Groups:   map[string]bool{enums.AdminRole: true},
		Use:      enums.AccessUse,
	}, nil
}

// GetUser returns the authenticated user
func (us *UserService) GetUser(ctx *gin.Context) (*domain.User, error) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		return nil, err
	}

	return us.repo.GetUserByID(ctx, *userID)
}

// AdminIsUserValid reports whether the user exists (every stored user is verified)
func (us *UserService) AdminIsUserValid(ctx context.Context, userID string) (bool, error) {
	user, err := us.repo.GetUserByID(ctx, userID)
	if err != nil {
		return false, err
	}

	return user.Verified, nil
}

// UpdateUser updates the user's name and last name
func (us *UserService) UpdateUser(ctx *gin.Context, user domain.User) (*domain.User, error) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		return nil, err
	}

	existingUser, err := us.repo.GetUserByID(ctx, *userID)
	if err != nil {
		return nil, err
	}

	if domain.UserIsEmpty(&user) || domain.IsSameUser(existingUser, &user) {
		return nil, domain.ErrNoUpdatedData
	}

	if err = us.repo.UpdateProfile(ctx, existingUser.ID, user.Name, user.LastName); err != nil {
		return nil, err
	}

	existingUser.Name = user.Name
	existingUser.LastName = user.LastName

	return existingUser, nil
}

// issueTokens creates an access token and a new refresh token for the user
func (us *UserService) issueTokens(ctx context.Context, user *domain.User) (*domain.AuthTokens, error) {
	accessToken, expiresIn, err := us.token.GenerateAccessToken(user)
	if err != nil {
		return nil, domain.ErrInternal
	}

	refreshToken, err := newRefreshToken()
	if err != nil {
		return nil, domain.ErrInternal
	}

	expiresAt := us.now().Add(us.settings.RefreshTokenTTL)
	if err = us.refresh.Create(ctx, user.ID, hashToken(refreshToken), expiresAt); err != nil {
		return nil, err
	}

	return &domain.AuthTokens{
		IdToken:      accessToken,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    expiresIn,
		TokenType:    "Bearer",
	}, nil
}

func (us *UserService) revokeAllOnReuse(ctx context.Context, userID string, meta domain.RequestMeta) {
	if err := us.refresh.RevokeAllForUser(ctx, userID); err != nil {
		slog.Error("failed to revoke refresh tokens after reuse", "user_id", userID, "error", err)
	}
	us.record(ctx, userID, "", domain.EventRefreshReuse, meta)
}

// allow applies the rate limit per IP and per email for the given action
func (us *UserService) allow(action, email string, meta domain.RequestMeta) bool {
	byIP := us.limiter.Allow(action + ":ip:" + meta.IP)
	byEmail := us.limiter.Allow(action + ":email:" + email)
	return byIP && byEmail
}

// record stores an audit event; failures are logged and never block the request
func (us *UserService) record(ctx context.Context, userID, email, event string, meta domain.RequestMeta) {
	err := us.events.Record(ctx, domain.AuthEvent{
		UserID:    userID,
		Email:     email,
		Event:     event,
		IP:        meta.IP,
		UserAgent: meta.UserAgent,
	})
	if err != nil {
		slog.Error("failed to record auth event", "event", event, "error", err)
	}
}

func (us *UserService) getDummyHash() string {
	us.dummyOnce.Do(func() {
		us.dummyHash, _ = us.hasher.Hash("dummy-password-for-timing")
	})
	return us.dummyHash
}

// newRefreshToken returns 32 random bytes encoded as base64url
func newRefreshToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// hashToken returns the SHA-256 of a refresh token; only the hash is stored
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
