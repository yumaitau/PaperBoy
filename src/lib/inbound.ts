import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attachmentStorageKey,
  attachmentStore as configuredAttachmentStore,
} from "@/lib/attachment-storage";
import {
  orgs,
  receivedEmailAttachments,
  receivedEmails,
  webhookDeliveries,
  webhookEndpoints,
} from "@/db/schema";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { DomainError } from "@/lib/domain-core";
import { authorizeSendingDomain } from "@/lib/domains";
import { MessageStatusError } from "@/lib/message-status-core";
import {
  inboundRecipientDomains,
  inboundSinkholeReasonFromPayload,
  parseInboundEmailInput,
  type DiscardedInboundEmail,
} from "@/lib/inbound-core";
import { enqueuePendingWebhook } from "@/lib/job-queue";
import { isPostgresErrorCode } from "@/lib/postgres-errors";
import { receivedEmailWebhookBody } from "@/lib/webhook-core";

export type ReceivedEmailRecord = {
  bcc: string[];
  cc: string[];
  createdAt: Date;
  environment: "live" | "test";
  from: string;
  html: string | null;
  id: string;
  messageId: string | null;
  replayed: boolean;
  subject: string;
  text: string | null;
  to: string[];
};

export type { DiscardedInboundEmail };

function isUniqueViolation(error: unknown): boolean {
  return isPostgresErrorCode(error, "23505");
}

function recordFromRow(
  row: typeof receivedEmails.$inferSelect,
  replayed = false,
): ReceivedEmailRecord {
  return {
    bcc: row.bcc,
    cc: row.cc,
    createdAt: row.createdAt,
    environment: row.environment === "live" ? "live" : "test",
    from: row.from,
    html: row.html,
    id: row.id,
    messageId: row.rfc822MessageId,
    replayed,
    subject: row.subject,
    text: row.textBody,
    to: row.to,
  };
}

async function findExistingReceivedEmail(input: {
  contentSha256: string;
  orgId: string;
  rfc822MessageId: string | null;
}) {
  const [byHash] = await db
    .select()
    .from(receivedEmails)
    .where(
      and(
        eq(receivedEmails.orgId, input.orgId),
        eq(receivedEmails.contentSha256, input.contentSha256),
      ),
    )
    .limit(1);
  if (byHash) return byHash;

  if (!input.rfc822MessageId) return null;

  const [byMessageId] = await db
    .select()
    .from(receivedEmails)
    .where(
      and(
        eq(receivedEmails.orgId, input.orgId),
        eq(receivedEmails.rfc822MessageId, input.rfc822MessageId),
      ),
    )
    .limit(1);
  return byMessageId ?? null;
}

