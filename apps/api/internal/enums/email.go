package enums

const (
	EmailTableName  = "emails"
	EmailJobsTable  = "email_jobs"
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

// Email job priorities (email_jobs.priority)
const (
	EmailJobPriorityNormal int16 = 0
	EmailJobPriorityHigh   int16 = 1 // "leer ahora"
)
