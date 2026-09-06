import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { RequestLogError } from "@/lib/request-logs";
import type { RequestLogRecord } from "@/lib/request-logs";
import { protocolTimestamp } from "@/lib/time";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_LOG_MCP_TOOL_NAMES = [
  "paperboy_list_logs",
  "paperboy_get_log",
] as const;

export const PAPERBOY_LOG_MCP_TOOL_DEFINITIONS = [
  {
    description: "List organization API request logs newest first.",
    mutating: false,
    name: PAPERBOY_LOG_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one organization API request log by ID.",
    mutating: false,
    name: PAPERBOY_LOG_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpLogServices = {
  get: (principal: ApiKeyPrincipal, logId: string) => Promise<RequestLogRecord>;
  list: (
    principal: ApiKeyPrincipal,
    filter: { after?: string; before?: string; limit?: number },
  ) => Promise<RequestLogRecord[]>;
};

const logSchema = z.object({
  apiKeyId: z.string().uuid().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  durationMs: z.number().int().nonnegative(),
  environment: z.string().nullable(),
  id: z.string().uuid(),
  method: z.string(),
  object: z.literal("log"),
  path: z.string(),
  responseStatus: z.number().int(),
  userAgent: z.string().nullable(),
});

const metadataSchema = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

const listOutput = z.object({ ...metadataSchema, logs: z.array(logSchema) });
const logOutput = z.object({ ...metadataSchema, log: logSchema });

function serialize(record: RequestLogRecord) {
  return {
    apiKeyId: record.apiKeyId,
    createdAt: protocolTimestamp(record.createdAt),
    durationMs: record.durationMs,
    environment: record.environment,
    id: record.id,
    method: record.method,
    object: "log" as const,
    path: record.path,
    responseStatus: record.status,
    userAgent: record.userAgent,
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
  let message = "The log operation failed.";

  if (error instanceof AuthorizationError) {
    message = "The API key creator's current role does not allow reading logs.";
  } else if (error instanceof RequestLogError) {
    switch (error.code) {
      case "MEMBERSHIP_REQUIRED":
        message = "Create a new API key from a current organization owner or admin.";
        break;
      case "LOG_NOT_FOUND":
        message = "No log with that ID exists in this organization.";
        break;
      default:
        message = error.issues[0]?.message ?? "Check the log fields.";
    }
  } else {
    console.error("PaperBoy MCP log operation failed.");
  }

  return { content: [{ text: message, type: "text" as const }], isError: true };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
    structuredContent: output,
  };
}

export function registerPaperBoyLogTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpLogServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  input.server.registerTool(
    PAPERBOY_LOG_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_LOG_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: z
        .object({
          after: z.string().uuid().optional(),
          before: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .strict(),
      outputSchema: listOutput,
      title: "List PaperBoy logs",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async (filter: { after?: string; before?: string; limit?: number }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const logs = await input.services.list(principal, filter);
        return successResult({
          ...metadata(),
          logs: logs.map(serialize),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_LOG_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_LOG_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: z.object({ logId: z.string().uuid() }).strict(),
      outputSchema: logOutput,
      title: "Get PaperBoy log",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ logId }: { logId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const log = await input.services.get(principal, logId);
        return successResult({ ...metadata(), log: serialize(log) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
