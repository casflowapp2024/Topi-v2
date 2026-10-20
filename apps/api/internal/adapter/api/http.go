package api

import (
	"bytes"
	"cash-flow/internal/enums"
	"encoding/json"
	"github.com/pkg/errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type HttpClient struct {
	Client *http.Client
}

type HttpArtifacts struct {
	endpoint   string
	header     http.Header
	values     url.Values
	urlEncoded bool
}

type HttPResponse[R any] struct {
	Response R
	Status   int
}

func NewHttpClient(timeOut time.Duration) *HttpClient {
	return &HttpClient{
		Client: &http.Client{Timeout: timeOut},
	}
}

func NewHttpArtifacts(endpoint string, header http.Header, values url.Values, URLEncoded bool) *HttpArtifacts {
	return &HttpArtifacts{
		endpoint:   endpoint,
		header:     header,
		values:     values,
		urlEncoded: URLEncoded,
	}
}

func Get[R any](call *HttpClient, artifacts *HttpArtifacts) (HttPResponse[R], error) {
	var result HttPResponse[R]

	response, err := call.Client.Get(artifacts.endpoint)
	if err != nil {
		return result, errors.Wrap(err, "error making post request to endpoint")
	}

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return result, errors.Wrap(err, "error reading response body")
	}

	err = json.Unmarshal(responseBody, &result.Response)
	if err != nil {
		return result, errors.Wrap(err, "error unmarshalling response body")
	}

	result.Status = response.StatusCode

	return result, nil
}

func Post[B any, R any](call *HttpClient, artifacts *HttpArtifacts, request B) (HttPResponse[R], error) {
	var (
		result     HttPResponse[R]
		bodyReader io.Reader
	)

	if artifacts.urlEncoded {
		bodyReader = strings.NewReader(artifacts.values.Encode())
	} else {
		body, err := json.Marshal(request)
		if err != nil {
			return result, err
		}

		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(enums.Post, artifacts.endpoint, bodyReader)
	if err != nil {
		return result, err
	}

	req.Header = artifacts.header

	rsp, err := call.Client.Do(req)
	if err != nil {
		return result, errors.Wrap(err, "error making post request to endpoint")
	}

	bodyRsp, err := io.ReadAll(rsp.Body)
	if err != nil {
		return result, errors.Wrap(err, "error making post request to endpoint")
	}

	err = json.Unmarshal(bodyRsp, &result.Response)
	if err != nil {
		return result, errors.Wrap(err, "error unmarshalling response body")
	}

	result.Status = rsp.StatusCode

	return result, nil
}

func Put[B any, R any](call *HttpClient, artifacts *HttpArtifacts, request B) (HttPResponse[R], error) {
	var (
		result     HttPResponse[R]
		bodyReader io.Reader
	)

	if artifacts.urlEncoded {
		bodyReader = strings.NewReader(artifacts.values.Encode())
	} else {
		body, err := json.Marshal(request)
		if err != nil {
			return result, err
		}

		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(enums.Put, artifacts.endpoint, bodyReader)
	if err != nil {
		return result, err
	}

	req.Header = artifacts.header

	rsp, err := call.Client.Do(req)
	if err != nil {
		return result, errors.Wrap(err, "error making update request to endpoint")
	}

	bodyRsp, err := io.ReadAll(rsp.Body)
	if err != nil {
		return result, errors.Wrap(err, "error making update request to endpoint")
	}

	err = json.Unmarshal(bodyRsp, &result.Response)
	if err != nil {
		return result, errors.Wrap(err, "error unmarshalling response body")
	}

	result.Status = rsp.StatusCode

	return result, nil
}
