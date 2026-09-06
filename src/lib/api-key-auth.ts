import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import {
  isApiKeyEnvironment,
  parseApiKey,
  verifyApiKeyHash,
  type ApiKeyEnvironment,
} from "@/lib/api-key-crypto";
import {
  ORG_PERMISSIONS,
  type OrgPermission,
} from "@/lib/authorization";

export type ApiKeyPrincipal = {
  actorUserId: string | null;
  apiKeyId: string;
  environment: ApiKeyEnvironment;
  orgId: string;
  scopes: OrgPermission[] | null;
};

export async function authenticateApiKey(
  rawKey: unknown,
): Promise<ApiKeyPrincipal | null> {
  const parsed = parseApiKey(rawKey);

  if (!parsed || typeof rawKey !== "string") {
    return null;
  }

  const [candidate] = await db
    .select({
      actorUserId: apiKeys.createdByUserId,
      environment: apiKeys.environment,
      id: apiKeys.id,
      keyHash: apiKeys.keyHash,
      orgId: apiKeys.orgId,
      revokedAt: apiKeys.revokedAt,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyId, parsed.keyId))
    .limit(1);

  if (
    !candidate ||
    candidate.revokedAt ||
    candidate.environment !== parsed.environment ||
    !isApiKeyEnvironment(candidate.environment) ||
    !verifyApiKeyHash(rawKey, candidate.keyHash)
  ) {
    return null;
  }

  const [authenticated] = await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, candidate.id),
        eq(apiKeys.keyHash, candidate.keyHash),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });

  if (!authenticated) {
    return null;
  }

  return {
    actorUserId: candidate.actorUserId,
    apiKeyId: candidate.id,
    environment: candidate.environment,
    orgId: candidate.orgId,
    scopes: normalizeScopes(candidate.scopes),
  };
}

const KNOWN_PERMISSIONS = new Set<string>(ORG_PERMISSIONS);

function normalizeScopes(value: unknown): OrgPermission[] | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const scopes: OrgPermission[] = [];

  for (const entry of value) {
    if (typeof entry !== "string" || !KNOWN_PERMISSIONS.has(entry)) {
      return null;
    }

    scopes.push(entry as OrgPermission);
  }

  return scopes;
}
