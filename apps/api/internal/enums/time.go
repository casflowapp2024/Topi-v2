package enums

import "time"

const (
	BogotaTimeZone  = "America/Bogota"
	DateTimeUtc     = "2006-01-02 15:04:05 -0700"
	Date            = "2006-01-02"
	YearMonthLayout = "2006-01"
)

var (
	BogotaLocation, _ = time.LoadLocation(BogotaTimeZone)
)

var (
	OffsetToZone = map[int16]string{
		-12: "Etc/GMT+12", // Note: Etc/GMT+12 is actually UTC-12
		-11: "Etc/GMT+11",
		-10: "Pacific/Honolulu",
		-9:  "America/Anchorage",
		-8:  "America/Los_Angeles",
		-7:  "America/Denver",
		-6:  "America/Chicago",
		-5:  "America/Bogota",
		-4:  "America/Caracas",
		-3:  "America/Sao_Paulo",
		-2:  "Atlantic/South_Georgia",
		-1:  "Atlantic/Azores",
		0:   "UTC",
		1:   "Europe/Paris",
		2:   "Europe/Cairo",
		3:   "Europe/Moscow",
		4:   "Asia/Dubai",
		5:   "Asia/Karachi",
		6:   "Asia/Dhaka",
		7:   "Asia/Bangkok",
		8:   "Asia/Shanghai",
		9:   "Asia/Tokyo",
		10:  "Australia/Sydney",
		11:  "Pacific/Guadalcanal",
		12:  "Pacific/Auckland",
		13:  "Pacific/Tongatapu",
		14:  "Pacific/Kiritimati",
	}

	ZoneToOffset = map[string]int16{
		"Etc/GMT+12":             -12,
		"Etc/GMT+11":             -11,
		"Pacific/Honolulu":       -10,
		"America/Anchorage":      -9,
		"America/Los_Angeles":    -8,
		"America/Denver":         -7,
		"America/Chicago":        -6,
		"America/Bogota":         -5,
		"America/Caracas":        -4,
		"America/Sao_Paulo":      -3,
		"Atlantic/South_Georgia": -2,
		"Atlantic/Azores":        -1,
		"UTC":                    0,
		"Europe/Paris":           1,
		"Europe/Cairo":           2,
		"Europe/Moscow":          3,
		"Asia/Dubai":             4,
		"Asia/Karachi":           5,
		"Asia/Dhaka":             6,
		"Asia/Bangkok":           7,
		"Asia/Shanghai":          8,
		"Asia/Tokyo":             9,
		"Australia/Sydney":       10,
		"Pacific/Guadalcanal":    11,
		"Pacific/Auckland":       12,
		"Pacific/Tongatapu":      13,
		"Pacific/Kiritimati":     14,
	}
)
