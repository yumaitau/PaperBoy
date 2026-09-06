import { and, asc, count, desc, eq, ilike, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  apiKeys,
  broadcastRecipients,
  broadcasts,
  contacts,
  emailSuppressions,
  events,
  orgMembers,
} from "@/db/schema";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AudienceError } from "@/lib/audience-core";
import { getActiveAudienceContacts } from "@/lib/audiences";
import {
  can,
  isOrgRole,
  requirePermission,
  type OrgPermission,
} from "@/lib/authorization";
import {
  BroadcastError,
  parseCreateBroadcastInput,
  parseUpdateBroadcastInput,
  type BroadcastRecipientStatus,
  type BroadcastStatus,
} from "@/lib/broadcast-core";
import { DomainError } from "@/lib/domain-core";
import { EmailError } from "@/lib/email-core";
import {
  queueEmail,
  type MessageQueuePrincipal,
  type QueuedMessageRecord,
} from "@/lib/messages";
import { RateLimitError } from "@/lib/rate-limit-core";
import { requestBroadcastJob } from "@/lib/job-queue";
import { TemplateError, renderTemplateForSend } from "@/lib/template-core";
import { getTemplate, requirePublishedTemplate } from "@/lib/templates";
import {
  createUnsubscribeUrl,
  withUnsubscribeFooter,
} from "@/lib/unsubscribe-core";

export type BroadcastProgress = {
  cancelled: number;
  failed: number;
  pending: number;
  processing: number;
  queued: number;
  suppressed: number;
  total: number;
};

export type BroadcastRecord = {
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  environment: "live" | "test";
  from: string;
  id: string;
  name: string;
  pausedAt: Date | null;
  progress: BroadcastProgress;
  scheduledFor: Date | null;
  sourceAudienceId: string | null;
  sourceTemplateId: string | null;
  status: BroadcastStatus;
  templateHtml: string | null;
  templateName: string;
  templateRequiredVariables: string[];
  templateSubject: string;
  templateText: string | null;
  updatedAt: Date;
};

export type BroadcastPrincipal = Omit<ApiKeyPrincipal, "apiKeyId"> & {
  apiKeyId: string | null;
};

export type BroadcastQueue = (input: {
  allowAttachments?: boolean;
  idempotencyKey?: unknown;
  payload: unknown;
  principal: MessageQueuePrincipal;
}) => Promise<QueuedMessageRecord>;

type ProcessBroadcastDependencies = {
  now?: () => Date;
  queue?: BroadcastQueue;
  unsubscribeUrl?: (contactId: string) => string;
};

const broadcastSelection = {
  apiKeyId: broadcasts.apiKeyId,
  cancelledAt: broadcasts.cancelledAt,
  completedAt: broadcasts.completedAt,
  createdAt: broadcasts.createdAt,
  createdByUserId: broadcasts.createdByUserId,
  environment: broadcasts.environment,
  from: broadcasts.from,
  id: broadcasts.id,
  name: broadcasts.name,
  orgId: broadcasts.orgId,
  pausedAt: broadcasts.pausedAt,
  scheduledFor: broadcasts.scheduledFor,
  sourceAudienceId: broadcasts.sourceAudienceId,
  sourceTemplateId: broadcasts.sourceTemplateId,
  status: broadcasts.status,
  templateHtml: broadcasts.templateHtml,
  templateName: broadcasts.templateName,
  templateRequiredVariables: broadcasts.templateRequiredVariables,
  templateSubject: broadcasts.templateSubject,
  templateText: broadcasts.templateText,
  updatedAt: broadcasts.updatedAt,
};
const BROADCAST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireBroadcastId(broadcastId: string): void {
  if (!BROADCAST_ID_PATTERN.test(broadcastId)) {
    throw new BroadcastError("BROADCAST_NOT_FOUND");
  }
}

function emptyProgress(): BroadcastProgress {
  return {
    cancelled: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    queued: 0,
    suppressed: 0,
    total: 0,
  };
}

async function requireOrganizationPermission(input: {
  actorUserId: string | null;
  orgId: string;
  permission: OrgPermission;
}): Promise<string> {
  if (!input.actorUserId) {
    throw new BroadcastError("MEMBERSHIP_REQUIRED");
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
    throw new BroadcastError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, input.permission);
  return input.actorUserId;
}

async function broadcastProgress(
  broadcastIds: string[],
): Promise<Map<string, BroadcastProgress>> {
  const progressById = new Map<string, BroadcastProgress>();
  if (!broadcastIds.length) return progressById;

  const rows = await db
    .select({
      broadcastId: broadcastRecipients.broadcastId,
      count: count(),
      status: broadcastRecipients.status,
    })
    .from(broadcastRecipients)
    .where(inArray(broadcastRecipients.broadcastId, broadcastIds))
    .groupBy(broadcastRecipients.broadcastId, broadcastRecipients.status);

  for (const row of rows) {
    const progress = progressById.get(row.broadcastId) ?? emptyProgress();
    progress[row.status] = row.count;
    progress.total += row.count;
    progressById.set(row.broadcastId, progress);
  }

  return progressById;
}

