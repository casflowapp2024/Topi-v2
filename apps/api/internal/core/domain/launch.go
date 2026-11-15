package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Staged rollout (plan/27 §I): I.1 close people → I.2 communities → I.3 open. Each stage passes to the next when
// its criteria hold; the panel shows them against the real numbers and the decision is written in the plan.

const (
	StageI1 = "I.1"
	StageI2 = "I.2"
	StageI3 = "I.3"

	// GmailUserCap is the lifetime limit of OAuth users of an unverified app (plan/27 §A)
	GmailUserCap = 100
	// LaunchDefaultWindow measures activation when no stage started yet
	LaunchDefaultWindow = 30 * 24 * time.Hour
)

// LaunchStageOrder is the order of the stages
var LaunchStageOrder = []string{StageI1, StageI2, StageI3}

var (
	// ErrInvalidLaunchStage: unknown stage, bad date, date in the future or note too long
	ErrInvalidLaunchStage = errors.New("invalid launch stage")
)

// LaunchStage is one row of launch_stages
type LaunchStage struct {
	Stage     string    `json:"stage"`
	StartedAt string    `json:"started_at"` // YYYY-MM-DD (Bogotá)
	Note      string    `json:"note"`
	SetBy     string    `json:"-"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Validate checks the stage, the date (not in the future) and the note
func (s *LaunchStage) Validate(today time.Time) error {
	known := false
	for _, st := range LaunchStageOrder {
		if st == s.Stage {
			known = true
		}
	}
	day, err := time.Parse(time.DateOnly, strings.TrimSpace(s.StartedAt))
	if !known || err != nil || day.After(today) {
		return ErrInvalidLaunchStage
	}
	s.StartedAt = day.Format(time.DateOnly)
	s.Note = strings.TrimSpace(s.Note)
	if utf8.RuneCountInString(s.Note) > 500 {
		return ErrInvalidLaunchStage
	}
	return nil
}

// CurrentStage is the latest stage that started ("" = none yet)
func CurrentStage(stages []LaunchStage) *LaunchStage {
	var current *LaunchStage
	for _, name := range LaunchStageOrder {
		for i := range stages {
			if stages[i].Stage == name {
				current = &stages[i]
			}
		}
	}
	return current
}

// LaunchCriterion is one condition to pass a stage. OK nil = it is checked by hand (the panel says how).
type LaunchCriterion struct {
	Stage  string `json:"stage"`
	Label  string `json:"label"`
	Target string `json:"target"`
	Value  string `json:"value"`
	OK     *bool  `json:"ok"`
}

// GmailQuota: distinct Gmail addresses connected today vs. the cap. Google's own counter (Google Auth Platform →
// Audience) is the source of truth: it also counts connections that were removed.
type GmailQuota struct {
	Connected int64  `json:"connected"`
	Cap       int    `json:"cap"`
	Note      string `json:"note"`
}

// LaunchReport is GET /admin/launch
type LaunchReport struct {
	Stages         []LaunchStage     `json:"stages"`
	Current        string            `json:"current"`
	ActivationFrom string            `json:"activation_from"`
	Activation     ActivationRates   `json:"activation"`
	UASNow         float64           `json:"uas_now"`
	UASWeeks       []DayValue        `json:"uas_weeks"`
	RetentionW4Pct *float64          `json:"retention_w4_pct"`
	Gmail          GmailQuota        `json:"gmail"`
	Reconnect      ReconnectStats    `json:"reconnect"`
	FeedbackUnread int64             `json:"feedback_unread"`
	Criteria       []LaunchCriterion `json:"criteria"`
}

func boolPtr(v bool) *bool { return &v }

// lastWeeksAtLeast: the last n weekly points are all >= min (false if there are fewer than n)
func lastWeeksAtLeast(weeks []DayValue, n int, min float64) bool {
	if len(weeks) < n {
		return false
	}
	for _, w := range weeks[len(weeks)-n:] {
		if w.Value < min {
			return false
		}
	}
	return true
}

func pctText(v *float64) string {
	if v == nil {
		return "—"
	}
	return fmt.Sprintf("%.0f %%", *v)
}

// EvaluateLaunch fills the criteria of the three stages (plan/27 §I, table "Despliegue por etapas")
func (r *LaunchReport) EvaluateLaunch() {
	conn := r.Activation.Connection24hPct
	auto := r.Activation.FirstAuto48hPct
	hasSignups := r.Activation.Signups > 0
	uas := r.UASNow

	r.Criteria = []LaunchCriterion{
		{Stage: StageI1, Label: "Correo conectado en 24 h", Target: "≥ 60 %", Value: fmt.Sprintf("%.0f %% de %d registros", conn, r.Activation.Signups), OK: boolPtr(hasSignups && conn >= 60)},
		{Stage: StageI1, Label: "1.ª transacción automática en 48 h", Target: "≥ 50 %", Value: fmt.Sprintf("%.0f %%", auto), OK: boolPtr(hasSignups && auto >= 50)},
		{Stage: StageI1, Label: "Usuarios al día semanales (UAS)", Target: "≥ 10", Value: fmt.Sprintf("%.0f", uas), OK: boolPtr(uas >= 10)},
		{Stage: StageI1, Label: "Errores graves abiertos", Target: "0", Value: "revisar a mano", OK: nil},
		{Stage: StageI2, Label: "UAS ≥ 50 sostenido", Target: "2 semanas", Value: fmt.Sprintf("%.0f hoy", uas), OK: boolPtr(lastWeeksAtLeast(r.UASWeeks, 2, 50))},
		{Stage: StageI2, Label: "Retención S4 (al día en la semana 4)", Target: "≥ 30 %", Value: pctText(r.RetentionW4Pct), OK: boolPtr(r.RetentionW4Pct != nil && *r.RetentionW4Pct >= 30)},
		{Stage: StageI2, Label: "Costo por usuario activo", Target: "dentro del presupuesto", Value: "ver Costos", OK: nil},
		{Stage: StageI3, Label: "UAS ≥ 50 sostenido (encender Apoyar a Topi)", Target: "4 semanas", Value: fmt.Sprintf("%.0f hoy", uas), OK: boolPtr(lastWeeksAtLeast(r.UASWeeks, 4, 50))},
		{Stage: StageI3, Label: "Verificación de Google aprobada", Target: "aprobada", Value: "revisar en Google Cloud", OK: nil},
		{Stage: StageI1, Label: "Cupos de Gmail (app sin verificar)", Target: fmt.Sprintf("< %d de por vida", GmailUserCap),
			Value: fmt.Sprintf("%d conectadas hoy", r.Gmail.Connected), OK: boolPtr(r.Gmail.Connected < GmailUserCap-10)},
	}
}
