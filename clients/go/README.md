# PaperBoy Go CLI

A self-contained `paperboy` binary that calls the PaperBoy HTTP API with a
bearer key. No third-party dependencies: `go build` produces a static
binary from the standard library alone.

## Build

```bash
cd clients/go
go build -o paperboy .
```

Embed a version string:

```bash
go build -ldflags "-X main.Version=1.2.3" -o paperboy .
```

## Configure

```bash
export PAPERBOY_URL="https://paperboy.example.com"  # default http://localhost:3000
export PAPERBOY_API_KEY="pb_live_..."                # or pass --api-key
```

Tenant and environment always come from the key. Protocol timestamps stay
UTC.

## Use

```bash
paperboy help
paperboy <resource> help

paperboy templates list
paperboy templates create --set name=Welcome --set subject="Hi {{reader.name}}" --set text="Hello"
paperboy templates get 33333333-3333-4333-8333-333333333333
paperboy templates publish 33333333-3333-4333-8333-333333333333

paperboy emails send --set from="News <news@example.com>" --set to='["reader@example.net"]' \
  --set subject="Hello" --set text="Hi"
paperboy emails send-batch --body-file batch.json
paperboy emails metrics --query dimensions=period,domain --query granularity=daily

paperboy contacts get reader@example.net
paperboy contacts import --file ./contacts.csv --set on_conflict=upsert
paperboy broadcasts recipients <id> --query type=opened --query limit=10
paperboy webhooks replay <webhook-id> <event-id>
paperboy events send --set event=signup --set email=reader@example.net
paperboy logs list --query limit=25
```

Input flags:

- `--set key=value` merges into the JSON body. Values that parse as JSON
  stay typed (`--set tags='[{"name":"a","value":"b"}]'`); anything else is
  sent as a string.
- `--json '{"raw": 1}'` merges a raw JSON object underneath `--set`.
- `--body-file data.json` sends a file as the JSON body (objects merge
  with `--set`; top-level arrays are sent as-is for batch send).
- `--query key=value` appends URL query parameters (repeatable).
- `--file data.csv` uploads a file. CSV import actions post raw bytes as
  `text/csv`; the contact import posts multipart with `--set` entries as
  form fields.
- `--compact` prints compact JSON; `--timeout SECONDS` sets the request
  timeout (default 30).

Responses print as indented JSON. HTTP errors print the error envelope and
exit 1; usage errors exit 2.

Every command maps to an operation in the repository `openapi.yaml`; the
`TestTableMatchesOpenAPI` test fails the build if the table drifts from
the spec.

## Test

```bash
go vet ./...
go test ./...
```
