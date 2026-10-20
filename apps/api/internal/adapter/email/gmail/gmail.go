package gmail

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/gmail/v1"
	"log/slog"
)

type API struct {
	config  *oauth2.Config
	service *gmail.Service
}

func NewGmailAPI(config *config.Gmail) *API {
	b, err := json.Marshal(config)
	if err != nil {
		slog.Error(domain.ErrGmailConfigurationFailed.Error(), "error", err)
		panic(domain.ErrGmailConfigurationFailed)
	}

	gmailConfig, err := google.ConfigFromJSON(b, gmail.GmailReadonlyScope)
	if err != nil {
		slog.Error(domain.ErrGmailConfigurationFailed.Error(), "error", err)
		panic(domain.ErrGmailConfigurationFailed)
	}

	return &API{
		config: gmailConfig,
	}
}

func (g *API) GetAuthURL() *string {
	url := g.config.AuthCodeURL(enums.GmailStateToken, oauth2.AccessTypeOffline)
	return &url
}

func (g *API) GetToken(ctx context.Context, code string) (*oauth2.Token, error) {
	token, err := g.config.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}
	return token, nil
}

func (g *API) ErrorCode(err error) string {
	var gmailErr *oauth2.RetrieveError

	errors.As(err, &gmailErr)
	if gmailErr == nil {
		return ""
	}

	return gmailErr.ErrorCode
}
