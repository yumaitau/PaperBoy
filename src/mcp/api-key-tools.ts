import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { ApiKeyError } from "@/lib/api-keys";
import { protocolTimestamp } from "@/lib/time";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export type McpApiKeyRecord = {
  createdAt: Date | null;
  display: string | null;
  environment: string;
  id: string;
  keyId: string;
  lastUsedAt: Date | null;
  name: string;
  revokedAt: Date | null;
  scopes: string[] | null;
};

export type McpCreatedApiKeyRecord = {
  display: string;
  environment: string;
  id: string;
  name: string;
  rawKey: string;
  scopes: string[] | null;
};

export const PAPERBOY_API_KEY_MCP_TOOL_NAMES = [
  "paperboy_list_api_keys",
  "paperboy_create_api_key",
  "paperboy_get_api_key",
  "paperboy_update_api_key",
  "paperboy_revoke_api_key",
] as const;

export const PAPERBOY_API_KEY_MCP_TOOL_DEFINITIONS = [
  {
    description:
      "List organization API keys. Secrets are never returned; only metadata and scopes.",
    mutating: false,
    name: PAPERBOY_API_KEY_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Create one scoped organization API key. The raw secret is shown only in this response; store it immediately. Omit scopes to grant the creator role's full permissions.",
    mutating: true,
    name: PAPERBOY_API_KEY_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Get one organization API key by ID. Secrets are never returned.",
    mutating: false,
    name: PAPERBOY_API_KEY_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Rename one organization API key or replace its scopes. Scopes must stay within the editor role's permissions; null restores full role access.",
    mutating: true,
    name: PAPERBOY_API_KEY_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Revoke one organization API key. Revoked keys stop working immediately.",
    mutating: true,
    name: PAPERBOY_API_KEY_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpApiKeyServices = {
  create: (
    principal: ApiKeyPrincipal,
    input: { environment?: unknown; name: unknown; scopes?: unknown },
  ) => Promise<McpCreatedApiKeyRecord>;
  get: (
    principal: ApiKeyPrincipal,
    apiKeyId: string,
  ) => Promise<McpApiKeyRecord>;
  list: (principal: ApiKeyPrincipal) => Promise<McpApiKeyRecord[]>;
  revoke: (
    principal: ApiKeyPrincipal,
    apiKeyId: string,
  ) => Promise<void>;
  update: (
    principal: ApiKeyPrincipal,
    apiKeyId: string,
    input: { name?: unknown; scopes?: unknown },
  ) => Promise<McpApiKeyRecord>;
};

const apiKeySchema = z.object({
  createdAt: z.iso.datetime({ offset: true }).nullable(),
  display: z.string().nullable(),
  environment: z.string(),
  id: z.string().uuid(),
  keyId: z.string(),
  lastUsedAt: z.iso.datetime({ offset: true }).nullable(),
  name: z.string(),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  scopes: z.array(z.string()).nullable(),
});

const createdApiKeySchema = z.object({
  display: z.string(),
  environment: z.string(),
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  scopes: z.array(z.string()).nullable(),
});

const metadataSchema = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

const listOutputSchema = z.object({
  apiKeys: z.array(apiKeySchema),
  observedAt: metadataSchema.observedAt,
  protocolTimeZone: metadataSchema.protocolTimeZone,
  schemaVersion: metadataSchema.schemaVersion,
});

const apiKeyResponseOutputSchema = z.object({
  apiKey: apiKeySchema,
  observedAt: metadataSchema.observedAt,
  protocolTimeZone: metadataSchema.protocolTimeZone,
  schemaVersion: metadataSchema.schemaVersion,
});

const createdApiKeyOutputSchema = z.object({
  apiKey: createdApiKeySchema,
  observedAt: metadataSchema.observedAt,
  protocolTimeZone: metadataSchema.protocolTimeZone,
  schemaVersion: metadataSchema.schemaVersion,
});

const revokeOutputSchema = z.object({
  apiKeyId: z.string().uuid(),
  deleted: z.literal(true),
  observedAt: metadataSchema.observedAt,
  protocolTimeZone: metadataSchema.protocolTimeZone,
  schemaVersion: metadataSchema.schemaVersion,
});

const apiKeyIdInputSchema = z.object({ apiKeyId: z.string().uuid() }).strict();

const createApiKeyInputSchema = z
  .object({
    environment: z.enum(["live", "test"]).default("live"),
    name: z.string().min(1).max(80),
    scopes: z.array(z.string().min(1)).max(100).nullable().optional(),
  })
  .strict();

const updateApiKeyInputSchema = z
  .object({
    apiKeyId: z.string().uuid(),
    name: z.string().min(1).max(80).optional(),
    scopes: z.array(z.string().min(1)).max(100).nullable().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.scopes !== undefined, {
    message: "Provide a name or scopes to update.",
    path: ["body"],
  });

const revokeApiKeyInputSchema = z
  .object({ apiKeyId: z.string().uuid(), confirm: z.literal(true) })
  .strict();

function timestamp(value: Date | null): string | null {
  return value ? protocolTimestamp(value) : null;
}

function serialize(record: McpApiKeyRecord) {
  return {
    createdAt: timestamp(record.createdAt),
    display: record.display,
    environment: record.environment,
    id: record.id,
    keyId: record.keyId,
    lastUsedAt: timestamp(record.lastUsedAt),
    name: record.name,
    revokedAt: timestamp(record.revokedAt),
    scopes: record.scopes,
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
  let message = "The API key operation failed.";

  if (error instanceof AuthorizationError) {
    message =
      "The API key creator's current role does not allow this API key operation.";
  } else if (error instanceof ApiKeyError) {
    switch (error.code) {
      case "MEMBERSHIP_REQUIRED":
        message =
          "Create a new API key from a current organization owner or admin.";
        break;
      case "KEY_NOT_FOUND":
        message = "No API key with that ID exists in this organization.";
        break;
      default:
        message =
          "Provide a key name of 1-80 characters, a live or test environment, and scopes within your role.";
    }
  } else {
    console.error("PaperBoy MCP API key operation failed.");
  }

  return { content: [{ text: message, type: "text" as const }], isError: true };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
    structuredContent: output,
  };
}

export function registerPaperBoyApiKeyTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpApiKeyServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  input.server.registerTool(
    PAPERBOY_API_KEY_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_API_KEY_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: z.object({}).strict(),
      outputSchema: listOutputSchema,
      title: "List PaperBoy API keys",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async () => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const keys = await input.services.list(principal);
        return successResult({
          ...metadata(),
          apiKeys: keys.map(serialize),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_API_KEY_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_API_KEY_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: createApiKeyInputSchema,
      outputSchema: createdApiKeyOutputSchema,
      title: "Create a PaperBoy API key",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ environment, name, scopes }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const created = await input.services.create(principal, {
          environment,
          name,
          scopes,
        });
        return successResult({
          ...metadata(),
          apiKey: {
            display: created.display,
            environment: created.environment,
            id: created.id,
            key: created.rawKey,
            name: created.name,
            scopes: created.scopes,
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_API_KEY_MCP_TOOL_NAMES[2],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_API_KEY_MCP_TOOL_DEFINITIONS[2].description,
      inputSchema: apiKeyIdInputSchema,
      outputSchema: apiKeyResponseOutputSchema,
      title: "Get a PaperBoy API key",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ apiKeyId }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const key = await input.services.get(principal, apiKeyId);
        return successResult({ ...metadata(), apiKey: serialize(key) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_API_KEY_MCP_TOOL_NAMES[3],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_API_KEY_MCP_TOOL_DEFINITIONS[3].description,
      inputSchema: updateApiKeyInputSchema,
      outputSchema: apiKeyResponseOutputSchema,
      title: "Update a PaperBoy API key",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ apiKeyId, name, scopes }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const key = await input.services.update(principal, apiKeyId, {
          name,
          scopes,
        });
        return successResult({ ...metadata(), apiKey: serialize(key) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_API_KEY_MCP_TOOL_NAMES[4],
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_API_KEY_MCP_TOOL_DEFINITIONS[4].description,
      inputSchema: revokeApiKeyInputSchema,
      outputSchema: revokeOutputSchema,
      title: "Revoke a PaperBoy API key",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ apiKeyId }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        await input.services.revoke(principal, apiKeyId);
        return successResult({
          ...metadata(),
          apiKeyId,
          deleted: true as const,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
