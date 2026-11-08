// Package templates implements port.MailRenderer with embedded html/template + text/template files.
//
// Each template <name> has two files in files/:
//   - <name>.txt: {{define "subject"}} (text, without amounts or merchants) and {{define "text"}} (plain body)
//   - <name>.html: {{define "content"}}, wrapped by layout.html (brand palette, no remote images)
//
// Missing data is an error (missingkey=error), so a typo never sends an email with "<no value>".
package templates

import (
	"bytes"
	"cash-flow/internal/core/domain"
	"embed"
	"fmt"
	htmltemplate "html/template"
	"io/fs"
	"path"
	"strings"
	texttemplate "text/template"
)

//go:embed files/*
var files embed.FS

const layoutFile = "files/layout.html"

// Renderer renders the embedded templates
type Renderer struct {
	html map[string]*htmltemplate.Template
	text map[string]*texttemplate.Template
}

// New parses every template; it fails if one is broken (checked at startup and in tests)
func New() (*Renderer, error) {
	r := &Renderer{
		html: map[string]*htmltemplate.Template{},
		text: map[string]*texttemplate.Template{},
	}

	names, err := fs.Glob(files, "files/*.txt")
	if err != nil {
		return nil, err
	}

	for _, file := range names {
		name := strings.TrimSuffix(path.Base(file), ".txt")

		text, err := texttemplate.New(name).Option("missingkey=error").ParseFS(files, file)
		if err != nil {
			return nil, fmt.Errorf("template %s.txt: %w", name, err)
		}
		if text.Lookup("subject") == nil || text.Lookup("text") == nil {
			return nil, fmt.Errorf("template %s.txt must define subject and text", name)
		}

		html, err := htmltemplate.New("layout.html").Option("missingkey=error").
			ParseFS(files, layoutFile, "files/"+name+".html")
		if err != nil {
			return nil, fmt.Errorf("template %s.html: %w", name, err)
		}
		if html.Lookup("content") == nil {
			return nil, fmt.Errorf("template %s.html must define content", name)
		}

		r.text[name] = text
		r.html[name] = html
	}

	return r, nil
}

// Names returns the available templates
func (r *Renderer) Names() []string {
	names := make([]string, 0, len(r.text))
	for name := range r.text {
		names = append(names, name)
	}
	return names
}

// Render executes the subject, the HTML (inside the layout) and the text body
func (r *Renderer) Render(name string, data map[string]any) (*domain.RenderedEmail, error) {
	text, ok := r.text[name]
	if !ok {
		return nil, fmt.Errorf("unknown template %q", name)
	}

	var subject, body, html bytes.Buffer
	if err := text.ExecuteTemplate(&subject, "subject", data); err != nil {
		return nil, err
	}
	if err := text.ExecuteTemplate(&body, "text", data); err != nil {
		return nil, err
	}

	// the layout needs the subject (title) and the optional unsubscribe link
	layoutData := map[string]any{}
	for key, value := range data {
		layoutData[key] = value
	}
	layoutData["subject"] = strings.TrimSpace(subject.String())
	if _, ok := layoutData["unsubscribe_url"]; !ok {
		layoutData["unsubscribe_url"] = ""
	}
	if err := r.html[name].ExecuteTemplate(&html, "layout.html", layoutData); err != nil {
		return nil, err
	}

	return &domain.RenderedEmail{
		Subject: strings.TrimSpace(subject.String()),
		HTML:    html.String(),
		Text:    strings.TrimSpace(body.String()) + "\n",
	}, nil
}
