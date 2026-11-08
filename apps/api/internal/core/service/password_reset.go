package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
)

// SetMail enables the flows that send codes by email (recover the password, verify the email).
// codeLimiter limits how many codes are sent per email (stricter than the login limit).
func (us *UserService) SetMail(mail port.MailService, codes port.AuthCodeRepository, codeLimiter port.RateLimiter) {
	us.mail = mail
	us.codes = codes
	us.codeLimiter = codeLimiter
}

// ForgotPassword sends a 6 digit code if the email is registered. The answer is the same whether the
// email exists or not (no user enumeration); the email itself is sent in background.
// It also covers users without a password (migrated or reset by the admin): it is how they create one.
func (us *UserService) ForgotPassword(ctx context.Context, email string, meta domain.RequestMeta) error {
	email = domain.NormalizeEmail(email)

	if !us.allow("forgot", email, meta) || !us.allowCode("forgot", email) {
		return domain.ErrLimitExceededException
	}

	if us.mail == nil || us.codes == nil {
		return domain.ErrInternal
	}

	user, err := us.repo.GetUserByEmail(ctx, email)
	if errors.Is(err, domain.ErrUserNotFoundException) {
		us.record(ctx, "", email, domain.EventResetRequested, meta)
		return nil
	}
	if err != nil {
		return err
	}

	if err = us.sendCode(ctx, user, domain.CodePasswordReset, domain.TemplatePasswordCode); err != nil {
		return err
	}

	us.record(ctx, user.ID, email, domain.EventResetRequested, meta)
	return nil
}

// ResetPassword checks the code (expiration, attempts), sets the new password, revokes every
// session (token_version + refresh tokens) and logs the user in. Proving the code also verifies the email.
func (us *UserService) ResetPassword(ctx context.Context, email, code, password string, meta domain.RequestMeta) (*domain.AuthTokens, error) {
	email = domain.NormalizeEmail(email)

	if !us.allow("reset", email, meta) {
		return nil, domain.ErrLimitExceededException
	}

	if err := domain.ValidatePasswordPolicy(password); err != nil {
		return nil, err
	}

	if us.codes == nil {
		return nil, domain.ErrInternal
	}

	user, err := us.repo.GetUserByEmail(ctx, email)
	if errors.Is(err, domain.ErrUserNotFoundException) {
		us.record(ctx, "", email, domain.EventResetFail, meta)
		return nil, domain.ErrCodeMismatchException
	}
	if err != nil {
		return nil, err
	}

	if err = us.checkCode(ctx, user.ID, domain.CodePasswordReset, code); err != nil {
		us.record(ctx, user.ID, email, domain.EventResetFail, meta)
		return nil, err
	}

	hash, err := us.hasher.Hash(password)
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

	if user.EmailVerifiedAt == nil {
		if err := us.repo.MarkEmailVerified(ctx, user.ID); err != nil {
			slog.Error("could not mark the email verified after a reset", "user_id", user.ID, "error", err)
		}
	}

	us.record(ctx, user.ID, email, domain.EventResetOK, meta)

	user.PasswordHash = &hash
	user.TokenVersion = version

	return us.issueTokens(ctx, user)
}

// sendCode creates a code (invalidating the previous one) and emails it
func (us *UserService) sendCode(ctx context.Context, user *domain.User, purpose, template string) error {
	code, err := newCode()
	if err != nil {
		return domain.ErrInternal
	}

	codeHash, err := us.hasher.Hash(code)
	if err != nil {
		return domain.ErrInternal
	}

	if err = us.codes.Create(ctx, user.ID, purpose, codeHash, us.now().Add(domain.CodeTTL)); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]any{"minutes": int(domain.CodeTTL.Minutes())})
	userID := user.ID

	return us.mail.SendSecret(ctx, domain.OutboxEmail{
		UserID:   &userID,
		To:       user.Email,
		Template: template,
		Payload:  payload,
	}, map[string]any{"code": code})
}

// checkCode validates the latest code of the purpose and consumes it
func (us *UserService) checkCode(ctx context.Context, userID, purpose, code string) error {
	stored, err := us.codes.GetLatest(ctx, userID, purpose)
	if errors.Is(err, domain.ErrDataNotFound) {
		return domain.ErrCodeMismatchException
	}
	if err != nil {
		return err
	}

	if !us.now().Before(stored.ExpiresAt) || stored.Attempts >= domain.CodeMaxAttempts {
		return domain.ErrExpiredCodeException
	}

	attempts, err := us.codes.IncrementAttempts(ctx, stored.ID)
	if err != nil {
		return err
	}
	if attempts > domain.CodeMaxAttempts {
		return domain.ErrExpiredCodeException
	}

	ok, err := us.hasher.Compare(stored.CodeHash, code)
	if err != nil || !ok {
		if attempts >= domain.CodeMaxAttempts {
			// the last attempt failed: ask for a new code
			return domain.ErrExpiredCodeException
		}
		return domain.ErrCodeMismatchException
	}

	used, err := us.codes.MarkUsed(ctx, stored.ID)
	if err != nil {
		return err
	}
	if !used {
		return domain.ErrCodeMismatchException
	}

	return nil
}

// allowCode limits the codes sent per email (nil limiter = no extra limit)
func (us *UserService) allowCode(action, email string) bool {
	if us.codeLimiter == nil {
		return true
	}
	return us.codeLimiter.Allow(action + ":code:" + email)
}

// newCode returns 6 random digits
func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// SendVerification emails a code to confirm the email of the user (new users). Already verified = nothing.
func (us *UserService) SendVerification(ctx context.Context, userID string, meta domain.RequestMeta) error {
	user, err := us.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.EmailVerifiedAt != nil {
		return nil
	}

	if !us.allow("verify-send", user.Email, meta) || !us.allowCode("verify", user.Email) {
		return domain.ErrLimitExceededException
	}
	if us.mail == nil || us.codes == nil {
		return domain.ErrInternal
	}

	return us.sendCode(ctx, user, domain.CodeVerifyEmail, domain.TemplateVerifyEmail)
}

// VerifyEmail checks the verification code of the user and marks the email as verified
func (us *UserService) VerifyEmail(ctx context.Context, userID, code string, meta domain.RequestMeta) error {
	user, err := us.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.EmailVerifiedAt != nil {
		return nil
	}

	if !us.allow("verify", user.Email, meta) {
		return domain.ErrLimitExceededException
	}
	if us.codes == nil {
		return domain.ErrInternal
	}

	if err = us.checkCode(ctx, user.ID, domain.CodeVerifyEmail, code); err != nil {
		return err
	}

	if err = us.repo.MarkEmailVerified(ctx, user.ID); err != nil {
		return err
	}

	us.record(ctx, user.ID, user.Email, domain.EventEmailVerified, meta)
	return nil
}