async function authorizeInboundRecipient(input: {
  environment: ApiKeyPrincipal["environment"];
  orgId: string;
  to: string[];
}) {
  const domains = inboundRecipientDomains(input.to);
  if (domains.length === 0) {
    throw new DomainError("INVALID_DOMAIN");
  }

  let lastError: unknown = new DomainError("DOMAIN_NOT_VERIFIED");
  for (const domain of domains) {
    try {
      return await authorizeSendingDomain({
        environment: input.environment,
        fromDomain: domain,
        orgId: input.orgId,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function enqueueReceivedEmailWebhook(input: {
  email: ReceivedEmailRecord;
  orgId: string;
}) {
  const endpoints = await db
    .select({
      encryptedSecret: webhookEndpoints.encryptedSecret,
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
    })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.orgId, input.orgId),
        eq(webhookEndpoints.enabled, true),
      ),
    );

  if (endpoints.length === 0) return;

  const created = await db
    .insert(webhookDeliveries)
    .values(
      endpoints.map((endpoint) => ({
        body: receivedEmailWebhookBody({
          createdAt: input.email.createdAt,
          environment: input.email.environment,
          from: input.email.from,
          messageId: input.email.messageId,
          receivedEmailId: input.email.id,
          subject: input.email.subject,
          to: input.email.to,
        }),
        createdAt: input.email.createdAt,
        encryptedSecret: endpoint.encryptedSecret,
        endpointId: endpoint.id,
        nextAttemptAt: input.email.createdAt,
        orgId: input.orgId,
        receivedEmailId: input.email.id,
        updatedAt: input.email.createdAt,
        url: endpoint.url,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: webhookDeliveries.id });

  for (const delivery of created) {
    void enqueuePendingWebhook(delivery.id).catch(() => {
      console.error(
        `PaperBoy could not dispatch inbound webhook ${delivery.id}; BullMQ reconciliation will retry it.`,
      );
    });
  }
}

export async function findLiveOrgForInboundRecipients(
  to: string[],
): Promise<string | null> {
  const organizations = await db.select({ id: orgs.id }).from(orgs);
  const matches: string[] = [];

  for (const organization of organizations) {
    try {
      await authorizeInboundRecipient({
        environment: "live",
        orgId: organization.id,
        to,
      });
      matches.push(organization.id);
    } catch {
      continue;
    }

    if (matches.length > 1) {
      return null;
    }
  }

  return matches[0] ?? null;
}

export async function receiveInboundEmail(input: {
  payload: unknown;
  principal: Pick<ApiKeyPrincipal, "environment" | "orgId"> & {
    apiKeyId?: string | null;
  };
}): Promise<ReceivedEmailRecord | DiscardedInboundEmail> {
  const discarded = inboundSinkholeReasonFromPayload(input.payload);
  if (discarded) {
    return { discarded: true, reason: discarded };
  }

  const email = await parseInboundEmailInput(input.payload);
  const domain = await authorizeInboundRecipient({
    environment: input.principal.environment,
    orgId: input.principal.orgId,
    to: email.to,
  });

  try {
    const created = await db.transaction(async (tx) => {
      await tx
        .select({ id: orgs.id })
        .from(orgs)
        .where(eq(orgs.id, input.principal.orgId))
        .for("share");

      const [inserted] = await tx
        .insert(receivedEmails)
        .values({
          apiKeyId: input.principal.apiKeyId ?? null,
          domainId: domain.domainId,
          environment: input.principal.environment,
          from: email.from,
          html: email.html,
          orgId: input.principal.orgId,
          rfc822MessageId: email.rfc822MessageId,
          contentSha256: email.contentSha256,
          subject: email.subject,
          textBody: email.text,
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
        })
        .returning();

      if (!inserted) {
        throw new Error("Inbound email insert returned no row.");
      }

      const storedKeys: string[] = [];
      try {
        for (const [position, attachment] of email.attachments.entries()) {
          const attachmentId = randomUUID();
          const storageKey = attachmentStorageKey({
            attachmentId,
            messageId: inserted.id,
            orgId: input.principal.orgId,
          });

          await configuredAttachmentStore.put({
            content: attachment.content,
            storageKey,
          });
          storedKeys.push(storageKey);

          await tx.insert(receivedEmailAttachments).values({
            byteSize: attachment.size,
            contentId: attachment.contentId,
            contentSha256: attachment.contentSha256,
            contentType: attachment.contentType,
            filename: attachment.filename,
            id: attachmentId,
            position,
            receivedEmailId: inserted.id,
            storageKey,
          });
        }
      } catch (error) {
        await Promise.allSettled(
          storedKeys.map((storageKey) =>
            configuredAttachmentStore.delete(storageKey),
          ),
        );
        throw error;
      }

      return recordFromRow(inserted);
    });

    await enqueueReceivedEmailWebhook({
      email: created,
      orgId: input.principal.orgId,
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findExistingReceivedEmail({
        contentSha256: email.contentSha256,
        orgId: input.principal.orgId,
        rfc822MessageId: email.rfc822MessageId,
      });
      if (existing) return recordFromRow(existing, true);
    }
    throw error;
  }
}

export async function getReceivedEmail(input: {
  orgId: string;
  receivedEmailId: string;
  environment: "live" | "test";
}): Promise<ReceivedEmailRecord> {
  const [row] = await db
    .select()
    .from(receivedEmails)
    .where(
      and(
        eq(receivedEmails.id, input.receivedEmailId),
        eq(receivedEmails.orgId, input.orgId),
        eq(receivedEmails.environment, input.environment),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  return recordFromRow(row);
}

export { inboundEmailApiBody } from "@/lib/inbound-core";
export type { InboundEmailInput } from "@/lib/inbound-core";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReceivedEmailAttachmentRecord = {
  byteSize: number;
  contentId: string | null;
  contentType: string;
  createdAt: Date;
  filename: string;
  id: string;
  receivedEmailId: string;
};

const RECEIVED_ATTACHMENT_SELECTION = {
  byteSize: receivedEmailAttachments.byteSize,
  contentId: receivedEmailAttachments.contentId,
  contentType: receivedEmailAttachments.contentType,
  createdAt: receivedEmailAttachments.createdAt,
  filename: receivedEmailAttachments.filename,
  id: receivedEmailAttachments.id,
  receivedEmailId: receivedEmailAttachments.receivedEmailId,
};

async function requireReceivedEmail(input: {
  environment: "live" | "test";
  orgId: string;
  receivedEmailId: string;
}): Promise<{ id: string }> {
  if (!UUID_PATTERN.test(input.receivedEmailId)) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select({ id: receivedEmails.id })
    .from(receivedEmails)
    .where(
      and(
        eq(receivedEmails.id, input.receivedEmailId),
        eq(receivedEmails.orgId, input.orgId),
        eq(receivedEmails.environment, input.environment),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  return row;
}

export async function listReceivedEmailAttachments(input: {
  environment: "live" | "test";
  orgId: string;
  receivedEmailId: string;
}): Promise<ReceivedEmailAttachmentRecord[]> {
  const email = await requireReceivedEmail(input);

  return db
    .select(RECEIVED_ATTACHMENT_SELECTION)
    .from(receivedEmailAttachments)
    .where(eq(receivedEmailAttachments.receivedEmailId, email.id))
    .orderBy(asc(receivedEmailAttachments.position));
}

export async function getReceivedEmailAttachment(input: {
  attachmentId: string;
  environment: "live" | "test";
  orgId: string;
  receivedEmailId: string;
}): Promise<ReceivedEmailAttachmentRecord> {
  const email = await requireReceivedEmail(input);

  if (!UUID_PATTERN.test(input.attachmentId)) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select(RECEIVED_ATTACHMENT_SELECTION)
    .from(receivedEmailAttachments)
    .where(
      and(
        eq(receivedEmailAttachments.id, input.attachmentId),
        eq(receivedEmailAttachments.receivedEmailId, email.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  return row;
}
