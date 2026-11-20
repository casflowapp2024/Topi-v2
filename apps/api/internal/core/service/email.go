package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"

	"github.com/jackc/pgx/v5"
)

type EmailService struct {
	mail           port.MailService
	events         port.ProductEventRecorder
	repo           port.EmailRepository
	email          port.EmailAPI
	repoAccount    port.AccountRepository
	accountService port.AccountService
	txManager      port.TransactionManager
}

func NewEmailService(
	repo port.EmailRepository,
	mail port.EmailAPI,
	account port.AccountRepository,
	accountService port.AccountService,
	txManager port.TransactionManager,
) *EmailService {
	return &EmailService{
		repo:           repo,
		email:          mail,
		repoAccount:    account,
		accountService: accountService,
		txManager:      txManager,
	}
}

func (e *EmailService) GetUserAuthURL(ctx context.Context, provider string) (*string, error) {
	return e.email.GetAuthURL(provider)
}

func (e *EmailService) RegisterUserEmail(ctx context.Context, email *domain.Email) error {
	token, err := e.email.GetToken(ctx, email.Provider, email.Code)
	if err != nil {
		return err
	}

	if !email.IsValidRefreshToken(*token) {
		return domain.ErrEmailAlreadyConfigured
	}

	email.SetToken(*token)

	err = e.repo.RegisterEmail(ctx, email)
	if err != nil {
		return err
	}

	if email.Reconnected && email.ID != nil {
		emit(ctx, e.events, domain.ProductEvent{
			UserID: email.UserID, Name: domain.ProductEventConnectionReconnected,
			Props: map[string]any{"email_id": *email.ID, "provider": email.Provider},
		})
		e.readAfterReconnect(ctx, email.UserID, *email.ID)
	}

	return nil
}

// SetEvents sets the recorder of product events (connection_reconnected)
func (e *EmailService) SetEvents(events port.ProductEventRecorder) {
	e.events = events
}

// readAfterReconnect asks for an immediate read (priority 1) of the accounts linked to a connection that came
// back, so the gap while it was down is filled without waiting for the scheduler. Never fails the reconnect.
func (e *EmailService) readAfterReconnect(ctx context.Context, userID string, emailID uint64) {
	if e.accountService == nil || e.repoAccount == nil || e.email == nil {
		return
	}
	accounts, err := e.accountService.GetAccounts(ctx, userID, 0, 100, enums.All)
	if err != nil {
		slog.Error("reconnect: could not list accounts", "email_id", emailID, "error", err)
		return
	}
	var ids []uint64
	for _, account := range accounts {
		if account.Email.ID != nil && *account.Email.ID == emailID {
			ids = append(ids, account.ID)
		}
	}
	if len(ids) == 0 {
		return
	}
	if _, err = e.ReadEmail(ctx, userID, ids); err != nil {
		slog.Error("reconnect: could not enqueue the read", "email_id", emailID, "error", err)
	}
}

func (e *EmailService) GetUserEmailToken(ctx context.Context, userID string, id uint64) (*domain.Email, error) {
	active := true
	email, err := e.repo.GetEmail(ctx, userID, id, &active)
	if err != nil {
		return nil, err
	}

	return email, nil
}

func (e *EmailService) ListUserEmails(
	ctx context.Context,
	userID string,
	skip uint64,
	limit uint64,
) ([]domain.Email, error) {
	emails, err := e.repo.ListEmails(ctx, userID, skip, limit)
	if err != nil {
		return nil, err
	}

	return emails, nil
}

func (e *EmailService) UpdateUserEmail(ctx context.Context, email *domain.Email) error {
	actualEmail, err := e.repo.GetEmail(ctx, email.UserID, *email.ID, nil)
	if err != nil {
		return err
	}

	if email.IsSameEmail(actualEmail) {
		return domain.ErrNoUpdatedData
	}

	err = e.repo.UpdateEmail(ctx, email)
	if err != nil {
		return err
	}

	return nil
}