async function recordFromRow(
  row: typeof broadcasts.$inferSelect,
  progress?: BroadcastProgress,
): Promise<BroadcastRecord> {
  return {
    cancelledAt: row.cancelledAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    environment: row.environment,
    from: row.from,
    id: row.id,
    name: row.name,
    pausedAt: row.pausedAt,
    progress:
      progress ?? (await broadcastProgress([row.id])).get(row.id) ?? emptyProgress(),
    scheduledFor: row.scheduledFor,
    sourceAudienceId: row.sourceAudienceId,
    sourceTemplateId: row.sourceTemplateId,
    status: row.status,
    templateHtml: row.templateHtml,
    templateName: row.templateName,
    templateRequiredVariables: row.templateRequiredVariables,
    templateSubject: row.templateSubject,
    templateText: row.templateText,
    updatedAt: row.updatedAt,
  };
}

async function readBroadcastRow(input: { orgId: string; broadcastId: string }) {
  requireBroadcastId(input.broadcastId);
  const [row] = await db
    .select()
    .from(broadcasts)
    .where(
      and(
        eq(broadcasts.id, input.broadcastId),
        eq(broadcasts.orgId, input.orgId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new BroadcastError("BROADCAST_NOT_FOUND");
  }

  return row;
}

function failureCode(error: unknown): string {
  if (error instanceof TemplateError) {
    return error.code === "MISSING_REQUIRED_VARIABLES"
      ? "missing_template_variables"
      : "template_validation_error";
  }

  if (error instanceof EmailError) {
    return error.code === "RECIPIENT_SUPPRESSED"
      ? "recipient_suppressed"
      : "email_validation_error";
  }

  if (error instanceof DomainError) {
    return error.code === "INVALID_DOMAIN"
      ? "invalid_from_domain"
      : "domain_not_verified";
  }

  return "queue_error";
}

async function claimRecipient(input: {
  broadcastId: string;
  orgId: string;
  now: Date;
}) {
  requireBroadcastId(input.broadcastId);
  return db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select(broadcastSelection)
      .from(broadcasts)
      .where(
        and(
          eq(broadcasts.id, input.broadcastId),
          eq(broadcasts.orgId, input.orgId),
        ),
      )
      .for("update");

    if (!broadcast) {
      throw new BroadcastError("BROADCAST_NOT_FOUND");
    }

    if (broadcast.status !== "running") {
      return null;
    }

    let authorized = false;
    if (broadcast.apiKeyId) {
      const [credential] = await tx
        .select({ revokedAt: apiKeys.revokedAt })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, broadcast.apiKeyId),
            eq(apiKeys.orgId, broadcast.orgId),
          ),
        )
        .limit(1);
      authorized = Boolean(credential && !credential.revokedAt);
    } else if (broadcast.createdByUserId) {
      const [membership] = await tx
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, broadcast.orgId),
            eq(orgMembers.userId, broadcast.createdByUserId),
          ),
        )
        .limit(1);
      authorized = Boolean(
        membership &&
          isOrgRole(membership.role) &&
          can(membership.role, "broadcasts.create"),
      );
    }

    if (!authorized) {
      await tx
        .update(broadcasts)
        .set({ pausedAt: input.now, status: "paused", updatedAt: input.now })
        .where(eq(broadcasts.id, broadcast.id));
      return null;
    }

    const [recipient] = await tx
      .select({
        data: broadcastRecipients.data,
        email: broadcastRecipients.email,
        id: broadcastRecipients.id,
      })
      .from(broadcastRecipients)
      .where(
        and(
          eq(broadcastRecipients.broadcastId, broadcast.id),
          eq(broadcastRecipients.status, "pending"),
        ),
      )
      .orderBy(asc(broadcastRecipients.position))
      .limit(1)
      .for("update");

    if (!recipient) {
      const [processing] = await tx
        .select({ count: count() })
        .from(broadcastRecipients)
        .where(
          and(
            eq(broadcastRecipients.broadcastId, broadcast.id),
            eq(broadcastRecipients.status, "processing"),
          ),
        );

      if (Number(processing?.count ?? 0) === 0) {
        await tx
          .update(broadcasts)
          .set({
            completedAt: input.now,
            status: "completed",
            updatedAt: input.now,
          })
          .where(
            and(
              eq(broadcasts.id, broadcast.id),
              eq(broadcasts.status, "running"),
            ),
          );
      }

      return null;
    }

    await tx
      .update(broadcastRecipients)
      .set({ status: "processing", updatedAt: input.now })
      .where(
        and(
          eq(broadcastRecipients.id, recipient.id),
          eq(broadcastRecipients.status, "pending"),
        ),
      );

    return { broadcast, recipient };
  });
}

async function finishRecipient(input: {
  broadcastId: string;
  failureCode?: string;
  messageId?: string;
  now: Date;
  recipientId: string;
  status: Exclude<BroadcastRecipientStatus, "pending" | "processing">;
}) {
  await db
    .update(broadcastRecipients)
    .set({
      failureCode: input.failureCode ?? null,
      messageId: input.messageId ?? null,
      processedAt: input.now,
      status: input.status,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(broadcastRecipients.id, input.recipientId),
        eq(broadcastRecipients.status, "processing"),
      ),
    );

  await db
    .update(broadcasts)
    .set({ updatedAt: input.now })
    .where(eq(broadcasts.id, input.broadcastId));
}

