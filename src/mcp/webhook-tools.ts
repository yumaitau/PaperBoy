import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { protocolTimestamp } from "@/lib/time";
import {
  WebhookError,
  WEBHOOK_URL_MAX_LENGTH,
} from "@/lib/webhook-core";
import type {
  WebhookConfigurationResult,
  WebhookEndpointRecord,
  WebhookEventAttempt,
  WebhookEventRecord,
} from "@/lib/webhooks";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_WEBHOOK_MCP_TOOL_NAMES = [
  "paperboy_get_webhook",
  "paperboy_configure_webhook",
  "paperboy_list_webhooks",
  "paperboy_create_webhook",
  "paperboy_update_webhook",
  "paperboy_delete_webhook",
  "paperboy_list_webhook_events",
  "paperboy_get_webhook_event",
  "paperboy_replay_webhook_event",
  "paperboy_list_webhook_event_attempts",
] as const;

export const PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS = [
  {
    description:
      "Read the authenticated organization's single outbound webhook URL without exposing its signing secret.",
    mutating: false,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Configure the authenticated organization's outbound webhook URL; a newly generated signing secret is returned only on first creation.",
    mutating: true,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List every outbound webhook for the authenticated organization.",
    mutating: false,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Create one outbound webhook. The signing secret is shown only in this response.",
    mutating: true,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Update one outbound webhook URL or enabled flag.",
    mutating: true,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one outbound webhook. Queued deliveries are dropped.",
    mutating: true,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[5],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List recent deliveries for one outbound webhook.",
    mutating: false,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[6],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Read one outbound webhook delivery without exposing secrets.",
    mutating: false,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[7],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Requeue one outbound webhook delivery. Disabled webhooks return an error.",
    mutating: true,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[8],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List the recorded attempts for one outbound webhook delivery.",
    mutating: false,
    name: PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[9],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpWebhookServices = {
  configure: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<WebhookConfigurationResult>;
  create: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<WebhookConfigurationResult>;
  delete: (principal: ApiKeyPrincipal, webhookId: string) => Promise<void>;
  get: (principal: ApiKeyPrincipal) => Promise<WebhookEndpointRecord | null>;
  getEvent: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    eventId: string,
  ) => Promise<WebhookEventRecord>;
  getWebhook: (
    principal: ApiKeyPrincipal,
    webhookId: string,
  ) => Promise<WebhookEndpointRecord>;
  list: (principal: ApiKeyPrincipal) => Promise<WebhookEndpointRecord[]>;
  listEventAttempts: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    eventId: string,
  ) => Promise<WebhookEventAttempt[]>;
  listEvents: (
    principal: ApiKeyPrincipal,
    webhookId: string,
  ) => Promise<WebhookEventRecord[]>;
  replayEvent: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    eventId: string,
  ) => Promise<WebhookEventRecord>;
  update: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    payload: unknown,
  ) => Promise<WebhookConfigurationResult>;
};

const webhookSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  enabled: z.boolean(),
  id: z.string().uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
  url: z.string(),
});

const metadataSchema = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

const getWebhookOutputSchema = z.object({
  ...metadataSchema,
  webhook: webhookSchema.nullable(),
});

const configureWebhookOutputSchema = z.object({
  ...metadataSchema,
  signingSecret: z.string().nullable(),
  webhook: webhookSchema,
});

function serialize(endpoint: WebhookEndpointRecord) {
  return {
    createdAt: protocolTimestamp(endpoint.createdAt),
    enabled: endpoint.enabled,
    id: endpoint.id,
    updatedAt: protocolTimestamp(endpoint.updatedAt),
    url: endpoint.url,
  };
}

const webhookEventSchema = z.object({
  attemptCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
  deliveredAt: z.iso.datetime({ offset: true }).nullable(),
  endpointId: z.string().uuid(),
  eventType: z.string().nullable(),
  failedAt: z.iso.datetime({ offset: true }).nullable(),
  failureReason: z.string().nullable(),
  id: z.string().uuid(),
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  lastErrorCode: z.string().nullable(),
  responseStatus: z.number().int().nullable(),
  status: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
  url: z.string(),
});

