import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope } from "@/lib/authorization";
import { queueEmail, queueEmailBatch } from "@/lib/messages";
import { messageApiServices } from "@/lib/message-api-services";
import type { PaperBoyMcpEmailServices } from "@/mcp/email-tools";

function requireSendScope(principal: ApiKeyPrincipal): void {
  requireKeyScope(principal.scopes, "messages.send");
}

export const paperBoyMcpEmailServices: PaperBoyMcpEmailServices = {
  queue: (
    principal: ApiKeyPrincipal,
    payload: unknown,
    idempotencyKey?: unknown,
  ) => {
    requireSendScope(principal);
    return queueEmail({ idempotencyKey, payload, principal });
  },
  queueBatch: (principal: ApiKeyPrincipal, payloads: unknown[]) => {
    requireSendScope(principal);
    return queueEmailBatch({ payloads, principal });
  },
  share: messageApiServices.share,
  listAttachments: messageApiServices.listAttachments,
  getAttachment: messageApiServices.getAttachment,
  attachmentDownloadUrl: messageApiServices.attachmentDownloadUrl,
  metrics: messageApiServices.metrics,
};
