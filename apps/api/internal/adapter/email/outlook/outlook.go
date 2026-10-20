package outlook

import (
	"cash-flow/internal/adapter/api"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"context"
	"errors"
	"fmt"
	"net/url"
)

type API struct {
	api    *api.HttpClient
	config *config.Outlook
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	Type         string `json:"token_type"`
	Error        string `json:"error,omitempty"`
}

func NewOutlookAPI(api *api.HttpClient, config *config.Outlook) *API {
	return &API{
		api:    api,
		config: config,
	}
}

func (o *API) GetAuthURL() *string {
	authReq := fmt.Sprintf("%s?client_id=%s&response_type=code&redirect_uri=%s&response_mode=query&scope=%s",
		o.config.Http.URL+enums.OutlookAuthEndpoint,
		url.QueryEscape(o.config.ClientID),
		url.QueryEscape(o.config.RedirectURL),
		url.QueryEscape(o.config.Scopes),
	)
	return &authReq
}

func (o *API) GetToken(_ context.Context, code string) (*TokenResponse, error) {
	artifacts := api.NewHttpArtifacts(
		o.config.Http.URL+enums.OutlookTokenEndpoint,
		utils.FormURLHeaders(),
		o.buildURLForm(code),
		true,
	)

	response, err := api.Post[any, TokenResponse](o.api, artifacts, nil)
	if err != nil {
		return nil, err
	}

	if response.Response.Error != "" {
		return nil, errors.New(response.Response.Error)
	}

	return &response.Response, nil
}

func (o *API) buildURLForm(code string) url.Values {
	return url.Values{
		enums.ClientID:     {o.config.ClientID},
		enums.Scope:        {o.config.Scopes},
		enums.Code:         {code},
		enums.RedirectURI:  {o.config.RedirectURL},
		enums.GrantType:    {"authorization_code"},
		enums.ClientSecret: {o.config.SecretID},
	}
}

func (o *API) ErrorCode(err error) string {
	return err.Error()
}
