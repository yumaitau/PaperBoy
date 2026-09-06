import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  orgMembers,
  orgs,
  webhookDeliveries,
  webhookEndpoints,
} from "@/db/schema";
import {
  isOrgRole,
  requirePermission,
  type OrgPermission,
} from "@/lib/authorization";
import {
  WebhookError,
  configuredWebhookEncryptionKey,
  createWebhookSigningSecret,
  encryptWebhookSigningSecret,
  parseWebhookConfigurationInput,
} from "@/lib/webhook-core";

export type WebhookEndpointRecord = {
  createdAt: Date;
  enabled: boolean;
  id: string;
  updatedAt: Date;
  url: string;
};

export type WebhookConfigurationResult = {
  endpoint: WebhookEndpointRecord;
  signingSecret: string | null;
};

async function requireWebhookPermission(input: {
  actorUserId: string | null;
  orgId: string;
  permission: OrgPermission;
}): Promise<void> {
  if (!input.actorUserId) {
    throw new WebhookError("MEMBERSHIP_REQUIRED");
  }

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
    throw new WebhookError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, input.permission);
}

function endpointFromRow(
  row: typeof webhookEndpoints.$inferSelect,
): WebhookEndpointRecord {
  return {
    createdAt: row.createdAt,
    enabled: row.enabled,
    id: row.id,
    updatedAt: row.updatedAt,
    url: row.url,
  };
}

export async function getWebhookEndpoint(input: {
  actorUserId: string | null;
  orgId: string;
}): Promise<WebhookEndpointRecord | null> {
  await requireWebhookPermission({ ...input, permission: "webhooks.read" });
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.orgId, input.orgId))
    .limit(1);
  return endpoint ? endpointFromRow(endpoint) : null;
}

export async function configureWebhookEndpoint(input: {
  actorUserId: string | null;
  allowInsecureLoopback?: boolean;
  encryptionKey?: Buffer;
  now?: Date;
  orgId: string;
  payload: unknown;
}): Promise<WebhookConfigurationResult> {
  const actorUserId = input.actorUserId;

  if (!actorUserId) {
    throw new WebhookError("MEMBERSHIP_REQUIRED");
  }

  return db.transaction(async (tx) => {
    await tx
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.id, input.orgId))
      .for("update");
    const [membership] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, actorUserId),
        ),
      )
      .limit(1);

    if (!membership || !isOrgRole(membership.role)) {
      throw new WebhookError("MEMBERSHIP_REQUIRED");
    }

    requirePermission(membership.role, "webhooks.manage");
    const { url } = parseWebhookConfigurationInput(input.payload, {
      allowInsecureLoopback:
        input.allowInsecureLoopback ?? process.env.NODE_ENV !== "production",
    });
    const now = input.now ?? new Date();
    const [existing] = await tx
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.orgId, input.orgId))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(webhookEndpoints)
        .set({ updatedAt: now, url })
        .where(eq(webhookEndpoints.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Webhook endpoint update returned no row.");
      }

      return { endpoint: endpointFromRow(updated), signingSecret: null };
    }

    const id = randomUUID();
    const signingSecret = createWebhookSigningSecret();
    const encryptedSecret = encryptWebhookSigningSecret({
      context: { endpointId: id, orgId: input.orgId },
      encryptionKey:
        input.encryptionKey ?? configuredWebhookEncryptionKey(),
      secret: signingSecret,
    });
    const [created] = await tx
      .insert(webhookEndpoints)
      .values({
        createdAt: now,
        createdByUserId: actorUserId,
        encryptedSecret,
        id,
        orgId: input.orgId,
        updatedAt: now,
        url,
      })
      .returning();

    if (!created) {
      throw new Error("Webhook endpoint insert returned no row.");
    }

    return { endpoint: endpointFromRow(created), signingSecret };
  });
}

export type WebhookEventRecord = {
  attemptCount: number;
  createdAt: Date;
  deliveredAt: Date | null;
  endpointId: string;
  eventType: string | null;
  failedAt: Date | null;
  failureReason: string | null;
  id: string;
  lastAttemptAt: Date | null;
  lastErrorCode: string | null;
  responseStatus: number | null;
  status: string;
  updatedAt: Date;
  url: string;
};

