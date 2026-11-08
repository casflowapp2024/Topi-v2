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
