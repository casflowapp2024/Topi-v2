package utils

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGetTimeDuration(t *testing.T) {
	testCases := []struct {
		name     string
		duration string
		expected time.Duration
	}{
		{
			name:     "should return correct duration when valid positive integer",
			duration: "1000",
			expected: 1000 * time.Millisecond,
		},
		{
			name:     "should return correct duration when zero",
			duration: "0",
			expected: 0 * time.Millisecond,
		},
		{
			name:     "should return default duration when empty string",
			duration: "",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return default duration when non-numeric string",
			duration: "abc",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return default duration when floating point number",
			duration: "123.45",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return correct duration when negative integer",
			duration: "-100",
			expected: -100 * time.Millisecond,
		},
		{
			name:     "should return default duration when mixed alphanumeric",
			duration: "123abc",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return default duration when special characters",
			duration: "!@#$%",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return default duration when whitespace only",
			duration: "   ",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return default duration when very large number exceeding int range",
			duration: "99999999999999999999",
			expected: 500 * time.Millisecond,
		},
		{
			name:     "should return correct duration when single digit",
			duration: "5",
			expected: 5 * time.Millisecond,
		},
		{
			name:     "should return default duration when number with leading/trailing spaces",
			duration: " 100 ",
			expected: 500 * time.Millisecond,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := GetTimeDuration(tc.duration)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestGetUtcOffset(t *testing.T) {
	testCases := []struct {
		name     string
		time     time.Time
		expected int64
	}{
		{
			name:     "should return zero when UTC time",
			time:     time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
			expected: 0,
		},
		{
			name: "should return positive offset when eastern timezone",
			time: time.Date(
				2023,
				1,
				1,
				12,
				0,
				0,
				0,
				time.FixedZone("EST", -5*3600),
			),
			expected: -5,
		},
		{
			name: "should return negative offset when tokyo timezone",
			time: time.Date(
				2023,
				1,
				1,
				12,
				0,
				0,
				0,
				time.FixedZone("JST", 9*3600),
			),
			expected: 9,
		},
		{
			name: "should return correct offset when half hour timezone",
			time: time.Date(
				2023,
				1,
				1,
				12,
				0,
				0,
				0,
				time.FixedZone("IST", 5*3600+1800),
			),
			expected: 5,
		},
		{
			name: "should return correct offset when quarter hour timezone",
			time: time.Date(
				2023,
				1,
				1,
				12,
				0,
				0,
				0,
				time.FixedZone("NPT", 5*3600+2700),
			),
			expected: 5,
		},
		{
			name:     "should return zero when zero time with UTC",
			time:     time.Time{}.UTC(),
			expected: 0,
		},
		{
			name: "should return correct offset when maximum positive timezone",
			time: time.Date(
				2023,
				1,
				1,
				12,
				0,
				0,
				0,
				time.FixedZone("UTC+14", 14*3600),
			),
			expected: 14,
		},
		{
			name: "should return correct offset when maximum negative timezone",
			time: time.Date(
				2023,
				1,
				1,
				12,
				0,
				0,
				0,
				time.FixedZone("UTC-12", -12*3600),
			),
			expected: -12,
		},
		{
			name: "should return correct offset when end of year",
			time: time.Date(
				2023,
				12,
				31,
				23,
				59,
				59,
				999999999,
				time.FixedZone("CET", 1*3600),
			),
			expected: 1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := GetUtcOffset(tc.time)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestFormatDateTime(t *testing.T) {
	testCases := []struct {
		name          string
		date          string
		sumStart      int
		sumEnd        int
		expectedErr   bool
		expectedStart time.Time
		expectedEnd   time.Time
	}{
		{
			name:          "should return correct dates when valid year-month format",
			date:          "2023-01",
			sumStart:      0,
			sumEnd:        1,
			expectedErr:   false,
			expectedStart: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 2, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when negative sumStart",
			date:          "2023-06",
			sumStart:      -3,
			sumEnd:        0,
			expectedErr:   false,
			expectedStart: time.Date(2023, 3, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when negative sumEnd",
			date:          "2023-12",
			sumStart:      0,
			sumEnd:        -2,
			expectedErr:   false,
			expectedStart: time.Date(2023, 12, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 10, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when both negative values",
			date:          "2023-08",
			sumStart:      -1,
			sumEnd:        -3,
			expectedErr:   false,
			expectedStart: time.Date(2023, 7, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 5, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return error when invalid date format",
			date:          "invalid-date",
			sumStart:      0,
			sumEnd:        1,
			expectedErr:   true,
			expectedStart: time.Time{},
			expectedEnd:   time.Time{},
		},
		{
			name:          "should return error when empty string",
			date:          "",
			sumStart:      0,
			sumEnd:        1,
			expectedErr:   true,
			expectedStart: time.Time{},
			expectedEnd:   time.Time{},
		},
		{
			name:          "should return error when wrong format with day",
			date:          "2023-01-15",
			sumStart:      0,
			sumEnd:        1,
			expectedErr:   true,
			expectedStart: time.Time{},
			expectedEnd:   time.Time{},
		},
		{
			name:          "should return error when only year",
			date:          "2023",
			sumStart:      0,
			sumEnd:        1,
			expectedErr:   true,
			expectedStart: time.Time{},
			expectedEnd:   time.Time{},
		},
		{
			name:          "should return error when invalid month",
			date:          "2023-13",
			sumStart:      0,
			sumEnd:        1,
			expectedErr:   true,
			expectedStart: time.Time{},
			expectedEnd:   time.Time{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			start, end, err := FormatDateTime(tc.date, tc.sumStart, tc.sumEnd)

			if tc.expectedErr {
				assert.Error(t, err)
				assert.Equal(t, tc.expectedStart, start)
				assert.Equal(t, tc.expectedEnd, end)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedStart, start)
				assert.Equal(t, tc.expectedEnd, end)
			}
		})
	}
}

func TestFormatFRDates(t *testing.T) {
	testCases := []struct {
		name                 string
		inputDate            time.Time
		expectedStart        time.Time
		expectedBalanceStart time.Time
		expectedEnd          time.Time
	}{
		{
			name:                 "should return correct dates when regular mid-month date",
			inputDate:            time.Date(2023, 6, 15, 10, 30, 0, 0, time.UTC),
			expectedStart:        time.Date(2023, 5, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2023, 7, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when first day of month",
			inputDate:            time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC),
			expectedStart:        time.Date(2023, 5, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2023, 7, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when last day of month",
			inputDate:            time.Date(2023, 6, 30, 23, 59, 59, 999999999, time.UTC),
			expectedStart:        time.Date(2023, 5, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2023, 7, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when January month",
			inputDate:            time.Date(2023, 1, 15, 12, 0, 0, 0, time.UTC),
			expectedStart:        time.Date(2022, 12, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2023, 2, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when December month",
			inputDate:            time.Date(2023, 12, 25, 18, 45, 30, 0, time.UTC),
			expectedStart:        time.Date(2023, 11, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 12, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when leap year February",
			inputDate:            time.Date(2024, 2, 29, 6, 15, 45, 0, time.UTC),
			expectedStart:        time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when non-leap year February",
			inputDate:            time.Date(2023, 2, 28, 14, 22, 11, 0, time.UTC),
			expectedStart:        time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 2, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2023, 3, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should preserve timezone when different timezone",
			inputDate:            time.Date(2023, 6, 15, 10, 30, 0, 0, time.FixedZone("EST", -5*3600)),
			expectedStart:        time.Date(2023, 5, 1, 0, 0, 0, 0, time.FixedZone("EST", -5*3600)),
			expectedBalanceStart: time.Date(2023, 6, 1, 0, 0, 0, 0, time.FixedZone("EST", -5*3600)),
			expectedEnd:          time.Date(2023, 7, 1, 0, 0, 0, 0, time.FixedZone("EST", -5*3600)),
		},
		{
			name:                 "should handle zero time correctly when zero time provided",
			inputDate:            time.Time{},
			expectedStart:        time.Date(0, 12, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(1, 2, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:                 "should return correct dates when year boundary crossing",
			inputDate:            time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedStart:        time.Date(2022, 12, 1, 0, 0, 0, 0, time.UTC),
			expectedBalanceStart: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:          time.Date(2023, 2, 1, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			start, balanceStart, end := FormatFRDates(tc.inputDate)

			assert.Equal(t, tc.expectedStart, start, "start date should match expected")
			assert.Equal(t, tc.expectedBalanceStart, balanceStart, "balance start date should match expected")
			assert.Equal(t, tc.expectedEnd, end, "end date should match expected")

			// Additional assertions to verify the logic
			assert.True(t, start.Before(balanceStart), "start should be before balance start")
			assert.True(t, balanceStart.Before(end), "balance start should be before end")
			assert.True(t, start.Before(end), "start should be before end")

			// Verify that all times are set to midnight (00:00:00)
			assert.Equal(t, 0, start.Hour(), "start hour should be 0")
			assert.Equal(t, 0, start.Minute(), "start minute should be 0")
			assert.Equal(t, 0, start.Second(), "start second should be 0")
			assert.Equal(t, 0, start.Nanosecond(), "start nanosecond should be 0")

			assert.Equal(t, 0, balanceStart.Hour(), "balance start hour should be 0")
			assert.Equal(t, 0, balanceStart.Minute(), "balance start minute should be 0")
			assert.Equal(t, 0, balanceStart.Second(), "balance start second should be 0")
			assert.Equal(t, 0, balanceStart.Nanosecond(), "balance start nanosecond should be 0")

			assert.Equal(t, 0, end.Hour(), "end hour should be 0")
			assert.Equal(t, 0, end.Minute(), "end minute should be 0")
			assert.Equal(t, 0, end.Second(), "end second should be 0")
			assert.Equal(t, 0, end.Nanosecond(), "end nanosecond should be 0")

			// Verify that all dates are the first day of their respective months
			assert.Equal(t, 1, start.Day(), "start should be first day of month")
			assert.Equal(t, 1, balanceStart.Day(), "balance start should be first day of month")
			assert.Equal(t, 1, end.Day(), "end should be first day of month")

			// Verify timezone preservation
			_, inputOffset := tc.inputDate.Zone()
			_, startOffset := start.Zone()
			_, balanceStartOffset := balanceStart.Zone()
			_, endOffset := end.Zone()

			assert.Equal(t, inputOffset, startOffset, "start timezone should match input")
			assert.Equal(t, inputOffset, balanceStartOffset, "balance start timezone should match input")
			assert.Equal(t, inputOffset, endOffset, "end timezone should match input")
		})
	}
}

func TestFormatARDates(t *testing.T) {
	testCases := []struct {
		name          string
		startStr      string
		endStr        string
		expectedErr   bool
		expectedStart time.Time
		expectedEnd   time.Time
	}{
		{
			name:          "should return correct dates when valid date strings",
			startStr:      "2023-06-15",
			endStr:        "2023-06-20",
			expectedErr:   false,
			expectedStart: time.Date(2023, 6, 15, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 6, 21, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when same start and end date",
			startStr:      "2023-06-15",
			endStr:        "2023-06-15",
			expectedErr:   false,
			expectedStart: time.Date(2023, 6, 15, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 6, 16, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when end date is before start date",
			startStr:      "2023-06-20",
			endStr:        "2023-06-15",
			expectedErr:   false,
			expectedStart: time.Date(2023, 6, 20, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 6, 16, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when crossing month boundary",
			startStr:      "2023-06-28",
			endStr:        "2023-07-05",
			expectedErr:   false,
			expectedStart: time.Date(2023, 6, 28, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 7, 6, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when crossing year boundary",
			startStr:      "2023-12-25",
			endStr:        "2024-01-05",
			expectedErr:   false,
			expectedStart: time.Date(2023, 12, 25, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2024, 1, 6, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when leap year February 29th",
			startStr:      "2024-02-28",
			endStr:        "2024-02-29",
			expectedErr:   false,
			expectedStart: time.Date(2024, 2, 28, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when end of February non-leap year",
			startStr:      "2023-02-27",
			endStr:        "2023-02-28",
			expectedErr:   false,
			expectedStart: time.Date(2023, 2, 27, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 3, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when first day of year",
			startStr:      "2023-01-01",
			endStr:        "2023-01-01",
			expectedErr:   false,
			expectedStart: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when last day of year",
			startStr:      "2023-12-31",
			endStr:        "2023-12-31",
			expectedErr:   false,
			expectedStart: time.Date(2023, 12, 31, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:          "should return correct dates when span multiple years",
			startStr:      "2020-01-01",
			endStr:        "2023-12-31",
			expectedErr:   false,
			expectedStart: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC),
			expectedEnd:   time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:        "should return error when invalid start date format",
			startStr:    "invalid-date",
			endStr:      "2023-06-20",
			expectedErr: true,
		},
		{
			name:        "should return error when invalid end date format",
			startStr:    "2023-06-15",
			endStr:      "invalid-date",
			expectedErr: true,
		},
		{
			name:        "should return error when both dates are invalid",
			startStr:    "invalid-start",
			endStr:      "invalid-end",
			expectedErr: true,
		},
		{
			name:        "should return error when empty start date",
			startStr:    "",
			endStr:      "2023-06-20",
			expectedErr: true,
		},
		{
			name:        "should return error when empty end date",
			startStr:    "2023-06-15",
			endStr:      "",
			expectedErr: true,
		},
		{
			name:        "should return error when both dates are empty",
			startStr:    "",
			endStr:      "",
			expectedErr: true,
		},
		{
			name:        "should return error when wrong date format with time",
			startStr:    "2023-06-15 10:30:00",
			endStr:      "2023-06-20 15:45:00",
			expectedErr: true,
		},
		{
			name:        "should return error when extra characters",
			startStr:    "2023-06-15abc",
			endStr:      "2023-06-20xyz",
			expectedErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			start, end, err := FormatARDates(tc.startStr, tc.endStr)

			if tc.expectedErr {
				assert.Error(t, err, "should return error")
				// Note: When there's an error, we don't check the return values
				// as they depend on which parsing step failed
			} else {
				assert.NoError(t, err, "should not return error")
				assert.Equal(t, tc.expectedStart, start, "start date should match expected")
				assert.Equal(t, tc.expectedEnd, end, "end date should match expected")

				// Additional assertions to verify the logic
				originalEndDate, _ := time.Parse("2006-01-02", tc.endStr)
				expectedEndAfterAddition := originalEndDate.AddDate(0, 0, 1)
				assert.Equal(t, expectedEndAfterAddition, end, "end date should be 1 day after input end date")

				// Verify that all times are set to midnight (00:00:00)
				assert.Equal(t, 0, start.Hour(), "start hour should be 0")
				assert.Equal(t, 0, start.Minute(), "start minute should be 0")
				assert.Equal(t, 0, start.Second(), "start second should be 0")
				assert.Equal(t, 0, start.Nanosecond(), "start nanosecond should be 0")

				assert.Equal(t, 0, end.Hour(), "end hour should be 0")
				assert.Equal(t, 0, end.Minute(), "end minute should be 0")
				assert.Equal(t, 0, end.Second(), "end second should be 0")
				assert.Equal(t, 0, end.Nanosecond(), "end nanosecond should be 0")

				// Verify timezone is UTC
				assert.Equal(t, "UTC", start.Location().String(), "start timezone should be UTC")
				assert.Equal(t, "UTC", end.Location().String(), "end timezone should be UTC")
			}
		})
	}
}
