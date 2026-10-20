package utils

import (
	"cash-flow/internal/enums"
	"strconv"
	"time"
)

func GetTimeDuration(duration string) time.Duration {
	durationInt, err := strconv.Atoi(duration)
	if err != nil {
		return time.Duration(500) * time.Millisecond
	}
	return time.Duration(durationInt) * time.Millisecond
}

func GetUtcOffset(value time.Time) int64 {
	_, offsetSeconds := value.Zone()
	return int64(offsetSeconds / 3600)
}

func FormatDate(value time.Time) string {
	return value.Format(enums.Date)
}

func FormatDateTime(date string, sumStart, sumEnd int) (start, end time.Time, err error) {
	end, err = time.Parse(enums.YearMonthLayout, date)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	start = end.AddDate(0, sumStart, 0)
	end = end.AddDate(0, sumEnd, 0)

	return
}

// FormatFRDates formats the start and end dates for the financial report
// Calculate start and end times for financial summary (previous month to current month)
// Calculate start and end times for the balance summary (current month only)
func FormatFRDates(date time.Time) (start, balanceStart, end time.Time) {
	// Get the first day of the current month
	firstDayCurrentMonth := time.Date(
		date.Year(),
		date.Month(),
		1,
		0,
		0,
		0,
		0,
		date.Location(),
	)

	// Current date balance start
	balanceStart = firstDayCurrentMonth

	// Start is the first day of the previous month
	start = firstDayCurrentMonth.AddDate(0, -1, 0)

	// End is the first day of the next month
	end = firstDayCurrentMonth.AddDate(0, 1, 0)

	return
}

func FormatARDates(startStr, endStr string) (start, end time.Time, err error) {
	start, err = time.Parse(enums.Date, startStr)
	if err != nil {
		return
	}

	end, err = time.Parse(enums.Date, endStr)
	if err != nil {
		return
	}

	// Add 1 day to end to make it inclusive
	end = end.AddDate(0, 0, 1)

	return
}