async function deferRateLimitedBroadcast(input: {
  broadcastId: string;
  now: Date;
  recipientId: string;
  retryAfterSeconds: number;
}) {
  const delaySeconds = Math.max(1, input.retryAfterSeconds);
  const runAt = new Date(input.now.getTime() + delaySeconds * 1000);
  const [updated] = await db.transaction(async (tx) => {
    await tx
      .update(broadcastRecipients)
      .set({
        failureCode: null,
        status: "pending",
        updatedAt: input.now,
      })
      .where(
        and(
          eq(broadcastRecipients.id, input.recipientId),
          eq(broadcastRecipients.status, "processing"),
        ),
      );
    return tx
      .update(broadcasts)
      .set({
        pausedAt: null,
        scheduledFor: runAt,
        status: "scheduled",
        updatedAt: input.now,
      })
      .where(eq(broadcasts.id, input.broadcastId))
      .returning({ id: broadcasts.id, orgId: broadcasts.orgId });
  });
  if (updated) {
    requestBroadcastJob({
      broadcastId: updated.id,
      orgId: updated.orgId,
      runAt,
    });
  }
}

export async function processBroadcast(
  input: { broadcastId: string; orgId: string },
  dependencies: ProcessBroadcastDependencies = {},
): Promise<void> {
  const now = dependencies.now ?? (() => new Date());
  const queue = dependencies.queue ?? queueEmail;

  for (;;) {
    const claimed = await claimRecipient({ ...input, now: now() });

    if (!claimed) {
      return;
    }

    const { broadcast, recipient } = claimed;
    const [suppression] = await db
      .select({ id: emailSuppressions.id })
      .from(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.orgId, broadcast.orgId),
          eq(emailSuppressions.email, recipient.email),
        ),
      )
      .limit(1);

    if (suppression) {
      await finishRecipient({
        broadcastId: broadcast.id,
        now: now(),
        recipientId: recipient.id,
        status: "suppressed",
      });
      continue;
    }

    try {
      const rendered = renderTemplateForSend(
        {
          html: broadcast.templateHtml,
          requiredVariables: broadcast.templateRequiredVariables,
          subject: broadcast.templateSubject,
          text: broadcast.templateText,
        },
        recipient.data,
      );
      const message = await queue({
        allowAttachments: false,
        ...(broadcast.apiKeyId
          ? { idempotencyKey: `broadcast:${broadcast.id}:${recipient.id}` }
          : {}),
        payload: {
          from: broadcast.from,
          ...(rendered.html === null ? {} : { html: rendered.html }),
          subject: rendered.subject,
          tags: [{ name: "broadcast_id", value: broadcast.id }],
          ...(rendered.text === null ? {} : { text: rendered.text }),
          to: [recipient.email],
        },
        principal: {
          actorUserId: broadcast.createdByUserId,
          apiKeyId: broadcast.apiKeyId,
          environment: broadcast.environment,
          orgId: broadcast.orgId,
          scopes: null,
        },
      });

      await finishRecipient({
        broadcastId: broadcast.id,
        messageId: message.id,
        now: now(),
        recipientId: recipient.id,
        status: "queued",
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        await deferRateLimitedBroadcast({
          broadcastId: broadcast.id,
          now: now(),
          recipientId: recipient.id,
          retryAfterSeconds: error.retryAfterSeconds,
        });
        return;
      }
      await finishRecipient({
        broadcastId: broadcast.id,
        failureCode: failureCode(error),
        now: now(),
        recipientId: recipient.id,
        status:
          error instanceof EmailError &&
          error.code === "RECIPIENT_SUPPRESSED"
            ? "suppressed"
            : "failed",
      });
    }
  }
}