export type WebhookEventAttempt = {
  attemptCount: number;
  attemptedAt: Date | null;
  failureReason: string | null;
  lastErrorCode: string | null;
  responseStatus: number | null;
  status: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireWebhookId(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new WebhookError("WEBHOOK_NOT_FOUND");
  }
}

function parseEnabled(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true || value === false) return value;
  throw new WebhookError("INVALID_INPUT");
}

export async function createWebhook(input: {
  actorUserId: string | null;
  encryptionKey?: Buffer;
  now?: Date;
  orgId: string;
  payload: unknown;
}): Promise<WebhookConfigurationResult> {
  if (!input.actorUserId) {
    throw new WebhookError("MEMBERSHIP_REQUIRED");
  }

  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, input.actorUserId as string),
        ),
      )
      .limit(1);

    if (!membership || !isOrgRole(membership.role)) {
      throw new WebhookError("MEMBERSHIP_REQUIRED");
    }

    requirePermission(membership.role, "webhooks.manage");

    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
      throw new WebhookError("INVALID_INPUT");
    }

    const body = input.payload as Record<string, unknown>;
    const { url } = parseWebhookConfigurationInput(
      { url: body["url"] },
      { allowInsecureLoopback: process.env.NODE_ENV !== "production" },
    );
    const enabled = parseEnabled(body["enabled"]) ?? true;
    const now = input.now ?? new Date();
    const id = randomUUID();
    const signingSecret = createWebhookSigningSecret();
    const encryptedSecret = encryptWebhookSigningSecret({
      context: { endpointId: id, orgId: input.orgId },
      encryptionKey: input.encryptionKey ?? configuredWebhookEncryptionKey(),
      secret: signingSecret,
    });

    const [created] = await tx
      .insert(webhookEndpoints)
      .values({
        createdAt: now,
        createdByUserId: input.actorUserId as string,
        enabled,
        encryptedSecret,
        id,
        orgId: input.orgId,
        updatedAt: now,
        url,
      })
      .returning();

    if (!created) {
      throw new Error("Webhook endpoint insert returned no row.");
    }

    return { endpoint: endpointFromRow(created), signingSecret };
  });
}

export async function listWebhooks(input: {
  actorUserId: string | null;
  orgId: string;
}): Promise<WebhookEndpointRecord[]> {
  await requireWebhookPermission({ ...input, permission: "webhooks.read" });

  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.orgId, input.orgId))
    .orderBy(asc(webhookEndpoints.createdAt));

  return rows.map(endpointFromRow);
}

export async function getWebhook(input: {
  actorUserId: string | null;
  orgId: string;
  webhookId: string;
}): Promise<WebhookEndpointRecord> {
  await requireWebhookPermission({ ...input, permission: "webhooks.read" });
  requireWebhookId(input.webhookId);

  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, input.webhookId),
        eq(webhookEndpoints.orgId, input.orgId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new WebhookError("WEBHOOK_NOT_FOUND");
  }

  return endpointFromRow(row);
}

