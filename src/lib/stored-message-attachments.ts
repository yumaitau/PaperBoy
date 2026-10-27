import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messageAttachments } from "@/db/schema";
import {
  attachmentStore as configuredAttachmentStore,
  verifyStoredAttachment,
  type AttachmentStore,
} from "@/lib/attachment-storage";

export type LoadedMessageAttachment = {
  content: Buffer;
  contentId: string | null;
  contentSha256: string;
  contentType: string;
  filename: string;
  id: string;
  position: number;
  size: number;
};

/**
 * Read attachment rows in position order and verify each blob's stored size and
 * SHA-256 before returning bytes with filename, MIME type, and CID metadata.
 * Use the configured store unless one is injected; missing/corrupt storage errors
 * propagate. This internal loader does not authorize the message ID: callers must
 * establish tenant/role access or a trusted worker claim before invoking it.
 */
export async function loadMessageAttachments(input: {
  attachmentStore?: AttachmentStore;
  messageId: string;
}): Promise<LoadedMessageAttachment[]> {
  const attachmentStore = input.attachmentStore ?? configuredAttachmentStore;
  const rows = await db
    .select({
      contentId: messageAttachments.contentId,
      contentSha256: messageAttachments.contentSha256,
      contentType: messageAttachments.contentType,
      filename: messageAttachments.filename,
      id: messageAttachments.id,
      position: messageAttachments.position,
      size: messageAttachments.byteSize,
      storageKey: messageAttachments.storageKey,
    })
    .from(messageAttachments)
    .where(eq(messageAttachments.messageId, input.messageId))
    .orderBy(asc(messageAttachments.position));

  return Promise.all(
    rows.map(async (row) => {
      const content = await attachmentStore.read(row.storageKey);

      verifyStoredAttachment({
        content,
        contentSha256: row.contentSha256,
        size: row.size,
      });

      return {
        content,
        contentId: row.contentId,
        contentSha256: row.contentSha256,
        contentType: row.contentType,
        filename: row.filename,
        id: row.id,
        position: row.position,
        size: row.size,
      };
    }),
  );
}
