package enums

const (
	EmailTableName  = "emails"
	GmailStateToken = "state-token"
	Gmail           = "gmail"
	Outlook         = "outlook"
)

// Operation constants for logging
const (
	GetEmailAuthURLOp = "GetEmailAuthURL"
	RegisterEmailOp   = "RegisterEmail"
	GetEmailTokenOp   = "GetEmailToken"
	GetListEmailOp    = "GetListEmail"
	UpdateEmailOp     = "UpdateEmail"
	DeleteEmailOp     = "DeleteEmail"
	SaveEmailErrorOp  = "SaveEmailError"
)
