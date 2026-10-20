package utils

import "math"

// Round rounds a float64 value to a specified number of decimal places
func Round(value float64, places int) float64 {
	shift := math.Pow(10, float64(places))
	return math.Round(value*shift) / shift
}

func RoundV3(value float64, places int) *float64 {
	roundedValue := Round(value, places)
	return &roundedValue
}

func DifferencePercentage(diff, old float64) *float64 {
	if old != 0 {
		if diff == 0 {
			return RoundV3(0, 2)
		}
		return RoundV3((diff/math.Abs(old))*100, 2)
	} else if diff != 0 {
		return RoundV3((diff/math.Abs(diff))*100, 2)
	}

	return nil
}

func UsagePercentage(value, budget float64) *float64 {
	if budget == 0 {
		return nil
	}

	relation := (value - budget) / math.Abs(budget)

	if budget > 0 {
		return RoundV3((relation+1)*100, 2)
	}

	return RoundV3((relation-1)*100, 2)
}

func CalculateRemaining(value, budget float64) *float64 {
	return RoundV3(budget-value, 2)
}

func Normalize(value *float64) float64 {
	if value == nil {
		return 0
	}

	return *value
}
