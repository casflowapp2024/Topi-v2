package http

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"errors"
	"html/template"
	"net/http"

	"github.com/gin-gonic/gin"
)

// MailHandler serves the email preferences, the unsubscribe links and the provider webhook
type MailHandler struct {
	prefs  port.NotificationService
	appURL string
}

// NewMailHandler creates a MailHandler. appURL is the web app (links of the unsubscribe page).
func NewMailHandler(prefs port.NotificationService, appURL string) *MailHandler {
	return &MailHandler{prefs: prefs, appURL: appURL}
}

// GetNotificationPrefs godoc
//
//	@Summary		Email preferences of the user
//	@Tags			Users
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response{data=domain.NotificationPrefs}	"Preferences"
//	@Router			/users/notification-prefs [get]
func (mh *MailHandler) GetNotificationPrefs(ctx *gin.Context) {
	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	prefs, err := mh.prefs.GetPrefs(ctx, *userID)
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, prefs)
}

// notificationPrefsRequest: every field is required so a partial body never turns something off
type notificationPrefsRequest struct {
	MonthlySummary   *bool `json:"email_monthly_summary" binding:"required"`
	ConnectionAlerts *bool `json:"email_connection_alerts" binding:"required"`
}

// UpdateNotificationPrefs godoc
//
//	@Summary		Update the email preferences
//	@Description	The monthly summary is off by default; connection alerts are on.
//	@Tags			Users
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			notificationPrefsRequest	body		notificationPrefsRequest				true	"Preferences"
//	@Success		200							{object}	response{data=domain.NotificationPrefs}	"Saved"
//	@Failure		400							{object}	errorResponse							"Validation error"
//	@Router			/users/notification-prefs [put]
func (mh *MailHandler) UpdateNotificationPrefs(ctx *gin.Context) {
	var req notificationPrefsRequest

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		validationError(ctx, err)
		return
	}

	prefs, err := mh.prefs.UpdatePrefs(ctx, *userID, domain.NotificationPrefs{
		MonthlySummary:   *req.MonthlySummary,
		ConnectionAlerts: *req.ConnectionAlerts,
	})
	if err != nil {
		handleError(ctx, err)
		return
	}

	handleSuccess(ctx, prefs)
}

var unsubscribeNames = map[string]string{
	domain.UnsubMonthlySummary:   "el resumen mensual",
	domain.UnsubConnectionAlerts: "los avisos de conexiones de correo",
}

var unsubscribePage = template.Must(template.New("unsubscribe").Parse(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Topi · Correos</title></head>
<body style="margin:0;background:#f8fafc;font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
<div style="max-width:440px;margin:48px auto;padding:0 16px;">
<div style="font-size:22px;font-weight:800;color:#5266EB;margin-bottom:16px;">Topi</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;font-size:15px;line-height:1.6;">
{{if .Invalid}}
<p style="margin:0 0 12px 0;font-weight:700;">El enlace no es válido</p>
<p style="margin:0;">Puede estar incompleto. Puedes cambiar qué correos recibes en Topi, en Ajustes &gt; Correos.</p>
{{else if .Done}}
<p style="margin:0 0 12px 0;font-weight:700;">Listo</p>
<p style="margin:0;">Ya no recibirás {{.Name}}. Puedes volver a activarlo cuando quieras en Ajustes &gt; Correos.</p>
{{else}}
<p style="margin:0 0 16px 0;">¿Quieres dejar de recibir {{.Name}}?</p>
<form method="post" style="margin:0;"><button type="submit" style="background:#5266EB;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;">Sí, dejar de recibirlos</button></form>
{{end}}
<p style="margin:20px 0 0 0;"><a href="{{.AppURL}}/dashboard?settings=emails" style="color:#5266EB;">Ir a mis preferencias en Topi</a></p>
</div></div></body></html>`))

type unsubscribeView struct {
	Name    string
	Done    bool
	Invalid bool
	AppURL  string
}

// UnsubscribeForm godoc
//
//	@Summary		Unsubscribe page (no login)
//	@Description	Shows a confirmation button. GET never changes anything (mail scanners open links).
//	@Tags			Mail
//	@Produce		html
//	@Param			t	query	string	true	"Signed token"
//	@Router			/mail/unsubscribe [get]
func (mh *MailHandler) UnsubscribeForm(ctx *gin.Context) {
	kind, ok := mh.kindOf(ctx.Query("t"))
	if !ok {
		mh.page(ctx, http.StatusBadRequest, unsubscribeView{Invalid: true})
		return
	}
	mh.page(ctx, http.StatusOK, unsubscribeView{Name: unsubscribeNames[kind]})
}

// Unsubscribe godoc
//
//	@Summary		Unsubscribe (one click, RFC 8058)
//	@Description	Applies the signed link: from the page button or from the List-Unsubscribe-Post of the mail client.
//	@Tags			Mail
//	@Produce		html
//	@Param			t	query	string	true	"Signed token"
//	@Router			/mail/unsubscribe [post]
func (mh *MailHandler) Unsubscribe(ctx *gin.Context) {
	kind, err := mh.prefs.Unsubscribe(ctx, ctx.Query("t"))
	if errors.Is(err, domain.ErrInvalidUnsubscribeToken) || errors.Is(err, domain.ErrUserNotFoundException) {
		mh.page(ctx, http.StatusBadRequest, unsubscribeView{Invalid: true})
		return
	}
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Inténtalo de nuevo en unos minutos")
		return
	}
	mh.page(ctx, http.StatusOK, unsubscribeView{Name: unsubscribeNames[kind], Done: true})
}

// kindOf validates the token without applying it (the GET page)
func (mh *MailHandler) kindOf(token string) (string, bool) {
	kind, err := mh.prefs.CheckUnsubscribe(token)
	return kind, err == nil
}

func (mh *MailHandler) page(ctx *gin.Context, status int, view unsubscribeView) {
	view.AppURL = mh.appURL
	ctx.Header("Cache-Control", "no-store")
	ctx.Header("Content-Type", "text/html; charset=utf-8")
	ctx.Status(status)
	_ = unsubscribePage.Execute(ctx.Writer, view)
}
