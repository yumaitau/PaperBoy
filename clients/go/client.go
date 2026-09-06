package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Config holds global connection options.
type Config struct {
	Endpoint string
	APIKey   string
	Timeout  time.Duration
	Compact  bool
}

// Invocation holds the parsed command line for one action.
type Invocation struct {
	Resource *Resource
	Action   *Action
	Position []string
	Sets     map[string]string
	Queries  map[string]string
	JSONBody string
	BodyFile string
	File     string
}

type usageError struct{ msg string }

func (e *usageError) Error() string { return e.msg }

type httpError struct {
	Status int
	Body   []byte
}

func (e *httpError) Error() string { return "status " + strconv.Itoa(e.Status) }

// ParseArgs parses global flags plus resource/action/inputs.
// Flags may appear in any order: the first two non-flag arguments are the
// resource and action, remaining non-flag arguments fill positional slots.
func ParseArgs(args []string) (Config, *Invocation, error) {
	cfg := Config{Timeout: 30 * time.Second}
	inv := &Invocation{Sets: map[string]string{}, Queries: map[string]string{}}
	var position []string

	i := 0
	for i < len(args) {
		arg := args[i]
		var key, value string
		isFlag := false
		if strings.HasPrefix(arg, "--") {
			isFlag = true
			key = arg[2:]
			if idx := strings.IndexByte(key, '='); idx >= 0 {
				value = key[idx+1:]
				key = key[:idx]
			} else if i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") &&
				!strings.HasPrefix(args[i+1], "-") {
				i++
				value = args[i]
			}
		} else if arg == "-e" || arg == "-k" || arg == "-h" {
			isFlag = true
			key = arg[1:]
			if i+1 < len(args) {
				i++
				value = args[i]
			}
		}
		if !isFlag {
			position = append(position, arg)
			i++
			continue
		}

		switch key {
		case "e", "endpoint":
			cfg.Endpoint = value
		case "k", "api-key":
			cfg.APIKey = value
		case "timeout":
			seconds, err := strconv.Atoi(value)
			if err != nil || seconds <= 0 {
				return cfg, nil, &usageError{msg: "--timeout needs a positive number of seconds"}
			}
			cfg.Timeout = time.Duration(seconds) * time.Second
		case "compact":
			cfg.Compact = true
		case "set":
			k, v, ok := strings.Cut(value, "=")
			if !ok || k == "" {
				return cfg, nil, &usageError{msg: "--set needs key=value"}
			}
			inv.Sets[k] = v
		case "query":
			k, v, ok := strings.Cut(value, "=")
			if !ok || k == "" {
				return cfg, nil, &usageError{msg: "--query needs key=value"}
			}
			inv.Queries[k] = v
		case "json":
			inv.JSONBody = value
		case "body-file":
			inv.BodyFile = value
		case "file":
			inv.File = value
		case "h", "help":
			return cfg, nil, &usageError{msg: "help requested"}
		default:
			return cfg, nil, &usageError{msg: "unknown flag --" + key}
		}
		i++
	}

	if cfg.Endpoint == "" {
		cfg.Endpoint = os.Getenv("PAPERBOY_URL")
	}
	if cfg.Endpoint == "" {
		cfg.Endpoint = "http://localhost:3000"
	}
	if cfg.APIKey == "" {
		cfg.APIKey = os.Getenv("PAPERBOY_API_KEY")
	}

	if len(position) == 0 {
		return cfg, nil, &usageError{msg: "a resource is required"}
	}
	if position[0] == "help" {
		return cfg, nil, &usageError{msg: "help requested"}
	}
	if len(position) == 1 && (position[0] == "version" || position[0] == "--version" || position[0] == "-V") {
		return cfg, &Invocation{}, nil
	}
	if len(position) < 2 {
		return cfg, nil, &usageError{msg: "an action is required"}
	}

	resource, action, err := Lookup(position[0], position[1])
	if err != nil {
		return cfg, nil, err
	}
	inv.Resource, inv.Action = resource, action
	inv.Position = position[2:]

	if len(inv.Position) < len(action.Slots) {
		return cfg, nil, &usageError{msg: fmt.Sprintf(
			"action %s %s needs %d argument(s): %s",
			resource.Name, action.Name, len(action.Slots), strings.Join(action.Slots, ", "))}
	}
	if cfg.APIKey == "" {
		return cfg, nil, fmt.Errorf("set PAPERBOY_API_KEY or pass --api-key")
	}
	if err := inv.validate(); err != nil {
		return cfg, nil, err
	}
	return cfg, inv, nil
}

func (inv *Invocation) validate() error {
	if len(inv.Position) > len(inv.Action.Slots) {
		return &usageError{msg: fmt.Sprintf(
			"too many arguments for %s %s",
			inv.Resource.Name, inv.Action.Name)}
	}
	if len(inv.Sets) > 0 && !inv.Action.HasBody && inv.Action.Upload == "" {
		return &usageError{msg: "action does not accept --set"}
	}
	if len(inv.Queries) > 0 && !inv.Action.HasQuery {
		return &usageError{msg: "action does not accept --query"}
	}
	if inv.JSONBody != "" && !inv.Action.HasBody {
		return &usageError{msg: "action does not accept --json"}
	}
	if inv.BodyFile != "" && !inv.Action.HasBody {
		return &usageError{msg: "action does not accept --body-file"}
	}
	if inv.File != "" && inv.Action.Upload == "" {
		return &usageError{msg: "action does not accept --file"}
	}
	return nil
}

