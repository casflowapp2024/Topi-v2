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
