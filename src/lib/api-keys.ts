import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  apiKeyAuditEvents,
  apiKeys,
  broadcasts,
  orgMembers,
  users,
} from "@/db/schema";
import {
  generateApiKey,
  isApiKeyEnvironment,
} from "@/lib/api-key-crypto";
import type {
  ApiKeyAuditAction,
  ApiKeyAuditDetails,
} from "@/lib/api-key-audit-core";
import {
  can,
  isOrgRole,
  ORG_PERMISSIONS,
  requirePermission,
} from "@/lib/authorization";
import type { KeyScopes, OrgPermission, OrgRole } from "@/lib/authorization";

export { authenticateApiKey } from "@/lib/api-key-auth";
export type { ApiKeyPrincipal } from "@/lib/api-key-auth";

export type ApiKeyErrorCode =
  | "INVALID_ENVIRONMENT"
  | "INVALID_EXPIRY"
  | "INVALID_NAME"
  | "INVALID_SCOPES"
  | "KEY_IN_USE"
  | "KEY_NOT_FOUND"
  | "KEY_NOT_REVOKED"
  | "MEMBERSHIP_REQUIRED";

export class ApiKeyError extends Error {
  constructor(readonly code: ApiKeyErrorCode) {
    super(code);
    this.name = "ApiKeyError";
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ApiKeyAuditEventInput = typeof apiKeyAuditEvents.$inferInsert;

/** The API key making a key-management call, when the caller is not a console session. */
export type CallingApiKey = {
  apiKeyId?: string;
  environment: string;
  scopes: KeyScopes;
};

/** Key state after an audited change. */
export type ApiKeyAuditSnapshot = {
  environment: string;
  expiresAt: Date | null;
  keyId: string;
  name: string;
  orgId: string;
  scopes: string[] | null;
};

export function apiKeyAuditRow(input: {
  action: ApiKeyAuditAction;
  actorUserId: string;
  apiKeyId: string;
  callingKey?: CallingApiKey;
  details?: ApiKeyAuditDetails;
  key: ApiKeyAuditSnapshot;
}): ApiKeyAuditEventInput {
  return {
    action: input.action,
    actorUserId: input.actorUserId,
    apiKeyId: input.apiKeyId,
    details: input.details ?? null,
    environment: input.key.environment,
    expiresAt: input.key.expiresAt,
    keyName: input.key.name,
    keyPublicId: input.key.keyId,
    orgId: input.key.orgId,
    scopes: input.key.scopes,
    viaApiKeyId: input.callingKey?.apiKeyId ?? null,
  };
}

// Audit rows are written inside the same transaction as the change they record,
// so a change never commits without its event.
export async function recordApiKeyAuditEvents(
  tx: Transaction,
  events: ApiKeyAuditEventInput[],
) {
  if (events.length === 0) {
    return;
  }

  await tx.insert(apiKeyAuditEvents).values(events);
}

function effectivePermissions(role: OrgRole, scopes: OrgPermission[] | null) {
  return scopes ?? ORG_PERMISSIONS.filter((permission) => can(role, permission));
}

// A key may only hand out what it already holds: a narrowly scoped key must not
// mint or widen keys to its creator's full role.
function boundByCallingKey(
  scopes: OrgPermission[] | null,
  callingKey: CallingApiKey | undefined,
): OrgPermission[] | null {
  if (!callingKey?.scopes) return scopes;
  if (scopes === null) return [...callingKey.scopes];
  if (!scopes.every((scope) => callingKey.scopes?.includes(scope))) {
    throw new ApiKeyError("INVALID_SCOPES");
  }
  return scopes;
}

const ROLE_RANK: Record<OrgRole, number> = { member: 0, agency: 1, admin: 2, owner: 3 };

// Editing another member's key can disable it (scopes []), so it needs at least
// that member's rank.
function canManageKeysOf(actor: OrgRole, creator: OrgRole): boolean {
  return ROLE_RANK[actor] >= ROLE_RANK[creator];
}

function normalizeKeyName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length > 0 && name.length <= 80 ? name : null;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;

// Absent means no expiry. A supplied expiry must be a future instant, given as
// a Date or an ISO 8601 string.
function normalizeExpiresAt(value: unknown, now: Date): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  const expiresAt =
    value instanceof Date
      ? value
      : typeof value === "string" && ISO_DATE_TIME.test(value)
        ? new Date(value)
        : null;

  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    throw new ApiKeyError("INVALID_EXPIRY");
  }

