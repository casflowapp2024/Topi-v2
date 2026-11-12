package domain

import "time"

// MetricsTimeZone is the zone used to cut days and weeks in the admin metrics (plan/25-admin-metricas.md).
// The SQL of the metrics uses the same zone.
const MetricsTimeZone = "America/Bogota"

// MetricsLocation returns MetricsTimeZone, or UTC-5 when the tz database is not available
func MetricsLocation() *time.Location {
	loc, err := time.LoadLocation(MetricsTimeZone)
	if err != nil {
		return time.FixedZone(MetricsTimeZone, -5*60*60)
	}
	return loc
}

// ActivityDay returns the day (midnight, MetricsTimeZone) of an instant
func ActivityDay(at time.Time) time.Time {
	local := at.In(MetricsLocation())
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
}

// Product events: closed list (the CHECK of product_events has the same names). Props carry ids and short
// enums only: never amounts, merchants or free text.
const (
	ProductEventCategoryCorrected = "tx_category_corrected"
	ProductEventAmountCorrected   = "tx_amount_corrected"
	ProductEventReviewResolved    = "review_resolved"
	ProductEventBudgetCreated     = "budget_created"
	ProductEventInsightDismissed  = "insight_dismissed"
	ProductEventInsightFeedback   = "insight_feedback"
	ProductEventAskTopiAsked      = "ask_topi_asked"
)

// Kinds of review_resolved (what was waiting in Por revisar)
const (
	ReviewKindVerify       = "verify"
	ReviewKindInstallments = "installments"
	ReviewKindCounterpart  = "counterpart"
	ReviewKindTransfer     = "transfer"
)

// productEventProps lists the props each event accepts and whether each one is an id (number) or an enum
var productEventProps = map[string]map[string]propKind{
	ProductEventCategoryCorrected: {"transaction_id": propID},
	ProductEventAmountCorrected:   {"transaction_id": propID},
	ProductEventReviewResolved:    {"transaction_id": propID, "kind": propEnum, "dismissed": propBool},
	ProductEventBudgetCreated:     {"category_id": propID},
	ProductEventInsightDismissed:  {"insight": propEnum},
	ProductEventInsightFeedback:   {"insight": propEnum, "useful": propBool},
	ProductEventAskTopiAsked:      {},
}

var reviewKinds = map[string]bool{ReviewKindVerify: true, ReviewKindInstallments: true, ReviewKindCounterpart: true, ReviewKindTransfer: true}

type propKind int

const (
	propID propKind = iota
	propEnum
	propBool
)

// maxEnumLength bounds an enum prop: anything longer is not an enum
const maxEnumLength = 30

// ProductEvent is one row of product_events
type ProductEvent struct {
	UserID string
	Name   string
	Props  map[string]any
}

// Validate checks the name against the closed list and every prop against its kind
func (e ProductEvent) Validate() error {
	allowed, ok := productEventProps[e.Name]
	if !ok || e.UserID == "" {
		return ErrInvalidProductEvent
	}
	for key, value := range e.Props {
		kind, ok := allowed[key]
		if !ok {
			return ErrInvalidProductEvent
		}
		switch kind {
		case propID:
			if !isID(value) {
				return ErrInvalidProductEvent
			}
		case propBool:
			if _, ok := value.(bool); !ok {
				return ErrInvalidProductEvent
			}
		case propEnum:
			text, ok := value.(string)
			if !ok || text == "" || len(text) > maxEnumLength || !isEnumText(text) {
				return ErrInvalidProductEvent
			}
			if e.Name == ProductEventReviewResolved && key == "kind" && !reviewKinds[text] {
				return ErrInvalidProductEvent
			}
		}
	}
	return nil
}

func isID(value any) bool {
	switch v := value.(type) {
	case uint64:
		return true
	case int64:
		return v >= 0
	case int:
		return v >= 0
	default:
		return false
	}
}

// isEnumText: lowercase letters, digits and underscores (no spaces: never free text)
func isEnumText(text string) bool {
	for _, r := range text {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '_') {
			return false
		}
	}
	return true
}
