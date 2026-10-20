package utils

func ContainsInt(item uint64, slice []uint64) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}
