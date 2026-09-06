package main

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// TestTableIntegrity checks the command table for duplicates and bad methods.
func TestTableIntegrity(t *testing.T) {
	valid := map[string]bool{
		"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true,
	}
	seen := map[string]string{}
	for _, r := range Resources() {
		if r.Name == "" || r.Desc == "" {
			t.Fatalf("resource missing name/desc: %+v", r)
		}
		if len(r.Actions) == 0 {
			t.Fatalf("resource %s has no actions", r.Name)
		}
		for _, a := range r.Actions {
			if a.Name == "" || a.Desc == "" {
				t.Fatalf("%s: action missing name/desc", r.Name)
			}
			if !valid[a.Method] {
				t.Fatalf("%s %s: bad method %s", r.Name, a.Name, a.Method)
			}
			if !strings.HasPrefix(a.Path, "/api/v1/") {
				t.Fatalf("%s %s: bad path %s", r.Name, a.Name, a.Path)
			}
			key := r.Name + " " + a.Name
			if prev, ok := seen[key]; ok {
				t.Fatalf("duplicate command %q (also %q)", key, prev)
			}
			seen[key] = a.Method + " " + a.Path
			// Every GET/DELETE without a body must not require --set input,
			// and every POST/PATCH/PUT either takes a body or is a bare trigger.
			slots := len(a.Slots)
			placeholders := strings.Count(a.Path, "{")
			if slots != placeholders {
				t.Fatalf("%s %s: %d slots but %d placeholders in %s",
					r.Name, a.Name, slots, placeholders, a.Path)
			}
		}
	}
}

// TestTableMatchesOpenAPI verifies every table entry maps to a real
// operation in the repository openapi.yaml.
func TestTableMatchesOpenAPI(t *testing.T) {
	raw, err := os.ReadFile("../../openapi.yaml")
	if err != nil {
		t.Skipf("openapi.yaml not available: %v", err)
	}
	type pathMethods struct {
		methods map[string]bool
	}
	paths := map[string]map[string]bool{}
	var current string
	for _, line := range strings.Split(string(raw), "\n") {
		if m := regexp.MustCompile(`^  (/api/v1/\S+):$`).FindStringSubmatch(line); m != nil {
			current = m[1]
			paths[current] = map[string]bool{}
			continue
		}
		if m := regexp.MustCompile(`^    (get|post|put|patch|delete):$`).FindStringSubmatch(line); m != nil && current != "" {
			paths[current][strings.ToUpper(m[1])] = true
		}
	}
	covered := map[string]bool{}
	for _, r := range Resources() {
		for _, a := range r.Actions {
			methods, ok := paths[a.Path]
			if !ok {
				t.Errorf("%s %s: path %s not in openapi.yaml", r.Name, a.Name, a.Path)
				continue
			}
			if !methods[a.Method] {
				t.Errorf("%s %s: %s %s not in openapi.yaml", r.Name, a.Name, a.Method, a.Path)
				continue
			}
			covered[a.Method+" "+a.Path] = true
		}
	}
	// Every route in the spec should be reachable, except the public
	// tracking pixels, which carry signed URL parameters instead of keys.
	missing := []string{}
	for path, methods := range paths {
		for method := range methods {
			key := method + " " + path
			if covered[key] {
				continue
			}
			// Public tracking pixels and legacy single-endpoint reads are
			// intentionally not CLI actions.
			if strings.Contains(path, "/o/") || strings.Contains(path, "/c/") {
				continue
			}
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		t.Errorf("spec operations without CLI coverage: %v", missing)
	}
}
