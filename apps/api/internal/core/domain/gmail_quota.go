package domain

import (
	"errors"
	"fmt"
	"time"
)

// Cupos de Google mientras la app no está verificada (plan/28 §7, decisión D3 de JuanMa): aviso al equipo cada 10
// cuentas usadas, un resumen semanal desde 30 y, al llegar a GmailDefaultBlockAt, no se ofrecen conexiones de Gmail
// nuevas (reconectar la misma cuenta no gasta cupo).

const (
	// GmailAlertStep: the team is told every this many accounts used
	GmailAlertStep = 10
	// GmailWeeklyFrom: from this many accounts used the team gets a weekly summary (time to start CASA)
	GmailWeeklyFrom = 30
	// GmailDefaultBlockAt: from this many accounts used no new Gmail connection is offered (GMAIL_BLOCK_AT)
	GmailDefaultBlockAt = 86
)

// ErrGmailFull: no room for a new Gmail account until Google verifies the app
var ErrGmailFull = errors.New("gmail connections are full")

// GmailFullMessage is what the user reads when there is no room (the front shows it)
const GmailFullMessage = "Estamos trabajando para aumentar los límites de Google. Por ahora no hay espacio para más conexiones de Gmail: puedes conectar un correo de Outlook o Hotmail, o volver en unos días."

// GmailQuotaSettings come from the configuration
type GmailQuotaSettings struct {
	// Baseline is the counter of Google Auth Platform → Audience on BaselineAt (GMAIL_OAUTH_BASELINE[_AT])
	Baseline   int64
	BaselineAt *time.Time
	// BlockAt: from this many accounts used no new Gmail connection is offered (0 = GmailDefaultBlockAt)
	BlockAt int64
	// Verified: Google approved the app, there is no cap any more (GMAIL_VERIFIED)
	Verified bool
}

// GmailGrants are the counts of gmail_oauth_grants
type GmailGrants struct {
	Total int64 // accounts that ever connected (by hash)
	Since int64 // of them, first connected after BaselineAt
}

// GmailQuota: accounts of Google used vs. the cap. Used is an estimate of Google's own counter (the source of
// truth, Google Auth Platform → Audience): the baseline read there plus the new accounts since, never less than the
// accounts the database ever saw.
type GmailQuota struct {
	Connected int64  `json:"connected"` // distinct Gmail addresses connected today
	Used      int64  `json:"used"`
	Cap       int    `json:"cap"`
	BlockAt   int64  `json:"block_at"`
	Verified  bool   `json:"verified"`
	Blocked   bool   `json:"blocked"`   // no new Gmail connection is offered
	Threshold int64  `json:"threshold"` // last multiple of GmailAlertStep reached (0 = none)
	Weekly    bool   `json:"weekly"`    // the weekly summary is on (Used >= GmailWeeklyFrom)
	Note      string `json:"note"`
}

// NewGmailQuota computes the quota from the settings and the counts
func NewGmailQuota(s GmailQuotaSettings, grants GmailGrants, connected int64) GmailQuota {
	blockAt := s.BlockAt
	if blockAt <= 0 {
		blockAt = GmailDefaultBlockAt
	}
	used := grants.Total
	if s.BaselineAt != nil {
		if estimated := s.Baseline + grants.Since; estimated > used {
			used = estimated
		}
	} else if s.Baseline > used {
		used = s.Baseline
	}
	q := GmailQuota{Connected: connected, Used: used, Cap: GmailUserCap, BlockAt: blockAt, Verified: s.Verified}
	if !s.Verified {
		q.Blocked = used >= blockAt
		q.Threshold = used / GmailAlertStep * GmailAlertStep
		q.Weekly = used >= GmailWeeklyFrom
	}
	q.Note = "Estimado: lo que decía Google en la fecha base más las cuentas nuevas desde entonces. Google cuenta también " +
		"las cuentas borradas: compáralo con Google Auth Platform → Público cada semana y actualiza GMAIL_OAUTH_BASELINE."
	if s.Verified {
		q.Note = "La app está verificada (GMAIL_VERIFIED): no hay tope de cuentas."
	}
	return q
}

// Left is how many accounts remain before the cap
func (q GmailQuota) Left() int64 {
	return int64(q.Cap) - q.Used
}

// GmailWeekKey is the dedupe key of the weekly summary (ISO week in Bogotá)
func GmailWeekKey(now time.Time) string {
	year, week := now.In(MetricsLocation()).ISOWeek()
	return fmt.Sprintf("%d-W%02d", year, week)
}