export async function updateWebhook(input: {
  actorUserId: string | null;
  orgId: string;
  payload: unknown;
  webhookId: string;
}): Promise<WebhookConfigurationResult> {
  if (!input.actorUserId) {
    throw new WebhookError("MEMBERSHIP_REQUIRED");
  }

  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, input.orgId),
          eq(orgMembers.userId, input.actorUserId as string),
        ),
      )
      .limit(1);

    if (!membership || !isOrgRole(membership.role)) {
      throw new WebhookError("MEMBERSHIP_REQUIRED");
    }

    requirePermission(membership.role, "webhooks.manage");
    requireWebhookId(input.webhookId);

    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
      throw new WebhookError("INVALID_INPUT");
    }

    const body = input.payload as Record<string, unknown>;
    const patch: { enabled?: boolean; updatedAt: Date; url?: string } = {
      updatedAt: new Date(),
    };

    if (Object.hasOwn(body, "url")) {
      const { url } = parseWebhookConfigurationInput(
        { url: body["url"] },
        { allowInsecureLoopback: process.env.NODE_ENV !== "production" },
      );
      patch.url = url;
    }

    if (Object.hasOwn(body, "enabled")) {
      const enabled = parseEnabled(body["enabled"]);
      if (enabled === undefined) {
        throw new WebhookError("INVALID_INPUT");
      }
      patch.enabled = enabled;
    }

    if (patch.url === undefined && patch.enabled === undefined) {
      throw new WebhookError("INVALID_INPUT");
    }

    const [updated] = await tx
      .update(webhookEndpoints)
      .set(patch)
      .where(
        and(
          eq(webhookEndpoints.id, input.webhookId),
          eq(webhookEndpoints.orgId, input.orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new WebhookError("WEBHOOK_NOT_FOUND");
    }

    return { endpoint: endpointFromRow(updated), signingSecret: null };
  });
}

export async function deleteWebhook(input: {
  actorUserId: string | null;
  orgId: string;
  webhookId: string;
}): Promise<void> {
  await requireWebhookPermission({ ...input, permission: "webhooks.manage" });
  requireWebhookId(input.webhookId);

  const deleted = await db
    .delete(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, input.webhookId),
        eq(webhookEndpoints.orgId, input.orgId),
      ),
    )
    .returning({ id: webhookEndpoints.id });

  if (deleted.length !== 1) {
    throw new WebhookError("WEBHOOK_NOT_FOUND");
  }
}

const deliverySelection = {
  attemptCount: webhookDeliveries.attemptCount,
  createdAt: webhookDeliveries.createdAt,
  deliveredAt: webhookDeliveries.deliveredAt,
  endpointId: webhookDeliveries.endpointId,
  failedAt: webhookDeliveries.failedAt,
  failureReason: webhookDeliveries.failureReason,
  id: webhookDeliveries.id,
  lastAttemptAt: webhookDeliveries.lastAttemptAt,
  lastErrorCode: webhookDeliveries.lastErrorCode,
  responseStatus: webhookDeliveries.responseStatus,
  status: webhookDeliveries.status,
  updatedAt: webhookDeliveries.updatedAt,
  url: webhookDeliveries.url,
};

type DeliveryRow = {
  attemptCount: number;
  createdAt: Date;
  deliveredAt: Date | null;
  endpointId: string;
  failedAt: Date | null;
  failureReason: string | null;
  id: string;
  lastAttemptAt: Date | null;
  lastErrorCode: string | null;
  responseStatus: number | null;
  status: string;
  updatedAt: Date;
  url: string;
};

function toEventRecord(row: DeliveryRow, eventType: string | null): WebhookEventRecord {
  return { ...row, eventType };
}

async function requireEndpoint(
  orgId: string,
  webhookId: string,
): Promise<typeof webhookEndpoints.$inferSelect> {
  requireWebhookId(webhookId);

  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, webhookId),
        eq(webhookEndpoints.orgId, orgId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new WebhookError("WEBHOOK_NOT_FOUND");
  }

  return row;
}

export async function listWebhookEvents(input: {
  actorUserId: string | null;
  limit?: number;
  orgId: string;
  webhookId: string;
}): Promise<WebhookEventRecord[]> {
  await requireWebhookPermission({ ...input, permission: "webhooks.read" });
  await requireEndpoint(input.orgId, input.webhookId);
  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));

  const rows = await db
    .select({ ...deliverySelection, eventType: events.type })
    .from(webhookDeliveries)
    .leftJoin(events, eq(events.id, webhookDeliveries.eventId))
    .where(
      and(
        eq(webhookDeliveries.orgId, input.orgId),
        eq(webhookDeliveries.endpointId, input.webhookId),
      ),
    )
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);

  return rows.map((row) =>
    toEventRecord(
      {
        attemptCount: row.attemptCount,
        createdAt: row.createdAt,
        deliveredAt: row.deliveredAt,
        endpointId: row.endpointId,
        failedAt: row.failedAt,
        failureReason: row.failureReason,
        id: row.id,
        lastAttemptAt: row.lastAttemptAt,
        lastErrorCode: row.lastErrorCode,
        responseStatus: row.responseStatus,
        status: row.status,
        updatedAt: row.updatedAt,
        url: row.url,
      },
      row.eventType,
    ),
  );
}

