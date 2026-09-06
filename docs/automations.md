# Custom events, automations, and logs

## Custom events

- `POST /api/v1/events` defines a named event with an optional flat
  payload schema (`string`, `number`, `boolean`, `date`). Names cannot
  start with `resend:`. `GET /api/v1/events`, `GET`/`PATCH`/`DELETE
  /api/v1/events/{identifier}` accept an ID or a name.
- `POST /api/v1/events/send` records an occurrence for exactly one of
  `contact_id` or `email`, validates the payload against the definition
  when one exists, and answers `202`. Every enabled automation whose
  trigger matches the event name records a run.
- MCP: `paperboy_list/create/get/update/delete_event`, `paperboy_send_event`.

## Automations

Automations store a workflow definition: `name`, `status` (`enabled` or
`disabled`, default `disabled`), `steps` (1–150 entries including at
least one `{type: "trigger", event}` step), and `connections`. Steps
after the trigger are stored verbatim so editors round-trip; PaperBoy
does not execute step actions. Each matching `events/send` call records
one `completed` run per enabled automation.

- `GET`/`POST /api/v1/automations` with an optional `?status=` filter,
  `GET`/`PATCH`/`DELETE /api/v1/automations/{automationId}`,
  `POST .../duplicate` (always disabled), `POST .../stop`,
  `GET .../runs` and `GET .../runs/{runId}`.
- MCP: `paperboy_list/create/get/update/delete/duplicate/stop_automation`,
  `paperboy_list/get_automation_run`.

## Logs

Every `/api/v1` bearer-key route records method, path, status,
organization, key, environment, duration, and user agent into
`request_logs` through a shared wrapper. Logging is best-effort and never
fails the request; rows appear once migrations have run.

- `GET /api/v1/logs` with `limit`, `after`, and `before` cursors,
  `GET /api/v1/logs/{logId}`. Needs the `logs.read` scope.
- MCP: `paperboy_list_logs`, `paperboy_get_log`.
- There is no console page yet; the `/app/logs` section still shows
  message delivery logs.