export async function createBroadcast(
  input: { payload: unknown; principal: BroadcastPrincipal },
  dependencies: ProcessBroadcastDependencies = {},
): Promise<BroadcastRecord> {
  const actorUserId = await requireOrganizationPermission({
    actorUserId: input.principal.actorUserId,
    orgId: input.principal.orgId,
    permission: "broadcasts.create",
  });
  const definition = parseCreateBroadcastInput(input.payload);
  const now = dependencies.now?.() ?? new Date();
  if (definition.scheduledFor && definition.scheduledFor <= now) {
    throw new BroadcastError("VALIDATION_ERROR", [
      {
        field: "scheduled_for",
        message: "Schedule broadcasts in the future.",
      },
    ]);
  }
  const [template, audience] = await Promise.all([
    getTemplate({
      actorUserId,
      orgId: input.principal.orgId,
      templateId: definition.templateId,
    }),
    getActiveAudienceContacts({
      audienceId: definition.audienceId,
      orgId: input.principal.orgId,
    }),
  ]);
  requirePublishedTemplate(template);
  if (audience.length === 0) throw new AudienceError("AUDIENCE_EMPTY");
  const unsubscribeUrl =
    dependencies.unsubscribeUrl ??
    ((contactId: string) => createUnsubscribeUrl({ contactId }));
  const templateBodies = withUnsubscribeFooter({
    html: template.html,
    text: template.text,
  });
  const recipients = audience.map((contact) => ({
    contactId: contact.id,
    data: {
      contact: { email: contact.email, name: contact.name ?? "" },
      email: contact.email,
      name: contact.name ?? "",
      unsubscribe_url: unsubscribeUrl(contact.id),
    },
    email: contact.email,
    position: contact.position,
  }));
  const created = await db.transaction(async (tx) => {
    const [broadcast] = await tx
      .insert(broadcasts)
      .values({
        apiKeyId: input.principal.apiKeyId,
        createdByUserId: actorUserId,
        environment: input.principal.environment,
        from: definition.from,
        name: definition.name,
        orgId: input.principal.orgId,
        scheduledFor: definition.scheduledFor,
        sourceAudienceId: definition.audienceId,
        sourceTemplateId: template.id,
        templateHtml: templateBodies.html,
        templateName: template.name,
        templateRequiredVariables: template.requiredVariables,
        templateSubject: template.subject,
        templateText: templateBodies.text,
        ...(definition.scheduledFor ? { status: "scheduled" as const } : {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: broadcasts.id });

    if (!broadcast) {
      throw new Error("Broadcast insert returned no row.");
    }

    for (let offset = 0; offset < recipients.length; offset += 1_000) {
      await tx.insert(broadcastRecipients).values(
        recipients.slice(offset, offset + 1_000).map((recipient) => ({
          broadcastId: broadcast.id,
          contactId: recipient.contactId,
          data: recipient.data,
          email: recipient.email,
          position: recipient.position,
        })),
      );
    }

    return broadcast;
  });

  if (!definition.scheduledFor && dependencies.queue) {
    await processBroadcast(
      { broadcastId: created.id, orgId: input.principal.orgId },
      dependencies,
    );
  } else {
    requestBroadcastJob({
      broadcastId: created.id,
      orgId: input.principal.orgId,
      runAt: definition.scheduledFor ?? now,
    });
  }

  return recordFromRow(
    await readBroadcastRow({
      broadcastId: created.id,
      orgId: input.principal.orgId,
    }),
  );
}

export async function updateScheduledBroadcast(
  input: {
    actorUserId: string | null;
    broadcastId: string;
    orgId: string;
    payload: unknown;
  },
  dependencies: Pick<ProcessBroadcastDependencies, "now" | "unsubscribeUrl"> = {},
): Promise<BroadcastRecord> {
  requireBroadcastId(input.broadcastId);
  const actorUserId = await requireOrganizationPermission({
    ...input,
    permission: "broadcasts.control",
  });
  const definition = parseUpdateBroadcastInput(input.payload);
  const now = dependencies.now?.() ?? new Date();
  if (definition.scheduledFor && definition.scheduledFor <= now) {
    throw new BroadcastError("VALIDATION_ERROR", [
      {
        field: "scheduled_for",
        message: "Schedule broadcasts in the future.",
      },
    ]);
  }

  const current = await readBroadcastRow(input);
  if (current.status !== "scheduled" || !current.scheduledFor) {
    throw new BroadcastError("INVALID_TRANSITION");
  }

  const [template, audience] = await Promise.all([
    definition.templateId
      ? getTemplate({
          actorUserId,
          orgId: input.orgId,
          templateId: definition.templateId,
        })
      : null,
    definition.audienceId
      ? getActiveAudienceContacts({
          audienceId: definition.audienceId,
          orgId: input.orgId,
        })
      : null,
  ]);
  if (audience && audience.length === 0) throw new AudienceError("AUDIENCE_EMPTY");
  if (template) requirePublishedTemplate(template);

  const unsubscribeUrl =
    dependencies.unsubscribeUrl ??
    ((contactId: string) => createUnsubscribeUrl({ contactId }));
  const recipients = audience?.map((contact) => ({
    contactId: contact.id,
    data: {
      contact: { email: contact.email, name: contact.name ?? "" },
      email: contact.email,
      name: contact.name ?? "",
      unsubscribe_url: unsubscribeUrl(contact.id),
    },
    email: contact.email,
    position: contact.position,
  }));
  const templateBodies = template
    ? withUnsubscribeFooter({ html: template.html, text: template.text })
    : null;

  const runAt = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ scheduledFor: broadcasts.scheduledFor, status: broadcasts.status })
      .from(broadcasts)
      .where(
        and(
          eq(broadcasts.id, input.broadcastId),
          eq(broadcasts.orgId, input.orgId),
        ),
      )
      .for("update");
    if (!locked) throw new BroadcastError("BROADCAST_NOT_FOUND");
    if (locked.status !== "scheduled" || !locked.scheduledFor) {
      throw new BroadcastError("INVALID_TRANSITION");
    }

    await tx
      .update(broadcasts)
      .set({
        ...(definition.audienceId
          ? { sourceAudienceId: definition.audienceId }
          : {}),
        ...(definition.from ? { from: definition.from } : {}),
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.scheduledFor
          ? { scheduledFor: definition.scheduledFor }
          : {}),
        ...(template && templateBodies
          ? {
              sourceTemplateId: template.id,
              templateHtml: templateBodies.html,
              templateName: template.name,
              templateRequiredVariables: template.requiredVariables,
              templateSubject: template.subject,
              templateText: templateBodies.text,
            }
          : {}),
        ...(definition.subject ? { templateSubject: definition.subject } : {}),
        ...(definition.html !== undefined
          ? {
              templateHtml: withUnsubscribeFooter({
                html: definition.html,
                text: templateBodies?.text ?? current.templateText,
              }).html,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(broadcasts.id, input.broadcastId));

    if (recipients) {
      await tx
        .delete(broadcastRecipients)
        .where(eq(broadcastRecipients.broadcastId, input.broadcastId));
      for (let offset = 0; offset < recipients.length; offset += 1_000) {
        await tx.insert(broadcastRecipients).values(
          recipients.slice(offset, offset + 1_000).map((recipient) => ({
            broadcastId: input.broadcastId,
            contactId: recipient.contactId,
            data: recipient.data,
            email: recipient.email,
            position: recipient.position,
          })),
        );
      }
    }

    return definition.scheduledFor ?? locked.scheduledFor;
  });

  requestBroadcastJob({
    broadcastId: input.broadcastId,
    orgId: input.orgId,
    runAt,
  });

  return recordFromRow(await readBroadcastRow(input));
}

