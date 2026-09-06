import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, orgMembers } from "@/db/schema";
import {
  generateApiKey,
  isApiKeyEnvironment,
} from "@/lib/api-key-crypto";
import { can, isOrgRole, requirePermission } from "@/lib/authorization";
import type { OrgPermission, OrgRole } from "@/lib/authorization";

export { authenticateApiKey } from "@/lib/api-key-auth";
export type { ApiKeyPrincipal } from "@/lib/api-key-auth";

export type ApiKeyErrorCode =
  | "INVALID_ENVIRONMENT"
  | "INVALID_NAME"
  | "INVALID_SCOPES"
  | "KEY_NOT_FOUND"
  | "MEMBERSHIP_REQUIRED";

export class ApiKeyError extends Error {
  constructor(readonly code: ApiKeyErrorCode) {
    super(code);
    this.name = "ApiKeyError";
  }
}

function normalizeKeyName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length > 0 && name.length <= 80 ? name : null;
}

function normalizeScopes(
  value: unknown,
  role: OrgRole,
): OrgPermission[] | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new ApiKeyError("INVALID_SCOPES");
  }

  const scopes: OrgPermission[] = [];

  for (const entry of value) {
    if (typeof entry !== "string" || !can(role, entry as OrgPermission)) {
      throw new ApiKeyError("INVALID_SCOPES");
    }

    if (!scopes.includes(entry as OrgPermission)) {
      scopes.push(entry as OrgPermission);
    }
  }

  return scopes;
}

export async function createApiKey(input: {
  actorUserId: string;
  environment: unknown;
  name: unknown;
  orgId: string;
  scopes?: unknown;
}) {
  const name = normalizeKeyName(input.name);
  const environment = input.environment;

  if (!name) {
    throw new ApiKeyError("INVALID_NAME");
  }

  if (!isApiKeyEnvironment(environment)) {
    throw new ApiKeyError("INVALID_ENVIRONMENT");
  }

  const generated = generateApiKey(environment);

  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, input.actorUserId),
        ),
      )
      .limit(1);

    if (!membership || !isOrgRole(membership.role)) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    requirePermission(membership.role, "apiKeys.create");
    const scopes = normalizeScopes(input.scopes, membership.role);

    const [created] = await tx
      .insert(apiKeys)
      .values({
        createdByUserId: input.actorUserId,
        environment,
        keyHash: generated.keyHash,
        keyId: generated.keyId,
        name,
        orgId: input.orgId,
        scopes,
      })
      .returning({ id: apiKeys.id });

    if (!created) {
      throw new ApiKeyError("KEY_NOT_FOUND");
    }

    return {
      ...generated,
      environment,
      id: created.id,
      name,
      scopes,
    };
  });
}

export async function listApiKeys(input: {
  actorUserId: string;
  orgId: string;
}) {
  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, input.orgId),
        eq(orgMembers.userId, input.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || !isOrgRole(membership.role)) {
    throw new ApiKeyError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, "apiKeys.read");

  return db
    .select({
      createdAt: apiKeys.createdAt,
      environment: apiKeys.environment,
      id: apiKeys.id,
      keyId: apiKeys.keyId,
      lastUsedAt: apiKeys.lastUsedAt,
      name: apiKeys.name,
      revokedAt: apiKeys.revokedAt,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(eq(apiKeys.orgId, input.orgId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function getApiKey(input: {
  actorUserId: string;
  apiKeyId: string;
  orgId: string;
}) {
  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, input.orgId),
        eq(orgMembers.userId, input.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || !isOrgRole(membership.role)) {
    throw new ApiKeyError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, "apiKeys.read");

  const [key] = await db
    .select({
      createdAt: apiKeys.createdAt,
      environment: apiKeys.environment,
      id: apiKeys.id,
      keyId: apiKeys.keyId,
      lastUsedAt: apiKeys.lastUsedAt,
      name: apiKeys.name,
      revokedAt: apiKeys.revokedAt,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.orgId, input.orgId)))
    .limit(1);

  if (!key) {
    throw new ApiKeyError("KEY_NOT_FOUND");
  }

  return key;
}

export async function updateApiKey(input: {
  actorUserId: string;
  apiKeyId: string;
  name?: unknown;
  orgId: string;
  scopes?: unknown;
}) {
  return db.transaction(async (tx) => {
    const [key] = await tx
      .select({ orgId: apiKeys.orgId })
      .from(apiKeys)
      .where(eq(apiKeys.id, input.apiKeyId))
      .for("update");

    if (!key || key.orgId !== input.orgId) {
      throw new ApiKeyError("KEY_NOT_FOUND");
    }

    const [membership] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, key.orgId),
          eq(orgMembers.userId, input.actorUserId),
        ),
      )
      .limit(1);

    if (!membership || !isOrgRole(membership.role)) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    requirePermission(membership.role, "apiKeys.update");

    const patch: { name?: string; scopes?: OrgPermission[] | null } = {};

    if (input.name !== undefined) {
      const name = normalizeKeyName(input.name);

      if (!name) {
        throw new ApiKeyError("INVALID_NAME");
      }

      patch.name = name;
    }

    if (input.scopes !== undefined) {
      patch.scopes = normalizeScopes(input.scopes, membership.role);
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiKeyError("INVALID_NAME");
    }

    const [updated] = await tx
      .update(apiKeys)
      .set(patch)
      .where(eq(apiKeys.id, input.apiKeyId))
      .returning({
        createdAt: apiKeys.createdAt,
        environment: apiKeys.environment,
        id: apiKeys.id,
        keyId: apiKeys.keyId,
        lastUsedAt: apiKeys.lastUsedAt,
        name: apiKeys.name,
        revokedAt: apiKeys.revokedAt,
        scopes: apiKeys.scopes,
      });

    if (!updated) {
      throw new ApiKeyError("KEY_NOT_FOUND");
    }

    return updated;
  });
}

export async function revokeApiKey(input: {
  actorUserId: string;
  apiKeyId: string;
  orgId?: string;
}) {
  return db.transaction(async (tx) => {
    const [key] = await tx
      .select({ orgId: apiKeys.orgId })
      .from(apiKeys)
      .where(eq(apiKeys.id, input.apiKeyId))
      .for("update");

    if (!key || (input.orgId && key.orgId !== input.orgId)) {
      throw new ApiKeyError("KEY_NOT_FOUND");
    }

    const [membership] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, key.orgId),
          eq(orgMembers.userId, input.actorUserId),
        ),
      )
      .limit(1);

    if (!membership || !isOrgRole(membership.role)) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    requirePermission(membership.role, "apiKeys.revoke");

    await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, input.apiKeyId), isNull(apiKeys.revokedAt)));
  });
}
