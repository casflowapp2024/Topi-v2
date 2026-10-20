package utils

import (
	"cash-flow/internal/enums"
	"net/http"
)

func DefaultHeaders() http.Header {
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	headers.Set("Accept", "application/json")
	return headers
}

func FormURLHeaders() http.Header {
	header := http.Header{}
	header.Set(enums.ContentTypeHeader, enums.FormURLHeader)
	return header
}
