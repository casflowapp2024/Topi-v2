package email

import (
	"cash-flow/internal/adapter/email/gmail"
	"cash-flow/internal/adapter/email/jobqueue"
	"cash-flow/internal/adapter/email/outlook"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"context"
)

type UserEmail struct {
	gmail   *gmail.API
	outlook *outlook.API
	queue   *jobqueue.Queue
}

func NewUserEmail(gmail *gmail.API, outlook *outlook.API, queue *jobqueue.Queue) *UserEmail {
	return &UserEmail{
		gmail:   gmail,
		outlook: outlook,
		queue:   queue,
	}
}

func (ue *UserEmail) GetAuthURL(provider string) (*string, error) {
	switch provider {
	case enums.Gmail:
		return ue.gmail.GetAuthURL(), nil
	case enums.Outlook:
		return ue.outlook.GetAuthURL(), nil
	default:
		return nil, domain.ErrUnsupportedEmailProvider
	}
}

func (ue *UserEmail) GetToken(ctx context.Context, provider string, code string) (*domain.EmailToken, error) {
	switch provider {
	case enums.Gmail:
		token, err := ue.gmail.GetToken(ctx, code)
		if err != nil {
			gmailErr := ue.gmail.ErrorCode(err)
			return nil, mappers.MapEmailApiErrorCode(gmailErr)
		}

		return &domain.EmailToken{
			Access:  token.AccessToken,
			Refresh: token.RefreshToken,
			Type:    token.TokenType,
		}, nil

	case enums.Outlook:
		token, err := ue.outlook.GetToken(ctx, code)
		if err != nil {
			outlookErr := ue.outlook.ErrorCode(err)
			return nil, mappers.MapEmailApiErrorCode(outlookErr)
		}

		return &domain.EmailToken{
			Access:  token.AccessToken,
			Refresh: token.RefreshToken,
			Type:    token.Type,
		}, nil

	default:
		return nil, domain.ErrUnsupportedEmailProvider
	}
}

func (ue *UserEmail) ReadEmail(accounts []domain.Account) *domain.ReadEmailResponse {
	resolver := domain.NewReadEmailResolver(accounts)

	// Build grouped requests using domain logic
	requests := domain.Accounts(accounts).BuildReadEmailRequests()

	// Enqueue one job per group (email_jobs)
	for _, request := range requests {
		if shouldRequest := ue.queue.ShouldReadEmail(request); shouldRequest {
			resolver.WG.Add(1)
			go ue.queue.ReadEmail(request, resolver)
		}
	}

	resolver.WG.Wait()

	return &resolver.Reads
}
