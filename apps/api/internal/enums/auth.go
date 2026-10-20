package enums

const (
	JwksUrl      = "https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json"
	CognitoHost  = "https://cognito-idp.%s.amazonaws.com/%s"
	Algorithm    = "RS256"
	TokenUse     = "token_use"
	ClientId     = "client_id"
	AccessUse    = "access"
	IdUse        = "id"
	UserGroups   = "cognito:groups"
	InvalidGrant = "invalid_grant"
)
