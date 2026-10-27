import MailComposer from "nodemailer/lib/mail-composer";
import { mimeContentIds, rewriteMimeCidReferences } from "@/lib/mime-content-ids";

export const CLOUDFLARE_EMAIL_MAX_BYTES = 5 * 1024 * 1024;

export type DeliveryAttachment = {
  content: Buffer;
  contentId?: string | null;
  contentType: string;
  filename: string;
};

export type DeliveryMessage = {
  attachments: DeliveryAttachment[];
  bcc?: string[];
  cc?: string[];
  from: string;
  headers?: Record<string, string>;
  html: string | null;
  replyTo?: string[];
  subject: string;
  text: string | null;
  to: string[];
};

export class DeliveryProviderError extends Error {
  constructor(readonly code: "MESSAGE_TOO_LARGE") {
    super(code);
    this.name = "DeliveryProviderError";
  }
}

type MimeMessage = DeliveryMessage & {
  date?: Date;
  extraHeaders?: Record<string, string>;
  messageId?: string;
};

export function buildSmtpMimeMessage(message: MimeMessage): Promise<Buffer> {
  return buildMimeMessage(message, false);
}

// For authorized owner downloads only; delivery must never include Bcc headers.
export function buildArchiveMimeMessage(message: MimeMessage): Promise<Buffer> {
  return buildMimeMessage(message, true);
}

async function buildMimeMessage(
  message: MimeMessage,
  keepBcc: boolean,
): Promise<Buffer> {
  const cc = message.cc ?? [];
  const bcc = message.bcc ?? [];
  const customHeaders = message.headers ?? {};
  const contentIds = mimeContentIds(
    message.attachments.map((attachment) => attachment.contentId),
  );
  const composer = new MailComposer({
    attachments: message.attachments.map((attachment) => ({
      ...(attachment.contentId
        ? {
            cid: contentIds.get(attachment.contentId) ?? attachment.contentId,
            contentDisposition: "inline" as const,
          }
        : { contentDisposition: "attachment" as const }),
      content: attachment.content,
      contentType: attachment.contentType,
      filename: attachment.filename,
    })),
    bcc: bcc.length > 0 ? bcc : undefined,
    cc: cc.length > 0 ? cc : undefined,
    date: message.date,
    disableFileAccess: true,
    disableUrlAccess: true,
    from: message.from,
    headers: { ...customHeaders, ...message.extraHeaders },
    html:
      message.html === null
        ? undefined
        : rewriteMimeCidReferences(message.html, contentIds),
    messageId: message.messageId,
    replyTo:
      message.replyTo && message.replyTo.length > 0
        ? message.replyTo
        : undefined,
    subject: message.subject,
    text: message.text ?? undefined,
    to: message.to,
  });

  const mime = composer.compile();
  mime.keepBcc = keepBcc;
  return mime.build();
}

export function prepareCloudflareEmailMessage(message: DeliveryMessage) {
  const cc = message.cc ?? [];
  const bcc = message.bcc ?? [];
  const customHeaders = message.headers ?? {};
  const payload = {
    attachments: message.attachments.map((attachment) => ({
      content: attachment.content.toString("base64"),
      ...(attachment.contentId
        ? {
            content_id: attachment.contentId,
            disposition: "inline" as const,
          }
        : { disposition: "attachment" as const }),
      filename: attachment.filename,
      type: attachment.contentType,
    })),
    ...(bcc.length > 0 ? { bcc } : {}),
    ...(cc.length > 0 ? { cc } : {}),
    from: message.from,
    ...(Object.keys(customHeaders).length > 0
      ? { headers: customHeaders }
      : {}),
    ...(message.html === null ? {} : { html: message.html }),
    ...(message.replyTo && message.replyTo.length > 0
      ? { reply_to: message.replyTo }
      : {}),
    subject: message.subject,
    ...(message.text === null ? {} : { text: message.text }),
    to: message.to,
  };

  if (
    Buffer.byteLength(JSON.stringify(payload), "utf8") >
    CLOUDFLARE_EMAIL_MAX_BYTES
  ) {
    throw new DeliveryProviderError("MESSAGE_TOO_LARGE");
  }

  return payload;
}
