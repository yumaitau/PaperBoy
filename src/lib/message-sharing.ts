import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attachmentStore as configuredAttachmentStore,
  type AttachmentStore,
} from "@/lib/attachment-storage";
import {
  isOrgRole,
  requirePermission,
} from "@/lib/authorization";
import { EmailError } from "@/lib/email-core";
import {
  messageAttachments,
  messages,
  orgMembers,
  receivedEmailAttachments,
  receivedEmails,
} from "@/db/schema";
import { MessageStatusError } from "@/lib/message-status-core";
import {
  createShareToken,
  parseShareExpiry,
  ShareConfigurationError,
  verifyShareToken,
} from "@/lib/share-links";

export { ShareConfigurationError };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SharedEmailRecord = {
  expiresAt: Date;
  from: string;
  html: string | null;
  id: string;
  subject: string;
  text: string | null;
  to: string[];
};

export type MessageAttachmentRecord = {
  byteSize: number;
  contentId: string | null;
  contentType: string;
  createdAt: Date;
  filename: string;
  id: string;
  messageId: string;
};

async function requireSharePermission(input: {
  actorUserId: string | null;
  orgId: string;
}): Promise<void> {
  if (!input.actorUserId) {
    throw new MessageStatusError("MEMBERSHIP_REQUIRED");
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
    throw new MessageStatusError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, "emails.share");
}

async function requireMessageInOrg(input: {
  actorUserId: string | null;
  messageId: string;
  orgId: string;
  permission: "emails.share" | "messages.read";
}): Promise<{ environment: "live" | "test"; id: string }> {
  if (!input.actorUserId) {
    throw new MessageStatusError("MEMBERSHIP_REQUIRED");
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
    throw new MessageStatusError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, input.permission);

  if (!UUID_PATTERN.test(input.messageId)) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select({ environment: messages.environment, id: messages.id })
    .from(messages)
    .where(
      and(eq(messages.id, input.messageId), eq(messages.orgId, input.orgId)),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  return { environment: row.environment === "live" ? "live" : "test", id: row.id };
}

function publicBaseUrl(baseUrl?: string): string {
  const raw =
    baseUrl ?? process.env.PAPERBOY_PUBLIC_URL ?? process.env.BETTER_AUTH_URL;
  if (!raw) throw new ShareConfigurationError();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ShareConfigurationError();
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ShareConfigurationError();
  }
  return url.toString().replace(/\/$/, "");
}

export async function shareEmail(input: {
  actorUserId: string | null;
  baseUrl?: string;
  expiresIn?: unknown;
  messageId: string;
  now?: Date;
  orgId: string;
}): Promise<{ expiresAt: Date; id: string; url: string }> {
  await requireSharePermission({ actorUserId: input.actorUserId, orgId: input.orgId });
  const message = await requireMessageInOrg({
    actorUserId: input.actorUserId,
    messageId: input.messageId,
    orgId: input.orgId,
    permission: "emails.share",
  });

  const expiresInSeconds = parseShareExpiry(input.expiresIn);

  if (expiresInSeconds === null) {
    throw new EmailError("VALIDATION_ERROR", [
      {
        field: "expires_in",
        message: "Use a duration like 10m, 2 hours, or 1 day, up to 48 hours.",
      },
    ]);
  }

  const now = input.now ?? new Date();
  const token = createShareToken({
    expiresInSeconds,
    now,
    subject: { messageId: message.id },
  });

  return {
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
    id: message.id,
    url: `${publicBaseUrl(input.baseUrl)}/share/${token}`,
  };
}

export async function getSharedEmail(input: {
  now?: Date;
  token: string;
}): Promise<SharedEmailRecord> {
  const verified = verifyShareToken({ now: input.now, token: input.token });

  if (!verified || "attachmentId" in verified) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select({
      from: messages.from,
      html: messages.html,
      id: messages.id,
      subject: messages.subject,
      textBody: messages.textBody,
      to: messages.to,
    })
    .from(messages)
    .where(eq(messages.id, verified.messageId))
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  return {
    expiresAt: verified.expiresAt,
    from: row.from,
    html: row.html,
    id: row.id,
    subject: row.subject,
    text: row.textBody,
    to: Array.isArray(row.to) ? row.to.map(String) : [],
  };
}

const attachmentSelection = {
  byteSize: messageAttachments.byteSize,
  contentId: messageAttachments.contentId,
  contentType: messageAttachments.contentType,
  createdAt: messageAttachments.createdAt,
  filename: messageAttachments.filename,
  id: messageAttachments.id,
  messageId: messageAttachments.messageId,
};

