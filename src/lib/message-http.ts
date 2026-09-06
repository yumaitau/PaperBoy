import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { EmailError } from "@/lib/email-core";
import {
  EmailMetricsError,
  type EmailMetricsResult,
} from "@/lib/email-metrics";
import type { MessageEventRecord } from "@/lib/message-event-core";
import type { MessageDetailRecord } from "@/lib/message-events";
import type { MessageDeliveryOverviewRecord } from "@/lib/message-status-core";
import { MessageStatusError } from "@/lib/message-status-core";
import { MessageLifecycleError } from "@/lib/message-lifecycle";
import {
  ShareConfigurationError,
  type SharedEmailRecord,
} from "@/lib/message-sharing";
import type { MessageAttachmentRecord } from "@/lib/message-sharing";

export type MessageHttpServices = {
  cancel: (
    principal: ApiKeyPrincipal,
    messageId: string,
  ) => Promise<MessageDetailRecord>;
  get: (
    principal: ApiKeyPrincipal,
    messageId: string,
  ) => Promise<MessageDetailRecord>;
  list: (
    principal: ApiKeyPrincipal,
    query: { limit?: unknown; page?: unknown },
  ) => Promise<{
    limit: number;
    messages: MessageDeliveryOverviewRecord[];
    page: number;
    total: number;
  }>;
  listEvents: (
    principal: ApiKeyPrincipal,
    messageId: string,
  ) => Promise<MessageEventRecord[]>;
  listAttachments: (
    principal: ApiKeyPrincipal,
    messageId: string,
  ) => Promise<MessageAttachmentRecord[]>;
  getAttachment: (
    principal: ApiKeyPrincipal,
    messageId: string,
    attachmentId: string,
  ) => Promise<MessageAttachmentRecord>;
  attachmentDownloadUrl: (
    principal: ApiKeyPrincipal,
    messageId: string,
    attachmentId: string,
    origin: string,
  ) => Promise<{ expiresAt: Date; url: string }>;
  share: (
    principal: ApiKeyPrincipal,
    messageId: string,
    input: { expiresIn?: unknown; origin: string },
  ) => Promise<{ expiresAt: Date; id: string; url: string }>;
  metrics: (
    principal: ApiKeyPrincipal,
    query: Record<string, string>,
  ) => Promise<EmailMetricsResult & { data: { data: { metric: string; value: number }[]; dimensions: Record<string, string | null> }[] }>;
  reschedule: (
    principal: ApiKeyPrincipal,
    messageId: string,
    payload: unknown,
  ) => Promise<MessageDetailRecord>;
};

type MessageHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: MessageHttpServices;
};

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store", ...headers },
    status,
  });
}

function unauthorized(): Response {
  return json(
    {
      error: {
        code: "unauthorized",
        message: "A valid PaperBoy API key is required.",
      },
    },
    401,
    { "WWW-Authenticate": 'Bearer realm="PaperBoy"' },
  );
}