  return expiresAt;
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

function sameScopes(
  current: string[] | null,
  next: OrgPermission[] | null,
): boolean {
  if (current === null || next === null) {
    return current === next;
  }

  return (
    current.length === next.length &&
    next.every((scope) => current.includes(scope))
  );
}

export async function createApiKey(input: {
  actorUserId: string;
  callingKey?: CallingApiKey;
  environment: unknown;
  expiresAt?: unknown;
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

  // A test key cannot mint a live key (or the reverse).
  if (input.callingKey && input.callingKey.environment !== environment) {
    throw new ApiKeyError("INVALID_ENVIRONMENT");
  }

  const expiresAt = normalizeExpiresAt(input.expiresAt, new Date());
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
    const scopes = boundByCallingKey(
      normalizeScopes(input.scopes, membership.role),
      input.callingKey,
    );

    const [created] = await tx
      .insert(apiKeys)
      .values({
        createdByUserId: input.actorUserId,
        environment,
        expiresAt,
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

    await recordApiKeyAuditEvents(tx, [
      apiKeyAuditRow({
        action: "created",
        actorUserId: input.actorUserId,
        apiKeyId: created.id,
        callingKey: input.callingKey,
        key: {
          environment,
          expiresAt,
          keyId: generated.keyId,
          name,
          orgId: input.orgId,
          scopes,
        },
      }),
    ]);

    return {
      ...generated,
      environment,
      expiresAt,
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
      expiresAt: apiKeys.expiresAt,
      id: apiKeys.id,
      keyId: apiKeys.keyId,
      lastUsedAt: apiKeys.lastUsedAt,
      name: apiKeys.name,
      revokedAt: apiKeys.revokedAt,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.orgId, input.orgId), isNull(apiKeys.deletedAt)))
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
      expiresAt: apiKeys.expiresAt,
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

export async function listApiKeyAuditEvents(input: {
  actorUserId: string;
  limit?: number;
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

  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);

  return db
    .select({
      action: apiKeyAuditEvents.action,
      actorEmail: users.email,
      actorName: users.name,
      apiKeyId: apiKeyAuditEvents.apiKeyId,
      createdAt: apiKeyAuditEvents.createdAt,
      details: apiKeyAuditEvents.details,
      environment: apiKeyAuditEvents.environment,
      expiresAt: apiKeyAuditEvents.expiresAt,
      id: apiKeyAuditEvents.id,
      keyName: apiKeyAuditEvents.keyName,
      keyPublicId: apiKeyAuditEvents.keyPublicId,
      scopes: apiKeyAuditEvents.scopes,
      viaApiKeyId: apiKeyAuditEvents.viaApiKeyId,
    })
    .from(apiKeyAuditEvents)
    .leftJoin(users, eq(users.id, apiKeyAuditEvents.actorUserId))
    .where(eq(apiKeyAuditEvents.orgId, input.orgId))
    .orderBy(desc(apiKeyAuditEvents.createdAt), desc(apiKeyAuditEvents.id))
    .limit(limit);
}

export async function updateApiKey(input: {
  actorUserId: string;
  apiKeyId: string;
  callingKey?: CallingApiKey;
  name?: unknown;
  orgId: string;
  scopes?: unknown;
}) {
  return db.transaction(async (tx) => {
    const [key] = await tx
      .select({
        createdByUserId: apiKeys.createdByUserId,
        environment: apiKeys.environment,
        expiresAt: apiKeys.expiresAt,
        keyId: apiKeys.keyId,
        name: apiKeys.name,
        orgId: apiKeys.orgId,
        scopes: apiKeys.scopes,
      })
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

    if (input.callingKey && input.callingKey.environment !== key.environment) {
      throw new ApiKeyError("KEY_NOT_FOUND");
    }

    if (input.scopes !== undefined) {
      const scopes = boundByCallingKey(
        normalizeScopes(input.scopes, membership.role),
        input.callingKey,
      );
      // A key runs with its creator's role, so an editor may only rescope keys
      // of members they outrank or match, and only within their own role.
      if (key.createdByUserId && key.createdByUserId !== input.actorUserId) {
        const [creator] = await tx
          .select({ role: orgMembers.role })
          .from(orgMembers)
          .where(
            and(
              eq(orgMembers.orgId, key.orgId),
              eq(orgMembers.userId, key.createdByUserId),
            ),
          )
          .limit(1);
        const actorRole = membership.role;
        if (creator && isOrgRole(creator.role)) {
          const creatorRole = creator.role;
          if (
            !canManageKeysOf(actorRole, creatorRole) ||
            !effectivePermissions(creatorRole, scopes).every((permission) =>
              can(actorRole, permission),
            )
          ) {
            throw new ApiKeyError("INVALID_SCOPES");
          }
        }
      }
      patch.scopes = scopes;
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
        expiresAt: apiKeys.expiresAt,
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

    const changes: NonNullable<ApiKeyAuditDetails["changes"]> = {};

    if (patch.name !== undefined && patch.name !== key.name) {
      changes.name = { from: key.name, to: patch.name };
    }

    if (patch.scopes !== undefined && !sameScopes(key.scopes, patch.scopes)) {
      changes.scopes = { from: key.scopes, to: patch.scopes };
    }

    if (Object.keys(changes).length > 0) {
      await recordApiKeyAuditEvents(tx, [
        apiKeyAuditRow({
          action: "updated",
          actorUserId: input.actorUserId,
          apiKeyId: updated.id,
          callingKey: input.callingKey,
          details: { changes },
          key: {
            environment: updated.environment,
            expiresAt: updated.expiresAt,
            keyId: updated.keyId,
            name: updated.name,
            orgId: key.orgId,
            scopes: updated.scopes,
          },
        }),
      ]);
    }

    return updated;
  });
}

export async function revokeApiKey(input: {
  actorUserId: string;
  apiKeyId: string;
  callingKey?: CallingApiKey;
  orgId?: string;
}) {
  return db.transaction(async (tx) => {
    const [key] = await tx
      .select({
        environment: apiKeys.environment,
        expiresAt: apiKeys.expiresAt,
        keyId: apiKeys.keyId,
        name: apiKeys.name,
        orgId: apiKeys.orgId,
        scopes: apiKeys.scopes,
      })
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

    const [revoked] = await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, input.apiKeyId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });

    // Re-revoking an already revoked key is a no-op and is not logged.
    if (!revoked) {
      return;
    }

    await recordApiKeyAuditEvents(tx, [
      apiKeyAuditRow({
        action: "revoked",
        actorUserId: input.actorUserId,
        apiKeyId: revoked.id,
        callingKey: input.callingKey,
        key,
      }),
    ]);
  });
}

export async function deleteApiKey(input: {
  actorUserId: string;
  apiKeyId: string;
  orgId: string;
}) {
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

    requirePermission(membership.role, "apiKeys.revoke");

    const [key] = await tx
      .select({
        environment: apiKeys.environment,
        expiresAt: apiKeys.expiresAt,
        keyId: apiKeys.keyId,
        name: apiKeys.name,
        orgId: apiKeys.orgId,
        revokedAt: apiKeys.revokedAt,
        scopes: apiKeys.scopes,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.orgId, input.orgId)))
      .for("update");

    if (!key) {
      throw new ApiKeyError("KEY_NOT_FOUND");
    }
    if (!key.revokedAt) {
      throw new ApiKeyError("KEY_NOT_REVOKED");
    }

    // A broadcast that is still scheduled, running or paused depends on this key's
    // check. Once the reference clears it would fall back to its creator's
    // membership, so cancel those broadcasts before the key can be deleted.
    const pending = await tx
      .select({ id: broadcasts.id })
      .from(broadcasts)
      .where(
        and(
          eq(broadcasts.apiKeyId, input.apiKeyId),
          inArray(broadcasts.status, ["scheduled", "running", "paused"]),
        ),
      )
      .for("update");

    if (pending.length > 0) {
      throw new ApiKeyError("KEY_IN_USE");
    }

    await recordApiKeyAuditEvents(tx, [
      apiKeyAuditRow({
        action: "deleted",
        actorUserId: input.actorUserId,
        apiKeyId: input.apiKeyId,
        key,
      }),
    ]);

    // Hard delete. Broadcasts and request logs keep their rows with the key
    // reference cleared; the audit event above keeps the key's identity.
    await tx.delete(apiKeys).where(eq(apiKeys.id, input.apiKeyId));
  });
}