func (e *EmailService) DeleteEmail(ctx context.Context, userID string, id uint64) error {
	_, err := e.repo.GetEmail(ctx, userID, id, nil)
	if err != nil {
		return err
	}

	err = e.txManager.WithTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		if tErr := e.repoAccount.DisconnectEmail(ctx, tx, userID, id); tErr != nil {
			return tErr
		}

		if tErr := e.repo.DeleteEmailTrx(ctx, tx, userID, id); tErr != nil {
			return tErr
		}

		return nil
	})

	return err
}

// SetMail enables the "Topi stopped reading your email" alert
func (e *EmailService) SetMail(mail port.MailService) {
	e.mail = mail
}

// SaveEmailError marks the connection (the worker calls it only for credential errors) and, at most
// once every 7 days per connection, emails the user to reconnect it. The alert never fails the request.
func (e *EmailService) SaveEmailError(ctx context.Context, emailID uint64, errorMsg string) error {
	if err := e.repo.SaveEmailError(ctx, emailID, errorMsg); err != nil {
		return err
	}

	if e.mail == nil || strings.TrimSpace(errorMsg) == "" {
		return nil
	}

	alert, ok, err := e.repo.ClaimConnectionAlert(ctx, emailID, domain.ConnectionAlertCooldown)
	if err != nil {
		slog.Error("connection alert: could not claim", "email_id", emailID, "error", err)
		return nil
	}
	if !ok {
		return nil
	}

	// only the connection id: its address is filled in when sending (Enrich), never stored in the outbox
	payload, _ := json.Marshal(map[string]any{
		"email_id": emailID,
		"provider": domain.ProviderLabel(alert.Provider),
	})
	userID := alert.UserID
	if _, err = e.mail.Enqueue(ctx, domain.OutboxEmail{
		UserID:   &userID,
		To:       alert.UserEmail,
		Template: domain.TemplateConnectionDown,
		Payload:  payload,
		Priority: domain.MailPriorityNotification,
	}); err != nil {
		slog.Error("connection alert: could not enqueue", "email_id", emailID, "error", err)
	}

	return nil
}

func (e *EmailService) ReadEmail(ctx context.Context, userID string, accountIDs []uint64) (*domain.ReadEmailResponse, error) {
	// Get all user accounts to validate ownership
	userAccounts, err := e.accountService.GetAccounts(ctx, userID, 0, 100, enums.All)
	if err != nil {
		return nil, err
	}

	// Validate that the user owns the requested accounts
	if err = domain.Accounts(userAccounts).ValidateUserAccounts(accountIDs); err != nil {
		return nil, err
	}

	// Call AdminGetAccountsList to extract the required information. The job carries every account of the same
	// connection and bank, not only the requested ones: an email without known digits goes to the only account
	// of the bank without review, which is right only when the job knows them all (plan/32)
	filters := domain.AccountFilters{
		IDs:   domain.Accounts(userAccounts).SameReadAs(accountIDs),
		Skip:  0,
		Limit: 100,
	}

	accountsDetails, err := e.repoAccount.AdminGetAccountsList(ctx, filters)
	if err != nil {
		return nil, err
	}

	// Enqueue email reading jobs (email_jobs)
	response := e.email.ReadEmail(accountsDetails)

	return response, nil
}

// Enrich fills the address of the connection when sending connection_down (implements MailEnricher). The
// alert is cancelled when the connection is gone or was reconnected before the email went out.
func (e *EmailService) Enrich(ctx context.Context, email domain.OutboxEmail, data map[string]any) error {
	if _, ok := data["connection_email"]; ok {
		return nil // queued before the address left the outbox
	}
	rawID, _ := data["email_id"].(float64)
	if rawID <= 0 || email.UserID == nil {
		return domain.ErrMailCancelled
	}
	connection, err := e.repo.GetEmail(ctx, *email.UserID, uint64(rawID), nil)
	if errors.Is(err, domain.ErrDataNotFound) {
		return domain.ErrMailCancelled
	}
	if err != nil {
		return err
	}
	if connection.Error == nil || *connection.Error == "" {
		return domain.ErrMailCancelled
	}
	data["connection_email"] = connection.Email
	return nil
}