function failure(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return json(
      {
        error: {
          code: "forbidden",
          message:
            "The API key creator's current role does not allow message access.",
        },
      },
      403,
    );
  }

  if (error instanceof MessageStatusError) {
    if (error.code === "MESSAGE_NOT_FOUND") {
      return json(
        {
          error: {
            code: "email_not_found",
            message: "No email with that ID exists in this environment.",
          },
        },
        404,
      );
    }

    return json(
      {
        error: {
          code: "membership_required",
          message: "Create a new API key from a current organization member.",
        },
      },
      403,
    );
  }

  if (error instanceof EmailError) {
    return json(
      {
        error: {
          code: "validation_error",
          fields: error.issues,
          message: "Correct the invalid email fields and try again.",
        },
      },
      422,
    );
  }

  if (error instanceof EmailMetricsError) {
    if (error.code === "MEMBERSHIP_REQUIRED") {
      return json(
        {
          error: {
            code: "membership_required",
            message: "Create a new API key from a current organization member.",
          },
        },
        403,
      );
    }

    return json(
      {
        error: {
          code: "validation_error",
          fields: error.issues,
          message: "Correct the invalid metrics fields and try again.",
        },
      },
      422,
    );
  }

  if (error instanceof ShareConfigurationError) {
    return json(
      {
        error: {
          code: "share_unavailable",
          message:
            "The operator must configure PAPERBOY_SHARE_SIGNING_KEY to enable share links.",
        },
      },
      503,
    );
  }

  if (error instanceof MessageLifecycleError) {
    if (error.code === "MESSAGE_NOT_FOUND") {
      return json(
        {
          error: {
            code: "email_not_found",
            message: "No email with that ID exists in this environment.",
          },
        },
        404,
      );
    }

    if (error.code === "MEMBERSHIP_REQUIRED") {
      return json(
        {
          error: {
            code: "membership_required",
            message: "Create a new API key from a current organization member.",
          },
        },
        403,
      );
    }

    if (error.code === "NOT_CANCELLABLE") {
      return json(
        {
          error: {
            code: "email_not_cancellable",
            message:
              "Only a queued email can be cancelled. Sent, failed, and cancelled emails are final.",
          },
        },
        422,
      );
    }

    if (error.code === "NOT_RESCHEDULABLE") {
      return json(
        {
          error: {
            code: "email_not_reschedulable",
            message: "Only a queued email can be rescheduled.",
          },
        },
        422,
      );
    }

    return json(
      {
        error: {
          code: "validation_error",
          fields: error.issues,
          message: "Correct the scheduled email fields and try again.",
        },
      },
      422,
    );
  }

  console.error("PaperBoy message read operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The message operation failed.",
      },
    },
    500,
  );
}

export function serializeMessageEvent(event: MessageEventRecord) {
  return {
    created_at: event.createdAt.toISOString(),
    data: event.data,
    id: event.id,
    message_id: event.messageId,
    type: event.type,
  };
}

export function serializeMessage(message: MessageDetailRecord) {
  const timestamp = (value: Date | null) => value?.toISOString() ?? null;

  return {
    attachments: message.attachments.map((attachment) => ({
      content_id: attachment.contentId,
      content_type: attachment.contentType,
      filename: attachment.filename,
      id: attachment.id,
      size: attachment.size,
    })),
    attempt_count: message.attemptCount,
    bcc: message.bcc,
    cancelled_at: timestamp(message.cancelledAt),
    cc: message.cc,
    created_at: message.createdAt.toISOString(),
    delivery_mode: message.deliveryMode,
    domain_id: message.domainId,
    environment: message.environment,
    failed_at: timestamp(message.failedAt),
    failure_reason: message.failureReason,
    from: message.from,
    headers: message.headers,
    html: message.html,
    id: message.id,
    last_attempt_at: timestamp(message.lastAttemptAt),
    last_error_code: message.lastErrorCode,
    next_attempt_at: timestamp(message.nextAttemptAt),
    object: "email" as const,
    open_tracking_enabled: message.openTrackingEnabled,
    click_tracking_enabled: message.clickTrackingEnabled,
    provider: message.provider,
    provider_message_id: message.providerMessageId,
    scheduled_at: timestamp(message.scheduledAt),
    sent_at: timestamp(message.sentAt),
    status: message.status,
    subject: message.subject,
    tags: message.tags,
    text: message.text,
    to: message.to,
    updated_at: message.updatedAt.toISOString(),
  };
}

export function serializeMessageSummary(
  message: MessageDeliveryOverviewRecord,
) {
  const timestamp = (value: Date | null) => value?.toISOString() ?? null;

  return {
    cancelled_at: timestamp(message.cancelledAt),
    created_at: message.createdAt.toISOString(),
    domain_id: message.domainId,
    environment: message.environment,
    from: message.from,
    id: message.id,
    object: "email" as const,
    provider: message.provider,
    provider_message_id: message.providerMessageId,
    scheduled_at: timestamp(message.scheduledAt),
    sent_at: timestamp(message.sentAt),
    status: message.status,
    subject: message.subject,
    to: message.to,
    updated_at: message.updatedAt.toISOString(),
  };
}

async function principal(
  request: Request,
  dependencies: MessageHttpDependencies,
): Promise<ApiKeyPrincipal | Response> {
  return (await dependencies.authenticate(request)) ?? unauthorized();
}

