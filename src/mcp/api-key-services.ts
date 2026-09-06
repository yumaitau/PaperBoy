import { apiKeyApiServices } from "@/lib/api-key-http";
import type {
  McpApiKeyRecord,
  McpCreatedApiKeyRecord,
  PaperBoyMcpApiKeyServices,
} from "@/mcp/api-key-tools";

function toRecord(value: Record<string, unknown>): McpApiKeyRecord {
  const dateOrNull = (entry: unknown): Date | null =>
    entry instanceof Date ? entry : null;
  const stringOrNull = (entry: unknown): string | null =>
    typeof entry === "string" ? entry : null;
  const scopes =
    value["scopes"] === null || value["scopes"] === undefined
      ? null
      : (value["scopes"] as string[]);

  return {
    createdAt: dateOrNull(value["createdAt"]),
    display: stringOrNull(value["display"]),
    environment: String(value["environment"] ?? "live"),
    id: String(value["id"] ?? ""),
    keyId: String(value["keyId"] ?? ""),
    lastUsedAt: dateOrNull(value["lastUsedAt"]),
    name: String(value["name"] ?? ""),
    revokedAt: dateOrNull(value["revokedAt"]),
    scopes,
  };
}

export const paperBoyMcpApiKeyServices: PaperBoyMcpApiKeyServices = {
  create: async (principal, input): Promise<McpCreatedApiKeyRecord> => {
    const created = await apiKeyApiServices.create(principal, {
      environment: input.environment ?? "live",
      name: input.name,
      scopes: input.scopes,
    });

    return {
      display: created.display,
      environment: created.environment,
      id: created.id,
      name: created.name,
      rawKey: created.rawKey,
      scopes: created.scopes,
    };
  },
  get: async (principal, apiKeyId) =>
    toRecord(await apiKeyApiServices.get(principal, apiKeyId)),
  list: async (principal) =>
    (await apiKeyApiServices.list(principal)).map(toRecord),
  revoke: (principal, apiKeyId) =>
    apiKeyApiServices.revoke(principal, apiKeyId),
  update: async (principal, apiKeyId, input) =>
    toRecord(
      await apiKeyApiServices.update(principal, apiKeyId, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.scopes === undefined ? {} : { scopes: input.scopes }),
      }),
    ),
};
