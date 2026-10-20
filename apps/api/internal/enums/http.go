package enums

const (
	GrantType         = "grant_type"
	RedirectURI       = "redirect_uri"
	ClientID          = "client_id"
	ClientSecret      = "client_secret"
	Code              = "code"
	AuthorizationCode = "authorization_code"
	Scope             = "scope"

	ContentTypeHeader = "Content-Type"
	FormURLHeader     = "application/x-www-form-urlencoded"
)

const (
	OAuth2Endpoint = "/oauth2/token"
	OAuthAuthorize = "/oauth2/authorize"
)

const (
	OutlookAuthEndpoint  = "authorize"
	OutlookTokenEndpoint = "token"
)

const (
	Post   = "POST"
	Get    = "GET"
	Put    = "PUT"
	Delete = "DELETE"
)
