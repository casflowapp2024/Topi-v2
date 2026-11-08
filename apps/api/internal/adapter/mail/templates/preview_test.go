package templates

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestWritePreviews writes every template with its sample data to MAIL_PREVIEW_DIR (skipped otherwise):
//
//	MAIL_PREVIEW_DIR=/tmp/previews go test -run TestWritePreviews ./internal/adapter/mail/templates/
func TestWritePreviews(t *testing.T) {
	dir := os.Getenv("MAIL_PREVIEW_DIR")
	if dir == "" {
		t.Skip("MAIL_PREVIEW_DIR not set")
	}
	require.NoError(t, os.MkdirAll(dir, 0o755))

	r, err := New()
	require.NoError(t, err)
	for _, name := range r.Names() {
		out, err := r.Render(name, withCommon(sampleData[name]))
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(filepath.Join(dir, name+".html"), []byte(out.HTML), 0o644))
		require.NoError(t, os.WriteFile(filepath.Join(dir, name+".txt"), []byte("Asunto: "+out.Subject+"\n\n"+out.Text), 0o644))
	}
}