// RequestURL expands positional slots and appends query parameters.
// Placeholders are filled positionally: the nth slot fills the nth
// {placeholder} in the path, so CLI names can be friendlier than the
// template (for example contact-id-or-email fills {contactId}).
func (inv *Invocation) RequestURL(endpoint string) (string, error) {
	path := inv.Action.Path
	pos := 0
	for {
		start := strings.IndexByte(path, '{')
		end := strings.IndexByte(path, '}')
		if start < 0 || end < 0 || end < start {
			break
		}
		if pos >= len(inv.Position) {
			return "", &usageError{msg: "not enough positional arguments"}
		}
		path = path[:start] + url.PathEscape(inv.Position[pos]) + path[end+1:]
		pos++
	}
	if strings.Contains(path, "{") {
		return "", &usageError{msg: "not enough positional arguments"}
	}
	u := strings.TrimSuffix(endpoint, "/") + path
	if len(inv.Queries) > 0 {
		values := url.Values{}
		for k, v := range inv.Queries {
			values.Set(k, v)
		}
		u += "?" + values.Encode()
	}
	return u, nil
}

// BuildBody assembles the request body. --json and --body-file provide raw
// JSON, --set entries merge over it (values parsed as JSON when possible).
func (inv *Invocation) BuildBody() (body []byte, contentType string, err error) {
	if inv.Action.Upload != "" {
		return inv.buildFileBody()
	}
	if !inv.Action.HasBody {
		return nil, "", nil
	}
	merged := map[string]any{}
	if inv.JSONBody != "" {
		if err := json.Unmarshal([]byte(inv.JSONBody), &merged); err != nil {
			return nil, "", fmt.Errorf("invalid --json: %w", err)
		}
	}
	if inv.BodyFile != "" {
		raw, err := os.ReadFile(inv.BodyFile)
		if err != nil {
			return nil, "", fmt.Errorf("cannot read --body-file: %w", err)
		}
		merged = map[string]any{}
		if err := json.Unmarshal(raw, &merged); err != nil {
			// A top-level array (batch send) is valid too.
			var arr []any
			if jerr := json.Unmarshal(raw, &arr); jerr != nil {
				return nil, "", fmt.Errorf("invalid --body-file JSON: %w", jerr)
			}
			return raw, "application/json", nil
		}
	}
	for k, v := range inv.Sets {
		merged[k] = coerceValue(v)
	}
	if len(merged) == 0 {
		return nil, "", nil
	}
	raw, err := json.Marshal(merged)
	if err != nil {
		return nil, "", err
	}
	return raw, "application/json", nil
}

func (inv *Invocation) buildFileBody() ([]byte, string, error) {
	kind, param, _ := strings.Cut(inv.Action.Upload, ":")
	switch kind {
	case "raw":
		raw, err := os.ReadFile(inv.File)
		if err != nil {
			return nil, "", fmt.Errorf("cannot read --file: %w", err)
		}
		return raw, param, nil
	case "form":
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		for k, v := range inv.Sets {
			if err := writer.WriteField(k, v); err != nil {
				return nil, "", err
			}
		}
		raw, err := os.ReadFile(inv.File)
		if err != nil {
			return nil, "", fmt.Errorf("cannot read --file: %w", err)
		}
		part, err := writer.CreateFormFile(param, filepath.Base(inv.File))
		if err != nil {
			return nil, "", err
		}
		if _, err := part.Write(raw); err != nil {
			return nil, "", err
		}
		if err := writer.Close(); err != nil {
			return nil, "", err
		}
		return buf.Bytes(), writer.FormDataContentType(), nil
	default:
		return nil, "", fmt.Errorf("unsupported upload for this action")
	}
}

// coerceValue parses a --set value as JSON when possible, else keeps text.
func coerceValue(value string) any {
	var parsed any
	if err := json.Unmarshal([]byte(value), &parsed); err == nil {
		return parsed
	}
	return value
}

// Do executes the invocation against the API.
func (inv *Invocation) Do(cfg Config) ([]byte, int, error) {
	target, err := inv.RequestURL(cfg.Endpoint)
	if err != nil {
		return nil, 0, err
	}
	body, contentType, err := inv.BuildBody()
	if err != nil {
		return nil, 0, err
	}
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	request, err := http.NewRequest(inv.Action.Method, target, reader)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	request.Header.Set("Accept", "application/json")
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	client := &http.Client{Timeout: cfg.Timeout}
	response, err := client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, 20<<20))
	if err != nil {
		return nil, 0, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return payload, response.StatusCode, &httpError{Status: response.StatusCode, Body: payload}
	}
	return payload, response.StatusCode, nil
}

// PrintJSON writes payload pretty (or compact) to stdout.
func PrintJSON(out io.Writer, payload []byte, compact bool) error {
	if compact || len(bytes.TrimSpace(payload)) == 0 {
		_, err := out.Write(append(bytes.TrimSpace(payload), '\n'))
		return err
	}
	var decoded any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		_, werr := out.Write(append(bytes.TrimSpace(payload), '\n'))
		return werr
	}
	pretty, err := json.MarshalIndent(decoded, "", "  ")
	if err != nil {
		return err
	}
	_, err = out.Write(append(pretty, '\n'))
	return err
}