export async function getWebhookEvent(input: {
  actorUserId: string | null;
  eventId: string;
  orgId: string;
  webhookId: string;
}): Promise<WebhookEventRecord> {
  await requireWebhookPermission({ ...input, permission: "webhooks.read" });
  await requireEndpoint(input.orgId, input.webhookId);

  if (!UUID_PATTERN.test(input.eventId)) {
    throw new WebhookError("EVENT_NOT_FOUND");
  }

  const [row] = await db
    .select({ ...deliverySelection, eventType: events.type })
    .from(webhookDeliveries)
    .leftJoin(events, eq(events.id, webhookDeliveries.eventId))
    .where(
      and(
        eq(webhookDeliveries.id, input.eventId),
        eq(webhookDeliveries.orgId, input.orgId),
        eq(webhookDeliveries.endpointId, input.webhookId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new WebhookError("EVENT_NOT_FOUND");
  }

  return toEventRecord(
    {
      attemptCount: row.attemptCount,
      createdAt: row.createdAt,
      deliveredAt: row.deliveredAt,
      endpointId: row.endpointId,
      failedAt: row.failedAt,
      failureReason: row.failureReason,
      id: row.id,
      lastAttemptAt: row.lastAttemptAt,
      lastErrorCode: row.lastErrorCode,
      responseStatus: row.responseStatus,
      status: row.status,
      updatedAt: row.updatedAt,
      url: row.url,
    },
    row.eventType,
  );
}

export async function replayWebhookEvent(input: {
  actorUserId: string | null;
  eventId: string;
  now?: Date;
  orgId: string;
  webhookId: string;
}): Promise<WebhookEventRecord> {
  await requireWebhookPermission({ ...input, permission: "webhooks.manage" });
  const endpoint = await requireEndpoint(input.orgId, input.webhookId);

  if (!endpoint.enabled) {
    throw new WebhookError("ENDPOINT_DISABLED");
  }

  if (!UUID_PATTERN.test(input.eventId)) {
    throw new WebhookError("EVENT_NOT_FOUND");
  }

  const now = input.now ?? new Date();
  const [requeued] = await db
    .update(webhookDeliveries)
    .set({
      deliveredAt: null,
      failedAt: null,
      failureReason: null,
      lastErrorCode: null,
      nextAttemptAt: now,
      responseStatus: null,
      status: "queued",
      updatedAt: now,
    })
    .where(
      and(
        eq(webhookDeliveries.id, input.eventId),
        eq(webhookDeliveries.orgId, input.orgId),
        eq(webhookDeliveries.endpointId, input.webhookId),
      ),
    )
    .returning(deliverySelection);

  if (!requeued) {
    throw new WebhookError("EVENT_NOT_FOUND");
  }

  const [eventRow] = await db
    .select({ type: events.type })
    .from(webhookDeliveries)
    .leftJoin(events, eq(events.id, webhookDeliveries.eventId))
    .where(eq(webhookDeliveries.id, requeued.id))
    .limit(1);

  return toEventRecord(requeued, eventRow?.type ?? null);
}

export async function listWebhookEventAttempts(input: {
  actorUserId: string | null;
  eventId: string;
  orgId: string;
  webhookId: string;
}): Promise<WebhookEventAttempt[]> {
  const event = await getWebhookEvent(input);

  if (event.attemptCount === 0 && !event.lastAttemptAt) {
    return [];
  }

  return [
    {
      attemptCount: event.attemptCount,
      attemptedAt: event.lastAttemptAt,
      failureReason: event.failureReason,
      lastErrorCode: event.lastErrorCode,
      responseStatus: event.responseStatus,
      status: event.status,
    },
  ];
}
