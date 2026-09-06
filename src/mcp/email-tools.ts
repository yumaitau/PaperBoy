import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AttachmentStorageError } from "@/lib/attachment-storage";
import { AuthorizationError } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-core";
import {
  EmailError,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/email-core";
import type {
  QueuedMessageBatchItem,
  QueuedMessageRecord,
} from "@/lib/messages";
import { OpenTrackingConfigurationError } from "@/lib/open-tracking-core";
import {
  RateLimitConfigurationError,
  RateLimitError,
} from "@/lib/rate-limit-core";
import { TemplateError } from "@/lib/template-core";
import { protocolTimestamp } from "@/lib/time";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_EMAIL_MCP_TOOL_NAMES = [
  "paperboy_send_email",
  "paperboy_send_email_batch",
  "paperboy_share_email",
  "paperboy_list_email_attachments",
  "paperboy_get_email_attachment",
  "paperboy_get_email_metrics",
] as const;

export const PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS = [
  {
    description:
      "Validate and queue one transactional email for the authenticated organization and API-key environment. Optional idempotencyKey replay protection is scoped to that API key for 24 hours.",
    mutating: true,
    name: PAPERBOY_EMAIL_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Validate and queue up to 100 transactional emails, preserving input order and reporting failures per item.",
    mutating: true,
    name: PAPERBOY_EMAIL_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Create an expiring shareable link for one sent email. Links last up to 48 hours.",
    mutating: true,
    name: PAPERBOY_EMAIL_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List one sent email's attachments with signed download URLs.",
    mutating: false,
    name: PAPERBOY_EMAIL_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one sent email attachment with a signed download URL.",
    mutating: false,
    name: PAPERBOY_EMAIL_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Aggregate account email metrics with optional period, domain, email, and broadcast breakdowns.",
    mutating: false,
    name: PAPERBOY_EMAIL_MCP_TOOL_NAMES[5],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpEmailServices = {
  queue: (
    principal: ApiKeyPrincipal,
    payload: unknown,
    idempotencyKey?: unknown,
  ) => Promise<QueuedMessageRecord>;
  queueBatch: (
    principal: ApiKeyPrincipal,
    payloads: unknown[],
  ) => Promise<QueuedMessageBatchItem[]>;
  share: (
    principal: ApiKeyPrincipal,
    messageId: string,
    input: { expiresIn?: unknown; origin: string },
  ) => Promise<{ expiresAt: Date; id: string; url: string }>;
  listAttachments: (
    principal: ApiKeyPrincipal,
    messageId: string,
  ) => Promise<McpAttachmentRecord[]>;
  getAttachment: (
    principal: ApiKeyPrincipal,
    messageId: string,
    attachmentId: string,
  ) => Promise<McpAttachmentRecord>;
  attachmentDownloadUrl: (
    principal: ApiKeyPrincipal,
    messageId: string,
    attachmentId: string,
    origin: string,
  ) => Promise<{ expiresAt: Date; url: string }>;
  metrics: (
    principal: ApiKeyPrincipal,
    query: Record<string, string>,
  ) => Promise<McpMetricsResult>;
};

export type McpAttachmentRecord = {
  byteSize: number;
  contentId: string | null;
  contentType: string;
  createdAt: Date;
  filename: string;
  id: string;
  messageId: string;
};

export type McpMetricsResult = {
  data: { data: { metric: string; value: number }[]; dimensions: Record<string, string | null> }[];
  endDate: Date;
  granularity: string;
  startDate: Date;
  timezone: string;
  totals: Record<string, number>;
};

const address = z.string().min(1).max(320);
const tag = z
  .object({
    name: z.string().min(1).max(256),
    value: z.string().min(1).max(256),
  })
  .strict();
const attachment = z
  .object({
    content: z
      .string()
      .min(1)
      .max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4),
    content_id: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[^\s<>,;]+$/)
      .optional(),
    content_type: z
      .string()
      .min(3)
      .max(127)
      .regex(/^[A-Z0-9!#$&^_.+-]+\/[A-Z0-9!#$&^_.+-]+$/i),
    filename: z.string().min(1).max(255),
  })
  .strict();
const headers = z.record(z.string(), z.string()).optional();
const scheduledAt = z.string().datetime({ offset: true }).optional();

const templateData = z.record(z.string(), z.unknown());

function validateSendMode(
  value: {
    data?: Record<string, unknown>;
    html?: string;
    subject?: string;
    template_id?: string;
    text?: string;
  },
  context: z.core.$RefinementCtx,
) {
  if (value.template_id) {
    for (const field of ["subject", "html", "text"] as const) {
      if (value[field] !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Do not combine inline content with template_id.",
          path: [field],
        });
      }
    }

    return;
  }

  if (!value.subject) {
    context.addIssue({
      code: "custom",
      message: "Provide subject for an inline email.",
      path: ["subject"],
    });
  }

  if (value.data !== undefined) {
    context.addIssue({
      code: "custom",
      message: "Provide template_id when sending template data.",
      path: ["data"],
    });
  }
}

const sendEmailPayloadSchema = z
  .object({
    bcc: z.union([address, z.array(address).min(1).max(50)]).optional(),
    cc: z.union([address, z.array(address).min(1).max(50)]).optional(),
    data: templateData.optional(),
    from: address,
    headers,
    html: z.string().max(2 * 1024 * 1024).optional(),
    reply_to: z.union([address, z.array(address).min(1).max(50)]).optional(),
    scheduled_at: scheduledAt,
    subject: z.string().min(1).max(998).optional(),
    tags: z.array(tag).max(75).optional(),
    template_id: z.string().uuid().optional(),
    text: z.string().max(2 * 1024 * 1024).optional(),
    to: z.union([address, z.array(address).min(1).max(50)]),
  })
  .strict()
  .superRefine(validateSendMode);

const sendEmailInputSchema = z
  .object({
    attachments: z.array(attachment).max(100).optional(),
    bcc: z.union([address, z.array(address).min(1).max(50)]).optional(),
    cc: z.union([address, z.array(address).min(1).max(50)]).optional(),
    data: templateData.optional(),
    from: address,
    headers,
    html: z.string().max(2 * 1024 * 1024).optional(),
    reply_to: z.union([address, z.array(address).min(1).max(50)]).optional(),
    idempotencyKey: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[\x21-\x7e]+$/)
      .describe(
        "API-key-scoped for 24 hours; an identical replay returns the original message without provider resubmission.",
      )
      .optional(),
    scheduled_at: scheduledAt,
    subject: z.string().min(1).max(998).optional(),
    tags: z.array(tag).max(75).optional(),
    template_id: z.string().uuid().optional(),
    text: z.string().max(2 * 1024 * 1024).optional(),
    to: z.union([address, z.array(address).min(1).max(50)]),
  })
  .strict()
  .superRefine(validateSendMode);

