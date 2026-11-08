package templates

import (
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// sampleData has the data each template needs (the previews use it too)
var sampleData = map[string]map[string]any{
	"password_code": {"code": "482913", "minutes": 10},
	"verify_email":  {"code": "730154", "minutes": 10},
	"connection_down": {"connection_email": "ana.banco@gmail.com", "provider": "Gmail",
		"unsubscribe_url": "https://api.topi.test/mail/unsubscribe?t=abc"},
	"monthly_summary": {"month": "2026-10", "month_name": "octubre de 2026", "income": "$5.200.000",
		"expenses": "$3.950.500", "savings": "$1.249.500", "saved": true, "has_activity": true,
		"top_category": "Mercado", "top_category_amount": "$1.120.000",
		"unsubscribe_url": "https://api.topi.test/mail/unsubscribe?t=abc"},
}

// amount-like text ($ 1.234, 1.234.567) must never appear in a subject
var amountInSubject = regexp.MustCompile(`\$|\d{1,3}(\.\d{3})+`)

func TestAllTemplatesRender(t *testing.T) {
	r, err := New()
	require.NoError(t, err)
	require.NotEmpty(t, r.Names())

	for _, name := range r.Names() {
		t.Run(name, func(t *testing.T) {
			data, ok := sampleData[name]
			require.True(t, ok, "add sample data for %s", name)
			data = withCommon(data)

			out, err := r.Render(name, data)
			require.NoError(t, err)

			assert.NotEmpty(t, out.Subject)
			assert.NotContains(t, out.Subject, "\n")
			assert.False(t, amountInSubject.MatchString(out.Subject), "no amounts in subjects: %q", out.Subject)
			assert.Contains(t, out.HTML, "<!doctype html>")
			assert.Contains(t, out.HTML, "#5266EB", "brand color")
			assert.NotContains(t, out.HTML, "<no value>")
			assert.NotContains(t, out.Text, "<no value>")
			assert.NotContains(t, strings.ToLower(out.HTML), "<img", "no remote images")
		})
	}
}

func TestPasswordCode(t *testing.T) {
	r, err := New()
	require.NoError(t, err)

	out, err := r.Render("password_code", withCommon(sampleData["password_code"]))
	require.NoError(t, err)

	assert.Contains(t, out.HTML, "482913")
	assert.Contains(t, out.Text, "482913")
	assert.NotContains(t, out.Subject, "482913", "the code is not in the subject")
	assert.NotContains(t, out.HTML, "Dejar de recibir", "transactional: no unsubscribe link")
}

func TestMissingDataFails(t *testing.T) {
	r, err := New()
	require.NoError(t, err)

	_, err = r.Render("password_code", map[string]any{"app_url": "https://app.test"})
	assert.Error(t, err)

	_, err = r.Render("does_not_exist", nil)
	assert.Error(t, err)
}

func TestHTMLEscapesData(t *testing.T) {
	r, err := New()
	require.NoError(t, err)

	out, err := r.Render("password_code", withCommon(map[string]any{"code": "<script>", "minutes": 10}))
	require.NoError(t, err)
	assert.NotContains(t, out.HTML, "<script>")
}

func withCommon(data map[string]any) map[string]any {
	out := map[string]any{"app_url": "https://www.topi.test"}
	for key, value := range data {
		out[key] = value
	}
	return out
}

func TestConnectionDownHasUnsubscribeAndLink(t *testing.T) {
	r, err := New()
	require.NoError(t, err)

	out, err := r.Render("connection_down", withCommon(sampleData["connection_down"]))
	require.NoError(t, err)

	assert.Contains(t, out.HTML, "https://www.topi.test/dashboard?settings=connections")
	assert.Contains(t, out.HTML, "ana.banco@gmail.com")
	assert.Contains(t, out.HTML, "Dejar de recibir estos correos")
	assert.Contains(t, out.Text, "https://api.topi.test/mail/unsubscribe?t=abc")
}

func TestMonthlySummary(t *testing.T) {
	r, err := New()
	require.NoError(t, err)

	out, err := r.Render("monthly_summary", withCommon(sampleData["monthly_summary"]))
	require.NoError(t, err)
	assert.Equal(t, "Tu resumen de octubre de 2026 en Topi", out.Subject)
	assert.Contains(t, out.HTML, "$5.200.000")
	assert.Contains(t, out.HTML, "Mercado")
	assert.Contains(t, out.HTML, "Dejar de recibir estos correos")
	assert.Contains(t, out.Text, "https://api.topi.test/mail/unsubscribe?t=abc")

	empty := withCommon(sampleData["monthly_summary"])
	empty["has_activity"] = false
	out, err = r.Render("monthly_summary", empty)
	require.NoError(t, err)
	assert.Contains(t, out.HTML, "No registramos movimientos")
	assert.NotContains(t, out.HTML, "$5.200.000")
}