export async function processBroadcastJob(
  input: { broadcastId: string; orgId: string },
  dependencies: ProcessBroadcastDependencies = {},
): Promise<boolean> {
  requireBroadcastId(input.broadcastId);
  const now = dependencies.now?.() ?? new Date();
  const runnable = await db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select({
        id: broadcasts.id,
        orgId: broadcasts.orgId,
        scheduledFor: broadcasts.scheduledFor,
        status: broadcasts.status,
      })
      .from(broadcasts)
      .where(
        and(
          eq(broadcasts.id, input.broadcastId),
          eq(broadcasts.orgId, input.orgId),
        ),
      )
      .for("update");

    if (!broadcast) {
      return null;
    }

    if (broadcast.status === "running") {
      return { id: broadcast.id, orgId: broadcast.orgId };
    }

    if (
      broadcast.status !== "scheduled" ||
      !broadcast.scheduledFor ||
      broadcast.scheduledFor > now
    ) {
      return null;
    }

    const [updated] = await tx
      .update(broadcasts)
      .set({ status: "running", updatedAt: now })
      .where(
        and(
          eq(broadcasts.id, broadcast.id),
          eq(broadcasts.status, "scheduled"),
        ),
      )
      .returning({ id: broadcasts.id, orgId: broadcasts.orgId });
    return updated ?? null;
  });

  if (!runnable) return false;
  await processBroadcast(
    { broadcastId: runnable.id, orgId: runnable.orgId },
    dependencies,
  );
  return true;
}

export async function processNextScheduledBroadcast(
  dependencies: ProcessBroadcastDependencies = {},
): Promise<boolean> {
  const now = dependencies.now?.() ?? new Date();
  const claimed = await db.transaction(async (tx) => {
    const [due] = await tx
      .select({ id: broadcasts.id, orgId: broadcasts.orgId })
      .from(broadcasts)
      .where(
        and(
          eq(broadcasts.status, "scheduled"),
          lte(broadcasts.scheduledFor, now),
        ),
      )
      .orderBy(asc(broadcasts.scheduledFor), asc(broadcasts.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!due) return null;
    const [updated] = await tx
      .update(broadcasts)
      .set({ status: "running", updatedAt: now })
      .where(and(eq(broadcasts.id, due.id), eq(broadcasts.status, "scheduled")))
      .returning({ id: broadcasts.id, orgId: broadcasts.orgId });
    return updated ?? null;
  });

  if (!claimed) return false;
  await processBroadcast(
    { broadcastId: claimed.id, orgId: claimed.orgId },
    dependencies,
  );
  return true;
}

export async function listBroadcasts(input: {
  actorUserId: string | null;
  orgId: string;
}): Promise<BroadcastRecord[]> {
  await requireOrganizationPermission({ ...input, permission: "broadcasts.read" });
  const rows = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.orgId, input.orgId))
    .orderBy(desc(broadcasts.createdAt), desc(broadcasts.id));

  const progressById = await broadcastProgress(rows.map((row) => row.id));
  return Promise.all(
    rows.map((row) => recordFromRow(row, progressById.get(row.id) ?? emptyProgress())),
  );
}

export async function getBroadcast(input: {
  actorUserId: string | null;
  broadcastId: string;
  orgId: string;
}): Promise<BroadcastRecord> {
  await requireOrganizationPermission({ ...input, permission: "broadcasts.read" });
  return recordFromRow(await readBroadcastRow(input));
}