const sendEmailBatchInputSchema = z
  .object({
    emails: z.array(sendEmailPayloadSchema).min(1).max(100),
  })
  .strict();

const queuedEmailOutputShape = {
  deliveryMode: z.enum(["live", "test-sink"]),
  environment: z.enum(["live", "test"]),
  id: z.string().uuid(),
  queuedAt: z.iso.datetime({ offset: true }),
  provider: z.enum([
    "smtp",
    "cloudflare-email",
    "aws-ses",
    "azure-email",
    "test-sink",
  ]),
  replayed: z.boolean(),
  status: z.enum(["queued", "sending", "sent", "failed"]),
};

const sendEmailOutputSchema = z.object({
  deliveryMode: queuedEmailOutputShape.deliveryMode,
  environment: queuedEmailOutputShape.environment,
  id: queuedEmailOutputShape.id,
  protocolTimeZone: z.literal("UTC"),
  queuedAt: queuedEmailOutputShape.queuedAt,
  provider: queuedEmailOutputShape.provider,
  replayed: queuedEmailOutputShape.replayed,
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
  status: queuedEmailOutputShape.status,
});

const sendEmailBatchOutputSchema = z.object({
  data: z.array(
    z.union([
      z.object({
        ...queuedEmailOutputShape,
        index: z.number().int().min(0).max(99),
      }),
      z.object({
        error: z.object({
          code: z.string(),
          environment: z.enum(["live", "test"]).optional(),
          fields: z
            .array(z.object({ field: z.string(), message: z.string() }))
            .optional(),
          limit: z.number().int().positive().optional(),
          message: z.string(),
          retryAfterSeconds: z.number().int().positive().optional(),
        }),
        index: z.number().int().min(0).max(99),
      }),
    ]),
  ),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
});