export async function listMessageAttachments(input: {
  actorUserId: string | null;
  messageId: string;
  orgId: string;
}): Promise<MessageAttachmentRecord[]> {
  const message = await requireMessageInOrg({
    actorUserId: input.actorUserId,
    messageId: input.messageId,
    orgId: input.orgId,
    permission: "messages.read",
  });

  return db
    .select(attachmentSelection)
    .from(messageAttachments)
    .where(eq(messageAttachments.messageId, message.id))
    .orderBy(asc(messageAttachments.position));
}

export async function getMessageAttachment(input: {
  actorUserId: string | null;
  attachmentId: string;
  messageId: string;
  orgId: string;
}): Promise<MessageAttachmentRecord> {
  const message = await requireMessageInOrg({
    actorUserId: input.actorUserId,
    messageId: input.messageId,
    orgId: input.orgId,
    permission: "messages.read",
  });

  if (!UUID_PATTERN.test(input.attachmentId)) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select(attachmentSelection)
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.id, input.attachmentId),
        eq(messageAttachments.messageId, message.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  return row;
}

export async function attachmentDownloadUrl(input: {
  actorUserId: string | null;
  attachmentId: string;
  baseUrl?: string;
  messageId: string;
  now?: Date;
  orgId: string;
}): Promise<{ expiresAt: Date; url: string }> {
  const message = await requireMessageInOrg({
    actorUserId: input.actorUserId,
    messageId: input.messageId,
    orgId: input.orgId,
    permission: "messages.read",
  });

  if (!UUID_PATTERN.test(input.attachmentId)) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select({ id: messageAttachments.id })
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.id, input.attachmentId),
        eq(messageAttachments.messageId, message.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const now = input.now ?? new Date();
  const ttl = 60 * 60;
  const token = createShareToken({
    expiresInSeconds: ttl,
    now,
    subject: { attachmentId: row.id, messageId: message.id },
  });

  return {
    expiresAt: new Date(now.getTime() + ttl * 1000),
    url: `${publicBaseUrl(input.baseUrl)}/api/v1/attachments/download?token=${token}`,
  };
}

export async function downloadSharedAttachment(input: {
  now?: Date;
  store?: AttachmentStore;
  token: string;
}): Promise<{ bytes: Buffer; contentType: string; filename: string }> {
  const verified = verifyShareToken({ now: input.now, token: input.token });

  if (!verified || !("attachmentId" in verified)) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const store = input.store ?? configuredAttachmentStore;

  if ("receivedEmailId" in verified) {
    const [row] = await db
      .select({
        contentType: receivedEmailAttachments.contentType,
        filename: receivedEmailAttachments.filename,
        storageKey: receivedEmailAttachments.storageKey,
      })
      .from(receivedEmailAttachments)
      .where(
        and(
          eq(receivedEmailAttachments.id, verified.attachmentId),
          eq(receivedEmailAttachments.receivedEmailId, verified.receivedEmailId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new MessageStatusError("MESSAGE_NOT_FOUND");
    }

    const bytes = await store.read(row.storageKey);
    return { bytes, contentType: row.contentType, filename: row.filename };
  }

  const [row] = await db
    .select({
      contentType: messageAttachments.contentType,
      filename: messageAttachments.filename,
      storageKey: messageAttachments.storageKey,
    })
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.id, verified.attachmentId),
        eq(messageAttachments.messageId, verified.messageId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const bytes = await store.read(row.storageKey);

  return { bytes, contentType: row.contentType, filename: row.filename };
}

export async function receivedAttachmentDownloadUrl(input: {
  attachmentId: string;
  baseUrl?: string;
  environment: "live" | "test";
  now?: Date;
  orgId: string;
  receivedEmailId: string;
}): Promise<{ expiresAt: Date; url: string }> {
  if (
    !UUID_PATTERN.test(input.receivedEmailId) ||
    !UUID_PATTERN.test(input.attachmentId)
  ) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const [row] = await db
    .select({ id: receivedEmailAttachments.id })
    .from(receivedEmailAttachments)
    .innerJoin(
      receivedEmails,
      eq(receivedEmails.id, receivedEmailAttachments.receivedEmailId),
    )
    .where(
      and(
        eq(receivedEmailAttachments.id, input.attachmentId),
        eq(receivedEmailAttachments.receivedEmailId, input.receivedEmailId),
        eq(receivedEmails.orgId, input.orgId),
        eq(receivedEmails.environment, input.environment),
      ),
    )
    .limit(1);

  if (!row) {
    throw new MessageStatusError("MESSAGE_NOT_FOUND");
  }

  const now = input.now ?? new Date();
  const ttl = 60 * 60;
  const token = createShareToken({
    expiresInSeconds: ttl,
    now,
    subject: {
      attachmentId: row.id,
      receivedEmailId: input.receivedEmailId,
    },
  });

  return {
    expiresAt: new Date(now.getTime() + ttl * 1000),
    url: `${publicBaseUrl(input.baseUrl)}/api/v1/attachments/download?token=${token}`,
  };
}