async function setBroadcastStatus(input: {
  actorUserId: string | null;
  broadcastId: string;
  orgId: string;
  target: "paused" | "running" | "cancelled";
  now?: () => Date;
}): Promise<void> {
  requireBroadcastId(input.broadcastId);
  await requireOrganizationPermission({
    ...input,
    permission: "broadcasts.control",
  });
  const now = input.now?.() ?? new Date();

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: broadcasts.status })
      .from(broadcasts)
      .where(
        and(
          eq(broadcasts.id, input.broadcastId),
          eq(broadcasts.orgId, input.orgId),
        ),
      )
      .for("update");

    if (!current) {
      throw new BroadcastError("BROADCAST_NOT_FOUND");
    }

    if (current.status === input.target) {
      return;
    }

    if (input.target === "running" && current.status === "completed") {
      return;
    }

    const allowed =
      (input.target === "paused" && current.status === "running") ||
      (input.target === "running" && current.status === "paused") ||
      (input.target === "cancelled" &&
        (current.status === "scheduled" ||
          current.status === "running" ||
          current.status === "paused"));

    if (!allowed) {
      throw new BroadcastError("INVALID_TRANSITION");
    }

    await tx
      .update(broadcasts)
      .set({
        cancelledAt: input.target === "cancelled" ? now : null,
        pausedAt: input.target === "paused" ? now : null,
        status: input.target,
        updatedAt: now,
      })
      .where(eq(broadcasts.id, input.broadcastId));

    if (input.target === "cancelled") {
      await tx
        .update(broadcastRecipients)
        .set({ processedAt: now, status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(broadcastRecipients.broadcastId, input.broadcastId),
            eq(broadcastRecipients.status, "pending"),
          ),
        );
    }
  });

  if (input.target === "running") {
    requestBroadcastJob({
      broadcastId: input.broadcastId,
      orgId: input.orgId,
      runAt: now,
    });
  }
}

export async function pauseBroadcast(input: {
  actorUserId: string | null;
  broadcastId: string;
  orgId: string;
}): Promise<BroadcastRecord> {
  await setBroadcastStatus({ ...input, target: "paused" });
  return getBroadcast(input);
}

export async function resumeBroadcast(
  input: {
    actorUserId: string | null;
    broadcastId: string;
    orgId: string;
  },
  dependencies: ProcessBroadcastDependencies = {},
): Promise<BroadcastRecord> {
  await setBroadcastStatus({ ...input, target: "running", now: dependencies.now });
  if (dependencies.queue) {
    await processBroadcast(input, dependencies);
  }
  return getBroadcast(input);
}

export async function cancelBroadcast(input: {
  actorUserId: string | null;
  broadcastId: string;
  orgId: string;
}): Promise<BroadcastRecord> {
  await setBroadcastStatus({ ...input, target: "cancelled" });
  return getBroadcast(input);
}

export async function deleteBroadcast(input: {
  actorUserId: string | null;
  broadcastId: string;
  orgId: string;
}): Promise<void> {
  requireBroadcastId(input.broadcastId);
  await requireOrganizationPermission({
    actorUserId: input.actorUserId,
    orgId: input.orgId,
    permission: "broadcasts.control",
  });

  const current = await readBroadcastRow(input);

  if (current.status !== "scheduled") {
    throw new BroadcastError("INVALID_TRANSITION");
  }

  const deleted = await db
    .delete(broadcasts)
    .where(
      and(eq(broadcasts.id, input.broadcastId), eq(broadcasts.orgId, input.orgId)),
    )
    .returning({ id: broadcasts.id });

  if (deleted.length !== 1) {
    throw new BroadcastError("BROADCAST_NOT_FOUND");
  }
}

const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export async function sendBroadcast(
  input: {
    actorUserId: string | null;
    broadcastId: string;
    orgId: string;
    payload: unknown;
  },
  dependencies: Pick<ProcessBroadcastDependencies, "now"> = {},
): Promise<BroadcastRecord> {
  requireBroadcastId(input.broadcastId);
  await requireOrganizationPermission({
    actorUserId: input.actorUserId,
    orgId: input.orgId,
    permission: "broadcasts.control",
  });

  let scheduledAt: Date | null = null;

  if (
    input.payload !== undefined &&
    input.payload !== null &&
    (typeof input.payload !== "object" ||
      Array.isArray(input.payload) ||
      Object.keys(input.payload).some((field) => field !== "scheduled_at"))
  ) {
    throw new BroadcastError("VALIDATION_ERROR", [
      { field: "body", message: "Only scheduled_at is supported." },
    ]);
  }

  const raw =
    input.payload &&
    typeof input.payload === "object" &&
    !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)["scheduled_at"]
      : undefined;

  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "string" || !RFC3339_PATTERN.test(raw)) {
      throw new BroadcastError("VALIDATION_ERROR", [
        {
          field: "scheduled_at",
          message: "Use an RFC 3339 timestamp with an explicit UTC offset.",
        },
      ]);
    }

    scheduledAt = new Date(raw);

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BroadcastError("VALIDATION_ERROR", [
        {
          field: "scheduled_at",
          message: "Use an RFC 3339 timestamp with an explicit UTC offset.",
        },
      ]);
    }
  }

  const now = dependencies.now?.() ?? new Date();

  if (scheduledAt && scheduledAt <= now) {
    throw new BroadcastError("VALIDATION_ERROR", [
      { field: "scheduled_at", message: "Schedule broadcasts in the future." },
    ]);
  }

  const current = await readBroadcastRow(input);

  if (current.status !== "scheduled" && current.status !== "paused") {
    throw new BroadcastError("INVALID_TRANSITION");
  }

  await db
    .update(broadcasts)
    .set({
      pausedAt: null,
      scheduledFor: scheduledAt,
      status: scheduledAt ? "scheduled" : "running",
      updatedAt: now,
    })
    .where(
      and(eq(broadcasts.id, input.broadcastId), eq(broadcasts.orgId, input.orgId)),
    );

  requestBroadcastJob({
    broadcastId: input.broadcastId,
    orgId: input.orgId,
    runAt: scheduledAt ?? now,
  });

  return getBroadcast(input);
}

