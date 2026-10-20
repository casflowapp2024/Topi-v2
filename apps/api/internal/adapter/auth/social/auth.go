package social

import (
	"cash-flow/internal/adapter/api"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
	"net/http"
	"net/url"
)

type AuthSocialRepository struct {
	api    *api.HttpClient
	config *config.Social
}

func NewSocialAuthRepository(api *api.HttpClient, config *config.Social) *AuthSocialRepository {
	return &AuthSocialRepository{
		api:    api,
		config: config,
	}
}

func (s *AuthSocialRepository) GetAuthURL(platform string) (*string, error) {
	authURL, err := url.Parse(s.config.Http.URL + enums.OAuthAuthorize)
	if err != nil {
		return nil, domain.ErrParsingAuthURL
	}

	callbackURL := s.config.CallBackURL
	if platform == enums.Mobile {
		if s.config.CallBackMobileURL == "" {
			return nil, domain.ErrMobileCallbackNotConfigured
		}

		callbackURL = s.config.CallBackMobileURL
	}

	query := authURL.Query()
	query.Set(enums.IdentityProvider, enums.Google)
	query.Set(enums.RedirectURI, callbackURL)
	query.Set(enums.ResponseType, enums.Code)
	query.Set(enums.ClientID, s.config.Auth.ClientID)
	query.Set(enums.Scope, enums.OpenID)

	authURL.RawQuery = query.Encode()
	result := authURL.String()

	return &result, nil
}

func (s *AuthSocialRepository) SignIn(code string) (*domain.SocialAuthResponse, error) {
	artifacts := api.NewHttpArtifacts(
		s.config.Http.URL+enums.OAuth2Endpoint,
		utils.FormURLHeaders(),
		s.buildURLForm(code),
		true,
	)

	response, err := api.Post[any, domain.SocialAuthResponse](s.api, artifacts, nil)
	if err != nil {
		return nil, err
	}

	if e := s.manageStatus(response.Status, response.Response.Error); e != nil {
		return nil, e
	}

	return &response.Response, nil
}

func (s *AuthSocialRepository) buildURLForm(code string) url.Values {
	values := url.Values{}
	values.Set(enums.GrantType, enums.AuthorizationCode)
	values.Set(enums.Code, code)
	values.Set(enums.RedirectURI, s.config.CallBackURL)
	values.Set(enums.ClientID, s.config.Auth.ClientID)
	values.Set(enums.ClientSecret, s.config.Auth.ClientSecret)
	return values
}

func (s *AuthSocialRepository) manageStatus(status int, err string) error {
	if status == http.StatusOK {
		return nil
	} else if status == http.StatusBadRequest && err == enums.InvalidGrant {
		return domain.ErrSocialInvalidGrant
	} else {
		return domain.ErrSocialSignIn
	}
}