const webhookAttemptSchema = z.object({
  attemptCount: z.number().int().nonnegative(),
  attemptedAt: z.iso.datetime({ offset: true }).nullable(),
  failureReason: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  responseStatus: z.number().int().nullable(),
  status: z.string(),
});

function serializeEvent(event: WebhookEventRecord) {
  return {
    attemptCount: event.attemptCount,
    createdAt: protocolTimestamp(event.createdAt),
    deliveredAt: event.deliveredAt ? protocolTimestamp(event.deliveredAt) : null,
    endpointId: event.endpointId,
    eventType: event.eventType,
    failedAt: event.failedAt ? protocolTimestamp(event.failedAt) : null,
    failureReason: event.failureReason,
    id: event.id,
    lastAttemptAt: event.lastAttemptAt
      ? protocolTimestamp(event.lastAttemptAt)
      : null,
    lastErrorCode: event.lastErrorCode,
    responseStatus: event.responseStatus,
    status: event.status,
    updatedAt: protocolTimestamp(event.updatedAt),
    url: event.url,
  };
}

function serializeAttempt(attempt: WebhookEventAttempt) {
  return {
    attemptCount: attempt.attemptCount,
    attemptedAt: attempt.attemptedAt
      ? protocolTimestamp(attempt.attemptedAt)
      : null,
    failureReason: attempt.failureReason,
    lastErrorCode: attempt.lastErrorCode,
    responseStatus: attempt.responseStatus,
    status: attempt.status,
  };
}

function unauthorizedResult() {
  return {
    content: [
      {
        text: "Authorization failed. Reconnect with a valid PaperBoy API key.",
        type: "text" as const,
      },
    ],
    isError: true,
  };
}

function errorResult(error: unknown) {
  let message = "The webhook operation failed.";

  if (error instanceof AuthorizationError) {
    message =
      "The API key creator's current role does not allow webhook configuration.";
  } else if (error instanceof WebhookError) {
    switch (error.code) {
      case "MEMBERSHIP_REQUIRED":
        message = "Create a new API key from a current organization admin.";
        break;
      case "INVALID_INPUT":
      case "INVALID_URL":
        message =
          "Provide one HTTPS webhook URL without embedded credentials or a fragment.";
        break;
      case "WEBHOOK_NOT_FOUND":
      case "EVENT_NOT_FOUND":
        message = "No webhook or event with that ID exists in this organization.";
        break;
      case "ENDPOINT_DISABLED":
        message = "Enable the webhook before replaying its events.";
        break;
      default:
        message =
          "Webhook secret encryption is unavailable. Ask the operator to check PAPERBOY_WEBHOOK_ENCRYPTION_KEY.";
    }
  } else {
    console.error("PaperBoy MCP webhook operation failed.");
  }

  return { content: [{ text: message, type: "text" as const }], isError: true };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
    structuredContent: output,
  };
}

export function registerPaperBoyWebhookTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpWebhookServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: z.object({}).strict(),
      outputSchema: getWebhookOutputSchema,
      title: "Get PaperBoy webhook",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async () => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const endpoint = await input.services.get(principal);
        return successResult({
          ...metadata(),
          webhook: endpoint ? serialize(endpoint) : null,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: z
        .object({ url: z.string().min(1).max(WEBHOOK_URL_MAX_LENGTH) })
        .strict(),
      outputSchema: configureWebhookOutputSchema,
      title: "Configure PaperBoy webhook",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ url }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const configured = await input.services.configure(principal, { url });
        return successResult({
          ...metadata(),
          signingSecret: configured.signingSecret,
          webhook: serialize(configured.endpoint),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  const webhookIdInput = z.object({ webhookId: z.string().uuid() }).strict();
  const webhookEventInput = z
    .object({ eventId: z.string().uuid(), webhookId: z.string().uuid() })
    .strict();
  const webhooksOutput = z.object({
    ...metadataSchema,
    webhooks: z.array(webhookSchema),
  });
  const webhookOutput = z.object({
    ...metadataSchema,
    webhook: webhookSchema,
  });
  const webhookCreateOutput = z.object({
    ...metadataSchema,
    signingSecret: z.string(),
    webhook: webhookSchema,
  });
  const webhookDeleteOutput = z.object({
    ...metadataSchema,
    deleted: z.literal(true),
    webhookId: z.string().uuid(),
  });
  const webhookEventsOutput = z.object({
    ...metadataSchema,
    events: z.array(webhookEventSchema),
  });
  const webhookEventOutput = z.object({
    ...metadataSchema,
    event: webhookEventSchema,
  });
  const webhookAttemptsOutput = z.object({
    ...metadataSchema,
    attempts: z.array(webhookAttemptSchema),
  });

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[2],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[2].description,
      inputSchema: z.object({}).strict(),
      outputSchema: webhooksOutput,
      title: "List PaperBoy webhooks",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async () => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const webhooks = await input.services.list(principal);
        return successResult({
          ...metadata(),
          webhooks: webhooks.map(serialize),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[3],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[3].description,
      inputSchema: z
        .object({
          enabled: z.boolean().optional(),
          url: z.string().min(1).max(WEBHOOK_URL_MAX_LENGTH),
        })
        .strict(),
      outputSchema: webhookCreateOutput,
      title: "Create PaperBoy webhook",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ enabled, url }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const created = await input.services.create(principal, {
          ...(enabled === undefined ? {} : { enabled }),
          url,
        });
        return successResult({
          ...metadata(),
          signingSecret: created.signingSecret,
          webhook: serialize(created.endpoint),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[4],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[4].description,
      inputSchema: z
        .object({
          enabled: z.boolean().optional(),
          url: z.string().min(1).max(WEBHOOK_URL_MAX_LENGTH).optional(),
          webhookId: z.string().uuid(),
        })
        .strict(),
      outputSchema: configureWebhookOutputSchema,
      title: "Update PaperBoy webhook",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ enabled, url, webhookId }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const updated = await input.services.update(principal, webhookId, {
          ...(enabled === undefined ? {} : { enabled }),
          ...(url === undefined ? {} : { url }),
        });
        return successResult({
          ...metadata(),
          signingSecret: updated.signingSecret,
          webhook: serialize(updated.endpoint),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[5],
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[5].description,
      inputSchema: z
        .object({ confirm: z.literal(true), webhookId: z.string().uuid() })
        .strict(),
      outputSchema: webhookDeleteOutput,
      title: "Delete PaperBoy webhook",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ webhookId }: { webhookId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        await input.services.delete(principal, webhookId);
        return successResult({
          ...metadata(),
          deleted: true as const,
          webhookId,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[6],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[6].description,
      inputSchema: webhookIdInput,
      outputSchema: webhookEventsOutput,
      title: "List PaperBoy webhook events",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ webhookId }: { webhookId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const events = await input.services.listEvents(principal, webhookId);
        return successResult({
          ...metadata(),
          events: events.map(serializeEvent),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[7],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[7].description,
      inputSchema: webhookEventInput,
      outputSchema: webhookEventOutput,
      title: "Get PaperBoy webhook event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ eventId, webhookId }: { eventId: string; webhookId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const event = await input.services.getEvent(
          principal,
          webhookId,
          eventId,
        );
        return successResult({ ...metadata(), event: serializeEvent(event) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[8],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[8].description,
      inputSchema: webhookEventInput,
      outputSchema: webhookEventOutput,
      title: "Replay PaperBoy webhook event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ eventId, webhookId }: { eventId: string; webhookId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const event = await input.services.replayEvent(
          principal,
          webhookId,
          eventId,
        );
        return successResult({ ...metadata(), event: serializeEvent(event) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_WEBHOOK_MCP_TOOL_NAMES[9],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_WEBHOOK_MCP_TOOL_DEFINITIONS[9].description,
      inputSchema: webhookEventInput,
      outputSchema: webhookAttemptsOutput,
      title: "List PaperBoy webhook event attempts",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ eventId, webhookId }: { eventId: string; webhookId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const attempts = await input.services.listEventAttempts(
          principal,
          webhookId,
          eventId,
        );
        return successResult({
          ...metadata(),
          attempts: attempts.map(serializeAttempt),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
