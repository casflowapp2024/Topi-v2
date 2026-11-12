package domain

import "time"

// FounderActiveDays: an eligible user is an active founder candidate with real activity in this many days
// (opened the app, or a healthy email connection with automatic transactions), plan/22-modelo-negocio.md
const FounderActiveDays = 90

// FounderRow is an eligible user in the founders section (no amounts)
type FounderRow struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	SignupAt      time.Time `json:"signup_at"`
	LastActiveDay *string   `json:"last_active_day"`
	// Active: opened the app in FounderActiveDays days (app) or has a healthy connection with automatic
	// transactions in that period (reading)
	Active      bool       `json:"active"`
	ActiveBy    []string   `json:"active_by"`
	ConfirmedAt *time.Time `json:"confirmed_at"`
}

// FounderList splits the eligible users in active and without activity
type FounderList struct {
	Eligible  int64        `json:"eligible"`
	Confirmed int64        `json:"confirmed"`
	Active    []FounderRow `json:"active"`
	Inactive  []FounderRow `json:"inactive"`
}

// FounderBulkResult is the summary of "Confirmar fundadores activos" (preview or applied)
type FounderBulkResult struct {
	DryRun           bool  `json:"dry_run"`
	ToConfirm        int64 `json:"to_confirm"`
	Confirmed        int64 `json:"confirmed"`
	AlreadyConfirmed int64 `json:"already_confirmed"`
	Inactive         int64 `json:"inactive"`
}
