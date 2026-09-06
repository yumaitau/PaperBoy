import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { CustomEventError } from "@/lib/custom-event-core";
import type {
  EventDefinitionRecord,
  EventOccurrenceRecord,
} from "@/lib/custom-events";
import { protocolTimestamp } from "@/lib/time";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_EVENT_MCP_TOOL_NAMES = [
  "paperboy_list_events",
  "paperboy_create_event",
  "paperboy_get_event",
  "paperboy_update_event",
  "paperboy_delete_event",
  "paperboy_send_event",
] as const;

export const PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS = [
  {
    description: "List organization custom event definitions.",
    mutating: false,
    name: PAPERBOY_EVENT_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Define one custom event with an optional flat payload schema. Names cannot start with resend:.",
    mutating: true,
    name: PAPERBOY_EVENT_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one custom event definition by ID or name.",
    mutating: false,
    name: PAPERBOY_EVENT_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Update one custom event definition by ID or name.",
    mutating: true,
    name: PAPERBOY_EVENT_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one custom event definition. Past occurrences are kept.",
    mutating: true,
    name: PAPERBOY_EVENT_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Send one custom event for a contact, validating the payload against the definition when one exists. Matching enabled automations record a run.",
    mutating: true,
    name: PAPERBOY_EVENT_MCP_TOOL_NAMES[5],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpEventServices = {
  create: (
    principal: ApiKeyPrincipal,
    input: Record<string, unknown>,
  ) => Promise<EventDefinitionRecord>;
  delete: (principal: ApiKeyPrincipal, identifier: string) => Promise<void>;
  get: (
    principal: ApiKeyPrincipal,
    identifier: string,
  ) => Promise<EventDefinitionRecord>;
  list: (principal: ApiKeyPrincipal) => Promise<EventDefinitionRecord[]>;
  send: (
    principal: ApiKeyPrincipal,
    input: Record<string, unknown>,
  ) => Promise<EventOccurrenceRecord>;
  update: (
    principal: ApiKeyPrincipal,
    identifier: string,
    input: Record<string, unknown>,
  ) => Promise<EventDefinitionRecord>;
};

const definitionSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().uuid(),
  name: z.string(),
  schema: z.record(z.string(), z.enum(["string", "number", "boolean", "date"])).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});

const occurrenceSchema = z.object({
  contactEmail: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  eventId: z.string().uuid().nullable(),
  id: z.string().uuid(),
  name: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const metadataSchema = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

const listOutput = z.object({ ...metadataSchema, events: z.array(definitionSchema) });
const definitionOutput = z.object({ ...metadataSchema, event: definitionSchema });
const deleteOutput = z.object({
  ...metadataSchema,
  deleted: z.literal(true),
  identifier: z.string(),
});
const sendOutput = z.object({ ...metadataSchema, occurrence: occurrenceSchema });

const identifierInput = z.object({ identifier: z.string().min(1).max(254) }).strict();
const schemaInput = z
  .record(z.string(), z.enum(["string", "number", "boolean", "date"]))
  .nullable()
  .optional();

function serializeDefinition(record: EventDefinitionRecord) {
  return {
    createdAt: protocolTimestamp(record.createdAt),
    id: record.id,
    name: record.name,
    schema: record.schema,
    updatedAt: protocolTimestamp(record.updatedAt),
  };
}

function serializeOccurrence(record: EventOccurrenceRecord) {
  return {
    contactEmail: record.contactEmail,
    createdAt: protocolTimestamp(record.createdAt),
    eventId: record.eventId,
    id: record.id,
    name: record.name,
    payload: record.payload,
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
  let message = "The event operation failed.";

  if (error instanceof AuthorizationError) {
    message = "The API key creator's current role does not allow this event operation.";
  } else if (error instanceof CustomEventError) {
    switch (error.code) {
      case "MEMBERSHIP_REQUIRED":
        message = "Create a new API key from a current organization owner or admin.";
        break;
      case "EVENT_NOT_FOUND":
        message = "No event with that ID or name exists in this organization.";
        break;
      case "EVENT_EXISTS":
        message = "An event with that name already exists in this organization.";
        break;
      default:
        message = error.issues[0]?.message ?? "Check the event fields.";
    }
  } else {
    console.error("PaperBoy MCP event operation failed.");
  }

  return { content: [{ text: message, type: "text" as const }], isError: true };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
    structuredContent: output,
  };
}

export function registerPaperBoyEventTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpEventServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  input.server.registerTool(
    PAPERBOY_EVENT_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: z.object({}).strict(),
      outputSchema: listOutput,
      title: "List PaperBoy events",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async () => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const events = await input.services.list(principal);
        return successResult({
          ...metadata(),
          events: events.map(serializeDefinition),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EVENT_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: z
        .object({ name: z.string().min(1).max(120), schema: schemaInput })
        .strict(),
      outputSchema: definitionOutput,
      title: "Create PaperBoy event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async (args: { name: string; schema?: unknown }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const event = await input.services.create(principal, args);
        return successResult({ ...metadata(), event: serializeDefinition(event) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EVENT_MCP_TOOL_NAMES[2],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS[2].description,
      inputSchema: identifierInput,
      outputSchema: definitionOutput,
      title: "Get PaperBoy event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ identifier }: { identifier: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const event = await input.services.get(principal, identifier);
        return successResult({ ...metadata(), event: serializeDefinition(event) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EVENT_MCP_TOOL_NAMES[3],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS[3].description,
      inputSchema: z
        .object({
          identifier: z.string().min(1).max(254),
          name: z.string().min(1).max(120).optional(),
          schema: schemaInput,
        })
        .strict(),
      outputSchema: definitionOutput,
      title: "Update PaperBoy event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({
      identifier,
      ...payload
    }: {
      identifier: string;
      name?: string;
      schema?: unknown;
    }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const event = await input.services.update(principal, identifier, payload);
        return successResult({ ...metadata(), event: serializeDefinition(event) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EVENT_MCP_TOOL_NAMES[4],
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS[4].description,
      inputSchema: identifierInput,
      outputSchema: deleteOutput,
      title: "Delete PaperBoy event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ identifier }: { identifier: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        await input.services.delete(principal, identifier);
        return successResult({
          ...metadata(),
          deleted: true as const,
          identifier,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EVENT_MCP_TOOL_NAMES[5],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: PAPERBOY_EVENT_MCP_TOOL_DEFINITIONS[5].description,
      inputSchema: z
        .object({
          contactId: z.string().uuid().optional(),
          email: z.string().min(3).max(254).optional(),
          event: z.string().min(1).max(120),
          payload: z.record(z.string(), z.unknown()).optional(),
        })
        .strict(),
      outputSchema: sendOutput,
      title: "Send PaperBoy event",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
     
    async (args: any) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const occurrence = await input.services.send(principal, {
          contact_id: args.contactId,
          email: args.email,
          event: args.event,
          payload: args.payload,
        });
        return successResult({
          ...metadata(),
          occurrence: serializeOccurrence(occurrence),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