function unauthorizedResult() {
  return {
    content: [
      {
        text: "Authorization failed. Reconnect with a valid PaperBoy API key.",
        type: "text" as const,
      },
    ],
    isError: true,
  };
}

function errorDetails(error: unknown) {
  let details: {
    code: string;
    environment?: "live" | "test";
    fields?: { field: string; message: string }[];
    limit?: number;
    message: string;
    retryAfterSeconds?: number;
  } = {
    code: "internal_error",
    message: "The email could not be queued.",
  };

  if (error instanceof RateLimitError) {
    details = {
      code: "rate_limit_exceeded",
      environment: error.environment,
      limit: error.limit,
      message: `This organization reached its ${error.environment} send limit. Retry after ${error.retryAfterSeconds} seconds.`,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  } else if (error instanceof RateLimitConfigurationError) {
    details = {
      code: "rate_limit_unavailable",
      message:
        "The operator must correct PaperBoy's live and test rate-limit configuration.",
    };
  } else if (error instanceof OpenTrackingConfigurationError) {
    details = {
      code: "open_tracking_unavailable",
      message:
        "The operator must configure PaperBoy's public URL and dedicated open-tracking signing key.",
    };
  } else if (error instanceof EmailError) {
    details =
      error.code === "RECIPIENT_SUPPRESSED"
        ? {
            code: "recipient_suppressed",
            fields: error.issues,
            message:
              "One or more recipients are suppressed after a bounce, complaint, or operator action.",
          }
        : error.code === "ATTACHMENTS_TOO_LARGE"
        ? {
            code: "attachment_size_exceeded",
            fields: [
              {
                field: "attachments",
                message: "Attachments must total at most 10 MiB.",
              },
            ],
            message: "Reduce the attachment size and try again.",
          }
        : error.code === "IDEMPOTENCY_CONFLICT"
        ? {
            code: "idempotency_conflict",
            message:
              "This idempotency key was already used with a different request.",
          }
        : {
            code: "validation_error",
            fields: error.issues,
            message: "Correct the invalid email fields and try again.",
        };
  } else if (error instanceof TemplateError) {
    if (error.code === "TEMPLATE_NOT_FOUND") {
      details = {
        code: "template_not_found",
        message: "No template with that ID exists in this organization.",
      };
    } else if (error.code === "MISSING_REQUIRED_VARIABLES") {
      details = {
        code: "missing_template_variables",
        fields: error.issues,
        message: "Provide every required template variable and try again.",
      };
    } else {
      details = {
        code: "validation_error",
        fields: error.issues,
        message: "Correct the invalid template fields and try again.",
      };
    }
  } else if (error instanceof DomainError) {
    details = {
      code:
        error.code === "INVALID_DOMAIN"
          ? "invalid_from_domain"
          : "domain_not_verified",
      message:
        error.code === "INVALID_DOMAIN"
          ? "The From address must use a valid sending domain."
          : "Verify the From domain before sending with a live API key.",
    };
  } else if (error instanceof AttachmentStorageError) {
    details = {
      code: "attachment_storage_unavailable",
      message:
        "Attachment storage is unavailable. Ask the PaperBoy operator to check its private storage configuration.",
    };
  } else if (error instanceof AuthorizationError) {
    details = {
      code: "forbidden",
      message:
        "This API key is not granted the messages.send scope required to send email.",
    };
  }

  return details;
}

function errorResult(error: unknown) {
  const details = errorDetails(error);

  return {
    content: [{ text: details.message, type: "text" as const }],
    isError: true,
  };
}

function queuedOutput(message: QueuedMessageRecord) {
  return {
    deliveryMode: message.deliveryMode,
    environment: message.environment,
    id: message.id,
    queuedAt: protocolTimestamp(message.createdAt),
    provider: message.provider,
    replayed: message.replayed,
    status: message.status,
  };
}

export function registerPaperBoyEmailTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  server: McpServer;
  services: PaperBoyMcpEmailServices;
}) {
  input.server.registerTool(
    PAPERBOY_EMAIL_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: sendEmailInputSchema,
      outputSchema: sendEmailOutputSchema,
      title: "Queue a PaperBoy email",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ idempotencyKey, ...payload }) => {
      const principal = await input.authorize();

      if (!principal) {
        return unauthorizedResult();
      }

      try {
        const message = await input.services.queue(
          principal,
          payload,
          idempotencyKey,
        );
        const output = {
          ...queuedOutput(message),
          protocolTimeZone: "UTC" as const,
          schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
        };

        return {
          content: [
            { text: JSON.stringify(output, null, 2), type: "text" as const },
          ],
          structuredContent: output,
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EMAIL_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: sendEmailBatchInputSchema,
      outputSchema: sendEmailBatchOutputSchema,
      title: "Queue a PaperBoy email batch",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ emails }) => {
      const principal = await input.authorize();

      if (!principal) {
        return unauthorizedResult();
      }

      const batch = await input.services.queueBatch(principal, emails);
      const output = {
        data: batch.map((item, index) =>
          item.ok
            ? { ...queuedOutput(item.message), index }
            : { error: errorDetails(item.error), index },
        ),
        protocolTimeZone: "UTC" as const,
        schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
      };

      return {
        content: [
          { text: JSON.stringify(output, null, 2), type: "text" as const },
        ],
        structuredContent: output,
      };
    },
  );

  const metadata = () => ({
    observedAt: protocolTimestamp(new Date()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  function successResult(output: Record<string, unknown>) {
    return {
      content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
      structuredContent: output,
    };
  }

  const attachmentSchema = z.object({
    contentId: z.string().nullable(),
    contentType: z.string(),
    downloadUrl: z.string(),
    filename: z.string(),
    id: z.string().uuid(),
  });

  const shareOutputSchema = z.object({
    expiresAt: z.iso.datetime({ offset: true }),
    id: z.string().uuid(),
    observedAt: z.iso.datetime({ offset: true }),
    protocolTimeZone: z.literal("UTC"),
    schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
    url: z.string(),
  });

  const attachmentsOutputSchema = z.object({
    attachments: z.array(attachmentSchema),
    observedAt: z.iso.datetime({ offset: true }),
    protocolTimeZone: z.literal("UTC"),
    schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
  });

  const attachmentOutputSchema = z.object({
    attachment: attachmentSchema,
    observedAt: z.iso.datetime({ offset: true }),
    protocolTimeZone: z.literal("UTC"),
    schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
  });

  const metricsOutputSchema = z.object({
    data: z.array(
      z.object({
        data: z.array(
          z.object({ metric: z.string(), value: z.number() }),
        ),
        dimensions: z.record(z.string(), z.string().nullable()),
      }),
    ),
    endDate: z.iso.datetime({ offset: true }),
    granularity: z.string(),
    observedAt: z.iso.datetime({ offset: true }),
    protocolTimeZone: z.literal("UTC"),
    schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
    startDate: z.iso.datetime({ offset: true }),
    timezone: z.string(),
    totals: z.record(z.string(), z.number()),
  });

  const messageIdInput = z.object({ messageId: z.string().uuid() }).strict();

  async function attachmentOutput(
    principal: ApiKeyPrincipal,
    messageId: string,
    attachment: McpAttachmentRecord,
  ) {
    const download = await input.services.attachmentDownloadUrl(
      principal,
      messageId,
      attachment.id,
      publicOrigin(),
    );
    return {
      attachment: {
        contentId: attachment.contentId,
        contentType: attachment.contentType,
        downloadUrl: download.url,
        filename: attachment.filename,
        id: attachment.id,
      },
    };
  }

  input.server.registerTool(
    PAPERBOY_EMAIL_MCP_TOOL_NAMES[2],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS[2].description,
      inputSchema: z
        .object({
          expiresIn: z.string().min(1).max(32).optional(),
          messageId: z.string().uuid(),
        })
        .strict(),
      outputSchema: shareOutputSchema,
      title: "Share a PaperBoy email",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ expiresIn, messageId }: { expiresIn?: string; messageId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const shared = await input.services.share(principal, messageId, {
          expiresIn,
          origin: publicOrigin(),
        });
        return successResult({
          ...metadata(),
          expiresAt: shared.expiresAt.toISOString(),
          id: shared.id,
          url: shared.url,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EMAIL_MCP_TOOL_NAMES[3],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS[3].description,
      inputSchema: messageIdInput,
      outputSchema: attachmentsOutputSchema,
      title: "List a PaperBoy email's attachments",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ messageId }: { messageId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const attachments = await input.services.listAttachments(
          principal,
          messageId,
        );
        return successResult({
          ...metadata(),
          attachments: await Promise.all(
            attachments.map((attachment) =>
              attachmentOutput(principal, messageId, attachment),
            ),
          ),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EMAIL_MCP_TOOL_NAMES[4],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS[4].description,
      inputSchema: z
        .object({ attachmentId: z.string().uuid(), messageId: z.string().uuid() })
        .strict(),
      outputSchema: attachmentOutputSchema,
      title: "Get a PaperBoy email attachment",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({
      attachmentId,
      messageId,
    }: {
      attachmentId: string;
      messageId: string;
    }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const attachment = await input.services.getAttachment(
          principal,
          messageId,
          attachmentId,
        );
        return successResult({
          ...metadata(),
          ...(await attachmentOutput(principal, messageId, attachment)),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_EMAIL_MCP_TOOL_NAMES[5],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_EMAIL_MCP_TOOL_DEFINITIONS[5].description,
      inputSchema: z
        .object({
          broadcastId: z.string().uuid().optional(),
          dimensions: z.string().optional(),
          domainId: z.string().optional(),
          emailId: z.string().optional(),
          endDate: z.string().optional(),
          granularity: z
            .enum(["hourly", "daily", "weekly", "monthly"])
            .optional(),
          metrics: z.string().optional(),
          startDate: z.string().optional(),
          timezone: z.string().optional(),
        })
        .strict(),
      outputSchema: metricsOutputSchema,
      title: "Get PaperBoy email metrics",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
     
    async (args: any) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const query: Record<string, string> = {};
        for (const [key, value] of Object.entries(args ?? {})) {
          if (typeof value === "string") query[key] = value;
        }
        const result = await input.services.metrics(principal, query);
        return successResult({
          ...metadata(),
          data: result.data,
          endDate: result.endDate.toISOString(),
          granularity: result.granularity,
          startDate: result.startDate.toISOString(),
          timezone: result.timezone,
          totals: result.totals,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

function publicOrigin(): string {
  const raw =
    process.env.PAPERBOY_PUBLIC_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost";
  return raw.replace(/\/$/, "");
}
