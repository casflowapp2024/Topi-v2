package resend

import (
	"cash-flow/internal/core/domain"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// test secret (not a real one): whsec_ + base64("topi-test-webhook-secret-32bytes")
var testSecret = "whsec_" + base64.StdEncoding.EncodeToString([]byte("topi-test-webhook-secret-32bytes"))

func sign(t *testing.T, id string, ts int64, body string) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte("topi-test-webhook-secret-32bytes"))
	mac.Write([]byte(id + "." + strconv.FormatInt(ts, 10) + "." + body))
	return "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

const bounceBody = `{"type":"email.bounced","created_at":"2026-11-07T15:00:00Z","data":{"email_id":"re_abc","to":["Ana@Example.com"],"bounce":{"type":"Permanent","subType":"General"}}}`

func TestWebhookParser(t *testing.T) {
	now := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	p := NewWebhookParser(testSecret)
	p.now = func() time.Time { return now }
	ts := now.Unix()

	t.Run("valid signature", func(t *testing.T) {
		// several signatures (key rotation): one valid is enough
		event, err := p.Parse("msg_1", strconv.FormatInt(ts, 10), "v1,AAAA "+sign(t, "msg_1", ts, bounceBody), []byte(bounceBody))
		require.NoError(t, err)
		assert.Equal(t, &domain.MailEvent{Type: "email.bounced", ProviderID: "re_abc", To: []string{"Ana@Example.com"}, BounceType: "Permanent"}, event)
		assert.True(t, event.IsHardBounce())
	})

	t.Run("invalid", func(t *testing.T) {
		good := sign(t, "msg_1", ts, bounceBody)
		cases := map[string]func() (string, string, string, string){
			"tampered body": func() (string, string, string, string) {
				return "msg_1", strconv.FormatInt(ts, 10), good, bounceBody + " "
			},
			"other id": func() (string, string, string, string) { return "msg_2", strconv.FormatInt(ts, 10), good, bounceBody },
			"old timestamp": func() (string, string, string, string) {
				old := ts - 600
				return "msg_1", strconv.FormatInt(old, 10), sign(t, "msg_1", old, bounceBody), bounceBody
			},
			"no signature": func() (string, string, string, string) { return "msg_1", strconv.FormatInt(ts, 10), "", bounceBody },
			"other version": func() (string, string, string, string) {
				return "msg_1", strconv.FormatInt(ts, 10), "v2," + good[3:], bounceBody
			},
			"bad timestamp": func() (string, string, string, string) { return "msg_1", "yesterday", good, bounceBody },
		}
		for name, build := range cases {
			id, stamp, signature, body := build()
			_, err := p.Parse(id, stamp, signature, []byte(body))
			assert.ErrorIs(t, err, ErrInvalidSignature, name)
		}
	})

	t.Run("without secret nothing is trusted", func(t *testing.T) {
		empty := NewWebhookParser("")
		empty.now = p.now
		_, err := empty.Parse("msg_1", strconv.FormatInt(ts, 10), sign(t, "msg_1", ts, bounceBody), []byte(bounceBody))
		assert.ErrorIs(t, err, ErrInvalidSignature)
	})
}

func TestIsHardBounce(t *testing.T) {
	assert.True(t, domain.MailEvent{Type: domain.MailEventBounced}.IsHardBounce())
	assert.True(t, domain.MailEvent{Type: domain.MailEventBounced, BounceType: "Permanent"}.IsHardBounce())
	assert.False(t, domain.MailEvent{Type: domain.MailEventBounced, BounceType: "Transient"}.IsHardBounce())
	assert.False(t, domain.MailEvent{Type: domain.MailEventComplained}.IsHardBounce())
}
