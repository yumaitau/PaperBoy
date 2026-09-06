import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { broadcastApiServices } from "@/lib/broadcast-api-services";
import type { PaperBoyMcpBroadcastServices } from "@/mcp/broadcast-tools";

function servicePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const input = payload as Record<string, unknown>;
  const mapped: Record<string, unknown> = {
    ...input,
    ...(input.audienceId === undefined
      ? {}
      : { audience_id: input.audienceId }),
    ...(input.scheduledFor === undefined
      ? {}
      : { scheduled_for: input.scheduledFor }),
    ...(input.templateId === undefined
      ? {}
      : { template_id: input.templateId }),
  };
  delete mapped.audienceId;
  delete mapped.scheduledFor;
  delete mapped.templateId;
  return mapped;
}

export const paperBoyMcpBroadcastServices: PaperBoyMcpBroadcastServices = {
  cancel: broadcastApiServices.cancel,
  create: (principal: ApiKeyPrincipal, payload: unknown) =>
    broadcastApiServices.create(principal, servicePayload(payload)),
  delete: broadcastApiServices.delete,
  get: broadcastApiServices.get,
  list: broadcastApiServices.list,
  listClickedLinks: broadcastApiServices.listClickedLinks,
  listRecipients: broadcastApiServices.listRecipients,
  pause: broadcastApiServices.pause,
  resume: broadcastApiServices.resume,
  send: (principal, broadcastId, payload) =>
    broadcastApiServices.send(principal, broadcastId, servicePayload(payload)),
  update: (principal, broadcastId, payload) =>
    broadcastApiServices.update(principal, broadcastId, servicePayload(payload)),
};