export const BROADCAST_RECIPIENT_EVENT_TYPES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "suppressed",
] as const;

export type BroadcastRecipientEventType =
  (typeof BROADCAST_RECIPIENT_EVENT_TYPES)[number];

export type BroadcastRecipientView = {
  bouncedAt: Date | null;
  clickedAt: Date | null;
  complainedAt: Date | null;
  contactId: string | null;
  deliveredAt: Date | null;
  email: string;
  messageId: string | null;
  openedAt: Date | null;
  position: number;
  sentAt: Date | null;
  status: BroadcastRecipientStatus;
  unsubscribed: boolean;
};

function recipientEventTypes(view: {
  events: Map<string, { createdAt: Date; data: Record<string, unknown> }>;
  messageId: string | null;
  status: BroadcastRecipientStatus;
  unsubscribed: boolean;
}): Set<BroadcastRecipientEventType> {
  const types = new Set<BroadcastRecipientEventType>();

  if (view.messageId || view.status === "queued" || view.status === "processing") {
    types.add("sent");
  }
  if (view.events.has("delivered")) types.add("delivered");
  if (view.events.has("opened")) types.add("opened");
  if (view.events.has("clicked")) types.add("clicked");
  if (view.events.has("bounced")) types.add("bounced");
  if (view.events.has("complained")) types.add("complained");
  if (view.unsubscribed) types.add("unsubscribed");
  if (view.status === "suppressed") types.add("suppressed");

  return types;
}

export async function listBroadcastRecipients(input: {
  actorUserId: string | null;
  bounceType?: string | null;
  broadcastId: string;
  email?: string | null;
  limit?: number;
  orgId: string;
  type?: string | null;
}): Promise<BroadcastRecipientView[]> {
  requireBroadcastId(input.broadcastId);
  await requireOrganizationPermission({
    actorUserId: input.actorUserId,
    orgId: input.orgId,
    permission: "broadcasts.read",
  });
  await readBroadcastRow({ broadcastId: input.broadcastId, orgId: input.orgId });

  const eventType =
    input.type !== undefined && input.type !== null
      ? (BROADCAST_RECIPIENT_EVENT_TYPES as readonly string[]).includes(input.type)
        ? (input.type as BroadcastRecipientEventType)
        : null
      : undefined;

  if (input.type !== undefined && input.type !== null && !eventType) {
    throw new BroadcastError("VALIDATION_ERROR", [
      {
        field: "type",
        message: `Must be one of ${BROADCAST_RECIPIENT_EVENT_TYPES.join(", ")}.`,
      },
    ]);
  }

  const bounceType = (input.bounceType ?? "").trim().toLowerCase();
  if (bounceType && !["permanent", "transient", "undetermined"].includes(bounceType)) {
    throw new BroadcastError("VALIDATION_ERROR", [
      {
        field: "bounce_type",
        message: "Must be permanent, transient, or undetermined.",
      },
    ]);
  }
  if (bounceType && eventType && eventType !== "bounced") {
    throw new BroadcastError("VALIDATION_ERROR", [
      { field: "bounce_type", message: "Only applies when type is bounced." },
    ]);
  }

  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));
  const rows = await db
    .select({
      contactId: broadcastRecipients.contactId,
      email: broadcastRecipients.email,
      messageId: broadcastRecipients.messageId,
      position: broadcastRecipients.position,
      processedAt: broadcastRecipients.processedAt,
      status: broadcastRecipients.status,
    })
    .from(broadcastRecipients)
    .where(
      and(
        eq(broadcastRecipients.broadcastId, input.broadcastId),
        ...(input.email ? [ilike(broadcastRecipients.email, `%${input.email}%`)] : []),
      ),
    )
    .orderBy(asc(broadcastRecipients.position))
    .limit(eventType ? 1000 : limit);

  const messageIds = [...new Set(rows.map((row) => row.messageId).filter((id) => id !== null))] as string[];
  const eventRows =
    messageIds.length > 0
      ? await db
          .select({
            createdAt: events.createdAt,
            data: events.data,
            messageId: events.messageId,
            type: events.type,
          })
          .from(events)
          .where(inArray(events.messageId, messageIds))
      : [];

  const eventsByMessage = new Map<string, Map<string, { createdAt: Date; data: Record<string, unknown> }>>();
  for (const event of eventRows) {
    if (!eventsByMessage.has(event.messageId)) {
      eventsByMessage.set(event.messageId, new Map());
    }
    eventsByMessage.get(event.messageId)?.set(event.type, {
      createdAt: event.createdAt,
      data: event.data,
    });
  }

  const emails = [...new Set(rows.map((row) => row.email))];
  const suppressionRows =
    emails.length > 0
      ? await db
          .select({ email: emailSuppressions.email })
          .from(emailSuppressions)
          .where(
            and(
              eq(emailSuppressions.orgId, input.orgId),
              eq(emailSuppressions.reason, "unsubscribed"),
              inArray(emailSuppressions.email, emails),
            ),
          )
      : [];
  const unsubscribedEmails = new Set(suppressionRows.map((row) => row.email));

  const views = rows.map((row): BroadcastRecipientView & { types: Set<BroadcastRecipientEventType> } => {
    const messageEvents = row.messageId
      ? (eventsByMessage.get(row.messageId) ?? new Map())
      : new Map<string, { createdAt: Date; data: Record<string, unknown> }>();
    const unsubscribed = unsubscribedEmails.has(row.email);
    const view = {
      bouncedAt: messageEvents.get("bounced")?.createdAt ?? null,
      clickedAt: messageEvents.get("clicked")?.createdAt ?? null,
      complainedAt: messageEvents.get("complained")?.createdAt ?? null,
      contactId: row.contactId,
      deliveredAt: messageEvents.get("delivered")?.createdAt ?? null,
      email: row.email,
      messageId: row.messageId,
      openedAt: messageEvents.get("opened")?.createdAt ?? null,
      position: row.position,
      sentAt: row.processedAt,
      status: row.status,
      unsubscribed,
    };

    return {
      ...view,
      types: recipientEventTypes({
        events: messageEvents,
        messageId: row.messageId,
        status: row.status,
        unsubscribed,
      }),
    };
  });

  const filtered = views.filter((view) => {
    if (eventType && !view.types.has(eventType)) return false;
    if (bounceType) {
      const data = view.messageId
        ? (eventsByMessage.get(view.messageId)?.get("bounced")?.data ?? null)
        : null;
      const actual = String(
        (data as Record<string, unknown> | null)?.["bounce_type"] ?? "",
      ).toLowerCase();
      const normalized =
        actual === "permanent" ? "permanent" : actual === "transient" ? "transient" : "undetermined";
      if (normalized !== bounceType) return false;
    }
    return true;
  });

  return filtered.slice(0, limit).map(({ types: _types, ...view }) => view);
}

