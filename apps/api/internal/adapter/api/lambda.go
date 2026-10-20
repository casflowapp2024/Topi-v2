package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws/session"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
	"github.com/pkg/errors"
)

func LambdaPost[B any, R any](call *HttpClient, artifacts *HttpArtifacts, request B) (HttPResponse[R], error) {
	var result HttPResponse[R]

	body, err := json.Marshal(request)
	if err != nil {
		return result, errors.Wrap(err, "failed to marshal request body")
	}

	req, err := http.NewRequest(http.MethodPost, artifacts.endpoint, bytes.NewReader(body))
	if err != nil {
		return result, errors.Wrap(err, "failed to create http request")
	}

	req.Header.Set("Content-Type", "application/json")

	sess, err := session.NewSession()
	if err != nil {
		return result, errors.Wrap(err, "failed to create aws session")
	}

	signer := v4.NewSigner(sess.Config.Credentials)
	_, err = signer.Sign(req, bytes.NewReader(body), "lambda", os.Getenv("REGION"), time.Now())
	if err != nil {
		return result, errors.Wrap(err, "failed to sign request")
	}

	resp, err := call.Client.Do(req)
	if err != nil {
		return result, errors.Wrap(err, "failed to execute request")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		result.Status = resp.StatusCode
		return result, nil
	}

	if resp.StatusCode >= http.StatusInternalServerError {
		result.Status = resp.StatusCode
		return result, errors.Errorf("internal server error from lambda")
	}

	bodyResp, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, errors.Wrap(err, "failed to read response body")
	}

	err = json.Unmarshal(bodyResp, &result.Response)
	if err != nil {
		return result, errors.Wrap(err, "failed to unmarshal response")
	}

	result.Status = resp.StatusCode

	return result, nil
}
