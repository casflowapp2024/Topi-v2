package utils

import (
	"strings"
	"unicode"
)

// Contains is a function that receives a  text and a substring and checks if the substring is contained in the text
func Contains(text string, sub string) bool {
	return strings.Contains(text, sub)
}

// Capitalize is a function that receives a string and returns the string with the first letter capitalized
func Capitalize(s string) string {
	if len(s) == 0 {
		return ""
	}
	// Convert the string to a slice of runes to handle multi-byte characters correctly
	runes := []rune(strings.ToLower(s))

	// Uppercase the first rune
	runes[0] = unicode.ToUpper(runes[0])

	// Convert the rune slice back to a string
	return string(runes)
}

func CapitalizeEachWord(s string) string {
	words := strings.Fields(s)

	for i, word := range words {
		words[i] = Capitalize(word)
	}

	return strings.Join(words, " ")
}

// SplitAndTrimEmails splits a comma-separated string of emails and trims whitespace from each
func SplitAndTrimEmails(emails *string) []string {
	if emails == nil || *emails == "" {
		return []string{}
	}

	emailList := strings.Split(*emails, ",")
	result := make([]string, 0, len(emailList))

	for _, email := range emailList {
		trimmed := strings.TrimSpace(email)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}
