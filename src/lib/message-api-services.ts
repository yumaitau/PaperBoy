import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope } from "@/lib/authorization";
import { parseMetricsQuery, getEmailMetrics } from "@/lib/email-metrics";
import type { MessageHttpServices } from "@/lib/message-http";
import {
  getMessageDetail,
  listMessageEvents,
} from "@/lib/message-events";
import { cancelEmail, rescheduleEmail } from "@/lib/message-lifecycle";
import {
  attachmentDownloadUrl,
  getMessageAttachment,
  listMessageAttachments,
  shareEmail,
} from "@/lib/message-sharing";
import {
  getMessageDeliveryOverview,
  type MessageDeliveryOverviewRecord,
} from "@/lib/message-statuses";

function context(principal: ApiKeyPrincipal, messageId: string) {
  return {
    actorUserId: principal.actorUserId,
    environment: principal.environment,
    messageId,
    orgId: principal.orgId,
  };
}

function boundedPage(value: unknown): number {
  const page = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function boundedLimit(value: unknown): number {
  const limit = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(limit)) return 20;
  return Math.max(1, Math.min(limit, 100));
}

export const messageApiServices: MessageHttpServices = {
  cancel: (principal, messageId) => {
    requireKeyScope(principal.scopes, "messages.send");
    return cancelEmail({ messageId, principal });
  },
  get: (principal, messageId) => {
    requireKeyScope(principal.scopes, "messages.read");
    return getMessageDetail(context(principal, messageId));
  },
  list: async (
    principal,
    query,
  ): Promise<{
    limit: number;
    messages: MessageDeliveryOverviewRecord[];
    page: number;
    total: number;
  }> => {
    requireKeyScope(principal.scopes, "messages.read");
    const page = boundedPage(query.page);
    const limit = boundedLimit(query.limit);
    const overview = await getMessageDeliveryOverview({
      actorUserId: principal.actorUserId,
      environment: principal.environment,
      limit,
      offset: (page - 1) * limit,
      orgId: principal.orgId,
    });
    return {
      limit,
      messages: overview.messages,
      page,
      total: overview.total,
    };
  },
  listEvents: (principal, messageId) => {
    requireKeyScope(principal.scopes, "messages.read");
    return listMessageEvents(context(principal, messageId));
  },
  listAttachments: (principal, messageId) => {
    requireKeyScope(principal.scopes, "messages.read");
    return listMessageAttachments({
      actorUserId: principal.actorUserId,
      messageId,
      orgId: principal.orgId,
    });
  },
  getAttachment: (principal, messageId, attachmentId) => {
    requireKeyScope(principal.scopes, "messages.read");
    return getMessageAttachment({
      actorUserId: principal.actorUserId,
      attachmentId,
      messageId,
      orgId: principal.orgId,
    });
  },
  attachmentDownloadUrl: (principal, messageId, attachmentId, origin) => {
    requireKeyScope(principal.scopes, "messages.read");
    return attachmentDownloadUrl({
      actorUserId: principal.actorUserId,
      attachmentId,
      baseUrl: origin,
      messageId,
      orgId: principal.orgId,
    });
  },
  share: (principal, messageId, input) => {
    requireKeyScope(principal.scopes, "emails.share");
    return shareEmail({
      actorUserId: principal.actorUserId,
      baseUrl: input.origin,
      expiresIn: input.expiresIn,
      messageId,
      orgId: principal.orgId,
    });
  },
  metrics: (principal, query) => {
    requireKeyScope(principal.scopes, "emails.metrics");
    return getEmailMetrics({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      query: parseMetricsQuery({
        broadcast_id: query["broadcast_id"],
        dimensions: query["dimensions"],
        domain_id: query["domain_id"],
        email_id: query["email_id"],
        end_date: query["end_date"],
        granularity: query["granularity"],
        metrics: query["metrics"],
        start_date: query["start_date"],
        timezone: query["timezone"],
      }),
    });
  },
  reschedule: (principal, messageId, payload) => {
    requireKeyScope(principal.scopes, "messages.send");
    return rescheduleEmail({ messageId, payload, principal });
  },
};