function extractLinks(html: string | null, text: string | null): string[] {
  const links = new Set<string>();

  if (html) {
    for (const match of html.matchAll(/href\s*=\s*"(https?:[^"]+)"/gi)) {
      links.add(match[1]);
    }
    for (const match of html.matchAll(/href\s*=\s*'(https?:[^']+)'/gi)) {
      links.add(match[1]);
    }
  }

  if (text) {
    for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
      links.add(match[0].replace(/[.,;!?]+$/, ""));
    }
  }

  return [...links];
}

export type BroadcastClickedLink = {
  clickCount: number;
  uniqueClicks: number;
  url: string;
};

export async function listBroadcastClickedLinks(input: {
  actorUserId: string | null;
  broadcastId: string;
  limit?: number;
  orgId: string;
}): Promise<BroadcastClickedLink[]> {
  requireBroadcastId(input.broadcastId);
  await requireOrganizationPermission({
    actorUserId: input.actorUserId,
    orgId: input.orgId,
    permission: "broadcasts.read",
  });
  const broadcast = await readBroadcastRow({
    broadcastId: input.broadcastId,
    orgId: input.orgId,
  });

  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));
  const links = extractLinks(broadcast.templateHtml, broadcast.templateText).slice(0, limit);

  if (links.length === 0) {
    return [];
  }

  const recipientRows = await db
    .select({ messageId: broadcastRecipients.messageId })
    .from(broadcastRecipients)
    .where(eq(broadcastRecipients.broadcastId, input.broadcastId));

  const messageIds = [...new Set(recipientRows.map((row) => row.messageId).filter((id) => id !== null))] as string[];

  if (messageIds.length === 0) {
    return links.map((url) => ({ clickCount: 0, uniqueClicks: 0, url }));
  }

  const clickRows = await db
    .select({ data: events.data, messageId: events.messageId })
    .from(events)
    .where(and(inArray(events.messageId, messageIds), eq(events.type, "clicked")));

  const counts = new Map<string, Set<string>>();
  for (const row of clickRows) {
    const url = String((row.data as Record<string, unknown>)?.["url"] ?? "");
    if (!url) continue;
    if (!counts.has(url)) counts.set(url, new Set());
    counts.get(url)?.add(row.messageId);
  }

  return links.map((url) => {
    const messages = counts.get(url);
    const count = messages?.size ?? 0;
    return { clickCount: count, uniqueClicks: count, url };
  });
}