export async function handleGetMessageRequest(
  request: Request,
  messageId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    return json(
      serializeMessage(await dependencies.services.get(authenticated, messageId)),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleListMessagesRequest(
  request: Request,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const url = new URL(request.url);
    const result = await dependencies.services.list(authenticated, {
      limit: url.searchParams.get("limit"),
      page: url.searchParams.get("page"),
    });
    return json(
      {
        data: result.messages.map(serializeMessageSummary),
        limit: result.limit,
        page: result.page,
        total: result.total,
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

async function readJsonBody(request: Request): Promise<unknown | Response> {
  try {
    return await request.json();
  } catch {
    return json(
      {
        error: {
          code: "invalid_json",
          message: "Provide a valid JSON request body.",
        },
      },
      400,
    );
  }
}

export async function handleRescheduleMessageRequest(
  request: Request,
  messageId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  const payload = await readJsonBody(request);
  if (payload instanceof Response) return payload;

  try {
    return json(
      serializeMessage(
        await dependencies.services.reschedule(
          authenticated,
          messageId,
          payload,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleCancelMessageRequest(
  request: Request,
  messageId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    return json(
      serializeMessage(
        await dependencies.services.cancel(authenticated, messageId),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function handleListMessageEventsRequest(
  request: Request,
  messageId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const events = await dependencies.services.listEvents(
      authenticated,
      messageId,
    );
    return json({ data: events.map(serializeMessageEvent) }, 200);
  } catch (error) {
    return failure(error);
  }
}

function serializeAttachment(
  attachment: MessageAttachmentRecord,
  downloadUrl: string,
) {
  return {
    content_id: attachment.contentId,
    content_type: attachment.contentType,
    download_url: downloadUrl,
    filename: attachment.filename,
    id: attachment.id,
  };
}

export async function handleShareEmailRequest(
  request: Request,
  messageId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  let payload: unknown = {};

  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return json(
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
      400,
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const expiresIn =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)["expires_in"]
        : undefined;
    const shared = await dependencies.services.share(authenticated, messageId, {
      expiresIn,
      origin,
    });
    return json(
      {
        expires_at: shared.expiresAt.toISOString(),
        id: shared.id,
        url: shared.url,
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleListMessageAttachmentsRequest(
  request: Request,
  messageId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const origin = new URL(request.url).origin;
    const attachments = await dependencies.services.listAttachments(
      authenticated,
      messageId,
    );
    const data = await Promise.all(
      attachments.map(async (attachment) => {
        const download = await dependencies.services.attachmentDownloadUrl(
          authenticated,
          messageId,
          attachment.id,
          origin,
        );
        return serializeAttachment(attachment, download.url);
      }),
    );
    return json({ data, object: "list" }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetMessageAttachmentRequest(
  request: Request,
  messageId: string,
  attachmentId: string,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const origin = new URL(request.url).origin;
    const attachment = await dependencies.services.getAttachment(
      authenticated,
      messageId,
      attachmentId,
    );
    const download = await dependencies.services.attachmentDownloadUrl(
      authenticated,
      messageId,
      attachmentId,
      origin,
    );
    return json(serializeAttachment(attachment, download.url), 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetEmailMetricsRequest(
  request: Request,
  dependencies: MessageHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = await dependencies.services.metrics(authenticated, query);
    return json(
      {
        data: result.data,
        end_date: result.endDate.toISOString(),
        granularity: result.granularity,
        start_date: result.startDate.toISOString(),
        timezone: result.timezone,
        totals: result.totals,
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetSharedEmailRequest(
  token: string,
  lookup: (token: string) => Promise<SharedEmailRecord>,
): Promise<Response> {
  try {
    const shared = await lookup(token);
    return json(
      {
        expires_at: shared.expiresAt.toISOString(),
        from: shared.from,
        html: shared.html,
        id: shared.id,
        subject: shared.subject,
        text: shared.text,
        to: shared.to,
      },
      200,
    );
  } catch {
    return json(
      {
        error: {
          code: "not_found",
          message: "This share link is invalid or expired.",
        },
      },
      404,
    );
  }
}
