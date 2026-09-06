export type ApiGuideExample = {
  body?: string;
  method: string;
  operationId: string;
  path: string;
  response?: string;
  title: string;
};

export type ApiGuide = {
  body: string;
  examples: ApiGuideExample[];
  slug: string;
  tags: string[];
  title: string;
};

const BASE = "https://paperboy.example.com";

function curl(
  method: string,
  path: string,
  body?: string,
): string {
  const lines = [
    `curl -X ${method} '${BASE}${path}' \\`,
    `  -H 'Authorization: Bearer pb_live_...' \\`,
    `  -H 'Content-Type: application/json'`,
  ];
  if (body !== undefined) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -d '${body}'`);
  }
  return lines.join("\n");
}

export const API_GUIDES: ApiGuide[] = [
  {
    body: "Every request carries a bearer key that selects one organization and one live or test environment. Test keys queue into an isolated sink and never deliver. All timestamps are RFC 3339 UTC, ids are UUIDs, and error bodies look like {error: {code, message}} with field details on 422 responses. Sends accept an Idempotency-Key header or idempotency_key field (they must match when both are present); keys last 24 hours per API key.",
    examples: [
      {
        body: JSON.stringify({
          from: "Acme <news@example.com>",
          subject: "Hello",
          text: "Hi there",
          to: ["reader@example.net"],
        }),
        method: "POST",
        operationId: "sendEmail",
        path: "/api/v1/emails",
        response: JSON.stringify({ id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" }),
        title: "Queue one email",
      },
    ],
    slug: "getting-started",
    tags: ["Emails"],
    title: "Getting started",
  },
  {
    body: "Templates hold subject, HTML, and text with {{dotted.variables}}. Publishing gates sending: only published templates can be used by sends and broadcasts. Duplicate copies any template into a fresh draft. Preview renders without sending and reports missing required variables.",
    examples: [
      {
        body: JSON.stringify({
          name: "Welcome",
          subject: "Welcome, {{reader.name}}",
          text: "Hello {{reader.name}}",
        }),
        method: "POST",
        operationId: "createTemplate",
        path: "/api/v1/templates",
        title: "Create a draft template",
      },
      {
        method: "POST",
        operationId: "publishTemplate",
        path: "/api/v1/templates/{templateId}/publish",
        title: "Publish a template",
      },
      {
        body: JSON.stringify({ data: { reader: { name: "Ada" } } }),
        method: "POST",
        operationId: "previewTemplate",
        path: "/api/v1/templates/{templateId}/preview",
        title: "Preview with data",
      },
    ],
    slug: "templates",
    tags: ["Templates"],
    title: "Templates",
  },
  {
    body: "Audiences are the legacy list model and keep working. Segments are the current grouping model, topics carry opt_in or opt_out subscriptions with public or private visibility, and contact properties define typed custom keys. Top-level contacts are org-scoped and addressable by UUID or email; lookups prefer the org-level row. Imports accept JSON CSV text or multipart file uploads with a column map and skip or upsert conflict handling.",
    examples: [
      {
        body: JSON.stringify({ name: "Weekly" }),
        method: "POST",
        operationId: "createSegment",
        path: "/api/v1/segments",
        title: "Create a segment",
      },
      {
        body: JSON.stringify({
          default_subscription: "opt_in",
          name: "News",
          visibility: "public",
        }),
        method: "POST",
        operationId: "createTopic",
        path: "/api/v1/topics",
        title: "Create a topic",
      },
      {
        body: JSON.stringify({
          email: "reader@example.net",
          first_name: "Ada",
          topics: [{ id: "b6d24b8e-af0b-4c3c-be0c-359bbd97381e", subscription: "opt_in" }],
        }),
        method: "POST",
        operationId: "createOrgContact",
        path: "/api/v1/contacts",
        title: "Create a contact with a topic subscription",
      },
      {
        body: JSON.stringify({
          column_map: { email: "Email" },
          csv: "Email\nreader@example.net\n",
          on_conflict: "skip",
        }),
        method: "POST",
        operationId: "createContactImport",
        path: "/api/v1/contacts/imports",
        title: "Import contacts from CSV",
      },
    ],
    slug: "audiences-contacts",
    tags: ["Audiences", "Segments", "Topics", "Contacts", "Contact properties"],
    title: "Audiences, segments, topics, and contacts",
  },
  {
    body: "A broadcast snapshots one audience and one published template, then queues a recipient row per active contact. Only scheduled broadcasts can be updated, deleted, or sent on demand; running broadcasts pause, resume, or cancel. Recipients filter by event type, email, and bounce type. Clicked links come from the stored template with click counts.",
    examples: [
      {
        body: JSON.stringify({
          audience_id: "78261eea-8f8b-4381-83c6-79fa7120f1cf",
          from: "Acme <news@example.com>",
          name: "Morning edition",
          subject: "Good morning",
          template_id: "88888888-8888-4888-8888-888888888888",
        }),
        method: "POST",
        operationId: "createBroadcast",
        path: "/api/v1/broadcasts",
        title: "Create a broadcast",
      },
      {
        body: JSON.stringify({ scheduled_at: "2026-09-06T01:30:00Z" }),
        method: "POST",
        operationId: "sendBroadcast",
        path: "/api/v1/broadcasts/{broadcastId}/send",
        title: "Schedule a broadcast send",
      },
    ],
    slug: "broadcasts",
    tags: ["Broadcasts"],
    title: "Broadcasts",
  },
  {
    body: "Emails send through POST /api/v1/emails with inline content or a published template_id plus data. Batch posts an array of up to 100 messages. Scheduled messages reschedule with PATCH and cancel with POST .../cancel. Share links expire after at most 48 hours. Attachments return metadata with signed download URLs. Metrics aggregate sent, delivered, bounced, complained, opened, clicked, and failed totals with optional period, domain, email, and broadcast breakdowns.",
    examples: [
      {
        body: JSON.stringify({
          data: { reader: { name: "Ada" } },
          from: "Acme <news@example.com>",
          template_id: "88888888-8888-4888-8888-888888888888",
          to: ["reader@example.net"],
        }),
        method: "POST",
        operationId: "sendEmail",
        path: "/api/v1/emails",
        title: "Send with a template",
      },
      {
        body: JSON.stringify({ expires_in: "2 hours" }),
        method: "POST",
        operationId: "shareEmail",
        path: "/api/v1/emails/{emailId}/share",
        title: "Share an email",
      },
    ],
    slug: "emails",
    tags: ["Emails", "Events"],
    title: "Sending, sharing, and metrics",
  },
  {
    body: "Suppressions block sends by address with manual, unsubscribed, bounced, or complained reasons, and support CSV import. Inbound mail arrives through receiving endpoints and keeps attachments. Open tracking and click tracking are per-domain opt-in features with signed pixels and links.",
    examples: [
      {
        body: JSON.stringify({ email: "gone@example.net", reason: "manual" }),
        method: "POST",
        operationId: "createSuppression",
        path: "/api/v1/suppressions",
        title: "Suppress an address",
      },
    ],
    slug: "suppressions-receiving",
    tags: ["Suppressions", "Open tracking"],
    title: "Suppressions and receiving",
  },
  {
    body: "Webhooks sign every delivery with HMAC headers; verify before acting. Multiple endpoints can exist per organization, each with an enabled flag. Deliveries expose attempt counts and error codes, and replay requeues one delivery unless its endpoint is disabled.",
    examples: [
      {
        body: JSON.stringify({ url: "https://example.com/hooks/paperboy" }),
        method: "POST",
        operationId: "createWebhook",
        path: "/api/v1/webhooks",
        title: "Create a webhook",
      },
    ],
    slug: "webhooks",
    tags: ["Webhooks"],
    title: "Webhooks",
  },
  {
    body: "API keys carry an environment and an optional scope list. Omit scopes to grant the creator role's full permissions; otherwise provide a subset, which is enforced as the minimum of role and key on every route, MCP tool, and CLI call. The secret is shown only at creation. Rotate by creating a replacement and revoking the original.",
    examples: [
      {
        body: JSON.stringify({
          environment: "live",
          name: "Warehouse",
          scopes: ["messages.send", "messages.read"],
        }),
        method: "POST",
        operationId: "createApiKey",
        path: "/api/v1/api-keys",
        title: "Create a scoped key",
      },
    ],
    slug: "api-keys",
    tags: ["API keys"],
    title: "API keys and scopes",
  },
  {
    body: "Custom events define a name with an optional flat payload schema; names cannot start with resend:. Sending an event records an occurrence, validates the payload when a definition exists, and answers 202. Enabled automations whose trigger matches record a run. Automations store steps (1-150 with a trigger step) and connections; duplicate always creates a disabled copy and stop disables.",
    examples: [
      {
        body: JSON.stringify({ name: "signup", schema: { plan: "string" } }),
        method: "POST",
        operationId: "createEvent",
        path: "/api/v1/events",
        title: "Define an event",
      },
      {
        body: JSON.stringify({
          email: "reader@example.net",
          event: "signup",
          payload: { plan: "pro" },
        }),
        method: "POST",
        operationId: "sendEvent",
        path: "/api/v1/events/send",
        title: "Send an event",
      },
      {
        body: JSON.stringify({
          name: "Welcome series",
          steps: [{ event: "signup", type: "trigger" }],
        }),
        method: "POST",
        operationId: "createAutomation",
        path: "/api/v1/automations",
        title: "Create an automation",
      },
    ],
    slug: "events-automations",
    tags: ["Events", "Automations"],
    title: "Events and automations",
  },
  {
    body: "Every bearer-key route records method, path, status, organization, key, duration, and user agent. Listing supports limit with after and before cursors. Reading logs needs the logs.read scope. Outbound providers, rate limits, and open tracking are organization settings with read and manage splits.",
    examples: [
      {
        method: "GET",
        operationId: "listLogs",
        path: "/api/v1/logs?limit=25",
        title: "List recent requests",
      },
    ],
    slug: "logs-settings",
    tags: ["Logs", "Outbound providers", "Rate limits"],
    title: "Logs and settings",
  },
];

export function guideCurl(example: ApiGuideExample): string {
  return curl(example.method, example.path, example.body);
}

export function allGuideTags(): string[] {
  return [...new Set(API_GUIDES.flatMap((guide) => guide.tags))];
}
