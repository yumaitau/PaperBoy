package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func mustParse(t *testing.T, args []string) (Config, *Invocation) {
	t.Helper()
	os.Setenv("PAPERBOY_API_KEY", "test-key")
	defer os.Unsetenv("PAPERBOY_API_KEY")
	cfg, inv, err := ParseArgs(args)
	if err != nil {
		t.Fatalf("ParseArgs(%v): %v", args, err)
	}
	return cfg, inv
}

func TestParseBasics(t *testing.T) {
	cfg, inv := mustParse(t, []string{"templates", "get", "abc-123"})
	if inv.Resource.Name != "templates" || inv.Action.Name != "get" {
		t.Fatalf("wrong lookup: %+v", inv.Action)
	}
	if cfg.Endpoint != "http://localhost:3000" {
		t.Fatalf("default endpoint: %s", cfg.Endpoint)
	}

	cfg, _ = mustParse(t, []string{"-e", "https://api.example.com/", "-k", "k", "templates", "list"})
	if cfg.Endpoint != "https://api.example.com/" || cfg.APIKey != "k" {
		t.Fatalf("flags: %+v", cfg)
	}

	if _, _, err := ParseArgs([]string{"nope", "list"}); err == nil {
		t.Fatal("expected unknown resource error")
	}
	os.Setenv("PAPERBOY_API_KEY", "test-key")
	defer os.Unsetenv("PAPERBOY_API_KEY")
	if _, _, err := ParseArgs([]string{"templates", "get"}); err == nil {
		t.Fatal("expected missing positional error")
	}
	if _, _, err := ParseArgs([]string{"templates", "list", "--set", "a=b"}); err == nil {
		t.Fatal("expected --set rejection on bodyless action")
	}
}

func TestRequestURL(t *testing.T) {
	_, inv := mustParse(t, []string{"contacts", "get", "reader@example.net"})
	u, err := inv.RequestURL("http://localhost:3000/")
	if err != nil {
		t.Fatal(err)
	}
	if u != "http://localhost:3000/api/v1/contacts/reader@example.net" {
		t.Fatalf("url: %s", u)
	}

	_, inv = mustParse(t, []string{
		"broadcasts", "recipients", "b123",
		"--query", "type=opened", "--query", "limit=10",
	})
	u, err = inv.RequestURL("http://localhost:3000")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(u, "http://localhost:3000/api/v1/broadcasts/b123/recipients?") ||
		!strings.Contains(u, "type=opened") || !strings.Contains(u, "limit=10") {
		t.Fatalf("url: %s", u)
	}
}

func TestBuildBody(t *testing.T) {
	_, inv := mustParse(t, []string{
		"templates", "create",
		"--set", "name=Welcome",
		"--set", "required_variables=[\"a\"]",
		"--json", `{"subject": "Hi"}`,
	})
	raw, ct, err := inv.BuildBody()
	if err != nil {
		t.Fatal(err)
	}
	if ct != "application/json" {
		t.Fatalf("content type: %s", ct)
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if body["name"] != "Welcome" || body["subject"] != "Hi" {
		t.Fatalf("body: %v", body)
	}
	if vars, ok := body["required_variables"].([]any); !ok || vars[0] != "a" {
		t.Fatalf("coercion: %v", body)
	}

	// --body-file wins as the base document.
	dir := t.TempDir()
	file := filepath.Join(dir, "batch.json")
	if err := os.WriteFile(file, []byte(`[{"to":"a@x.com"}]`), 0o600); err != nil {
		t.Fatal(err)
	}
	_, inv = mustParse(t, []string{"emails", "send-batch", "--body-file", file})
	raw, _, err = inv.BuildBody()
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(raw)) != `[{"to":"a@x.com"}]` {
		t.Fatalf("body file: %s", raw)
	}
}

func TestRoundTrip(t *testing.T) {
	var gotMethod, gotPath, gotAuth, gotCT string
	var gotBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotCT = r.Header.Get("Content-Type")
		gotBody, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"123"}`))
	}))
	defer server.Close()

	cfg, inv := mustParse(t, []string{
		"-e", server.URL, "templates", "create",
		"--set", "name=Welcome", "--set", "subject=Hi",
	})
	payload, status, err := inv.Do(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if status != http.StatusCreated {
		t.Fatalf("status: %d", status)
	}
	if gotMethod != "POST" || gotPath != "/api/v1/templates" {
		t.Fatalf("request: %s %s", gotMethod, gotPath)
	}
	if gotAuth != "Bearer test-key" || gotCT != "application/json" {
		t.Fatalf("headers: %q %q", gotAuth, gotCT)
	}
	var body map[string]any
	if err := json.Unmarshal(gotBody, &body); err != nil {
		t.Fatal(err)
	}
	if body["name"] != "Welcome" {
		t.Fatalf("body: %v", body)
	}
	var out bytes.Buffer
	if err := PrintJSON(&out, payload, false); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), `"id": "123"`) {
		t.Fatalf("output: %s", out.String())
	}
}

func TestHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"error":{"code":"validation_error"}}`))
	}))
	defer server.Close()

	cfg, inv := mustParse(t, []string{"-e", server.URL, "templates", "list"})
	_, status, err := inv.Do(cfg)
	herr, ok := err.(*httpError)
	if !ok || status != 422 || herr.Status != 422 {
		t.Fatalf("err: %v status %d", err, status)
	}
}

func TestMultipartUpload(t *testing.T) {
	var gotCT string
	var gotFile []byte
	fields := map[string]string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotCT = r.Header.Get("Content-Type")
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Errorf("parse: %v", err)
		}
		for k, v := range r.MultipartForm.Value {
			fields[k] = v[0]
		}
		f, _, err := r.FormFile("file")
		if err != nil {
			t.Errorf("form file: %v", err)
		} else {
			gotFile, _ = io.ReadAll(f)
			f.Close()
		}
		_, _ = w.Write([]byte(`{"status":"completed"}`))
	}))
	defer server.Close()

	dir := t.TempDir()
	csv := filepath.Join(dir, "contacts.csv")
	if err := os.WriteFile(csv, []byte("email\na@x.com\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, inv := mustParse(t, []string{
		"-e", server.URL, "contacts", "import",
		"--file", csv, "--set", "on_conflict=upsert",
	})
	if _, _, err := inv.Do(cfg); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(gotCT, "multipart/form-data") {
		t.Fatalf("content type: %s", gotCT)
	}
	if string(gotFile) != "email\na@x.com\n" || fields["on_conflict"] != "upsert" {
		t.Fatalf("upload: %q %v", gotFile, fields)
	}
}

func TestRunHelpAndVersion(t *testing.T) {
	var out bytes.Buffer
	if err := run([]string{"version"}, &out, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "paperboy ") {
		t.Fatalf("version: %s", out.String())
	}
	out.Reset()
	if err := run([]string{"templates", "help"}, &out, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "paperboy templates create") {
		t.Fatalf("help: %s", out.String())
	}
}
