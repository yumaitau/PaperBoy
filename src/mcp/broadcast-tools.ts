import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AudienceError } from "@/lib/audience-core";
import { AuthorizationError } from "@/lib/authorization";
import {
  BroadcastError,
  MAX_BROADCAST_NAME_LENGTH,
} from "@/lib/broadcast-core";
import type {
  BroadcastClickedLink,
  BroadcastRecord,
  BroadcastRecipientView,
} from "@/lib/broadcasts";
import { protocolTimestamp } from "@/lib/time";
import {
  MAX_TEMPLATE_BODY_LENGTH,
  MAX_TEMPLATE_SUBJECT_LENGTH,
  TemplateError,
} from "@/lib/template-core";
import { UnsubscribeConfigurationError } from "@/lib/unsubscribe-core";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_BROADCAST_MCP_TOOL_NAMES = [
  "paperboy_list_broadcasts",
  "paperboy_get_broadcast",
  "paperboy_create_broadcast",
  "paperboy_pause_broadcast",
  "paperboy_resume_broadcast",
  "paperboy_cancel_broadcast",
  "paperboy_update_broadcast",
  "paperboy_delete_broadcast",
  "paperboy_send_broadcast",
  "paperboy_list_broadcast_recipients",
  "paperboy_list_broadcast_clicked_links",
] as const;

export const PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS = [
  {
    description:
      "List all broadcast progress for the authenticated organization.",
    mutating: false,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Read one broadcast and its queued, suppressed, failed, and cancelled counts.",
    mutating: false,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Send or schedule one template to a stored audience snapshot with signed unsubscribe links and suppression checks.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Pause a running broadcast after its current recipient.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Resume a paused broadcast and enqueue its remaining audience.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Permanently cancel a broadcast so pending recipients are never queued.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[5],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Update a scheduled broadcast and atomically replace its stored template or audience snapshot when those IDs change.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[6],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Delete a scheduled broadcast that has not started sending. Running, completed, and cancelled broadcasts cannot be deleted.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[7],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Start a scheduled or paused broadcast now, or reschedule it with scheduled_at.",
    mutating: true,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[8],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "List one broadcast's recipients, optionally filtered by event type, email, or bounce type.",
    mutating: false,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[9],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "List the links in one broadcast's template with click counts.",
    mutating: false,
    name: PAPERBOY_BROADCAST_MCP_TOOL_NAMES[10],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpBroadcastServices = {
  cancel: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
  ) => Promise<BroadcastRecord>;
  create: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<BroadcastRecord>;
  get: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
  ) => Promise<BroadcastRecord>;
  list: (principal: ApiKeyPrincipal) => Promise<BroadcastRecord[]>;
  pause: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
  ) => Promise<BroadcastRecord>;
  resume: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
  ) => Promise<BroadcastRecord>;
  update: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
    payload: unknown,
  ) => Promise<BroadcastRecord>;
  delete: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
  ) => Promise<void>;
  send: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
    payload: unknown,
  ) => Promise<BroadcastRecord>;
  listRecipients: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
    filter: { bounceType?: string; email?: string; limit?: number; type?: string },
  ) => Promise<BroadcastRecipientView[]>;
  listClickedLinks: (
    principal: ApiKeyPrincipal,
    broadcastId: string,
  ) => Promise<BroadcastClickedLink[]>;
};

const createBroadcastInputSchema = z
  .object({
    audienceId: z.string().uuid(),
    from: z.string().min(3).max(320),
    name: z.string().min(1).max(MAX_BROADCAST_NAME_LENGTH),
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    templateId: z.string().uuid(),
  })
  .strict();

const broadcastIdInputSchema = z
  .object({ broadcastId: z.string().uuid() })
  .strict();

const cancelBroadcastInputSchema = z
  .object({
    broadcastId: z.string().uuid(),
    confirm: z.literal(true),
  })
  .strict();

const updateBroadcastInputSchema = z
  .object({
    audienceId: z.string().uuid().optional(),
    broadcastId: z.string().uuid(),
    from: z.string().min(3).max(320).optional(),
    html: z.string().max(MAX_TEMPLATE_BODY_LENGTH).nullable().optional(),
    name: z.string().min(1).max(MAX_BROADCAST_NAME_LENGTH).optional(),
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(MAX_TEMPLATE_SUBJECT_LENGTH)
      .regex(/^[^\r\n]*$/)
      .optional(),
    templateId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    ({ broadcastId: _broadcastId, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    { message: "Provide at least one broadcast field to update." },
  );

const progressSchema = z.object({
  cancelled: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const broadcastSchema = z.object({
  cancelledAt: z.iso.datetime({ offset: true }).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  environment: z.enum(["live", "test"]),
  from: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  pausedAt: z.iso.datetime({ offset: true }).nullable(),
  progress: progressSchema,
  scheduledFor: z.iso.datetime({ offset: true }).nullable(),
  sourceAudienceId: z.string().uuid().nullable(),
  sourceTemplateId: z.string().uuid().nullable(),
  status: z.enum(["scheduled", "running", "paused", "completed", "cancelled"]),
  subject: z.string(),
  templateName: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
});

const metadataSchema = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

const broadcastOutputSchema = z.object({
  broadcast: broadcastSchema,
  ...metadataSchema,
});

const broadcastsOutputSchema = z.object({
  broadcasts: z.array(broadcastSchema),
  ...metadataSchema,
});

const recipientSchema = z.object({
  bouncedAt: z.iso.datetime({ offset: true }).nullable(),
  clickedAt: z.iso.datetime({ offset: true }).nullable(),
  complainedAt: z.iso.datetime({ offset: true }).nullable(),
  contactId: z.string().uuid().nullable(),
  deliveredAt: z.iso.datetime({ offset: true }).nullable(),
  email: z.string(),
  messageId: z.string().uuid().nullable(),
  openedAt: z.iso.datetime({ offset: true }).nullable(),
  position: z.number().int().nonnegative(),
  sentAt: z.iso.datetime({ offset: true }).nullable(),
  status: z.string(),
  unsubscribed: z.boolean(),
});

const clickedLinkSchema = z.object({
  clickCount: z.number().int().nonnegative(),
  uniqueClicks: z.number().int().nonnegative(),
  url: z.string(),
});

const recipientsOutputSchema = z.object({
  recipients: z.array(recipientSchema),
  ...metadataSchema,
});

const clickedLinksOutputSchema = z.object({
  clickedLinks: z.array(clickedLinkSchema),
  ...metadataSchema,
});

const deleteBroadcastOutputSchema = z.object({
  deleted: z.literal(true),
  broadcastId: z.string().uuid(),
  ...metadataSchema,
});

const sendBroadcastInputSchema = z
  .object({
    broadcastId: z.string().uuid(),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

const recipientsInputSchema = z
  .object({
    bounceType: z.enum(["permanent", "transient", "undetermined"]).optional(),
    broadcastId: z.string().uuid(),
    email: z.string().min(1).max(254).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    type: z
      .enum([
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complained",
        "unsubscribed",
        "suppressed",
      ])
      .optional(),
  })
  .strict();

function serializeRecipient(view: BroadcastRecipientView) {
  return {
    bouncedAt: view.bouncedAt ? protocolTimestamp(view.bouncedAt) : null,
    clickedAt: view.clickedAt ? protocolTimestamp(view.clickedAt) : null,
    complainedAt: view.complainedAt ? protocolTimestamp(view.complainedAt) : null,
    contactId: view.contactId,
    deliveredAt: view.deliveredAt ? protocolTimestamp(view.deliveredAt) : null,
    email: view.email,
    messageId: view.messageId,
    openedAt: view.openedAt ? protocolTimestamp(view.openedAt) : null,
    position: view.position,
    sentAt: view.sentAt ? protocolTimestamp(view.sentAt) : null,
    status: view.status,
    unsubscribed: view.unsubscribed,
  };
}

function serializeClickedLink(link: BroadcastClickedLink) {
  return {
    clickCount: link.clickCount,
    uniqueClicks: link.uniqueClicks,
    url: link.url,
  };
}

function serialize(record: BroadcastRecord) {
  return {
    cancelledAt: record.cancelledAt
      ? protocolTimestamp(record.cancelledAt)
      : null,
    completedAt: record.completedAt
      ? protocolTimestamp(record.completedAt)
      : null,
    createdAt: protocolTimestamp(record.createdAt),
    environment: record.environment,
    from: record.from,
    id: record.id,
    name: record.name,
    pausedAt: record.pausedAt ? protocolTimestamp(record.pausedAt) : null,
    progress: record.progress,
    scheduledFor: record.scheduledFor
      ? protocolTimestamp(record.scheduledFor)
      : null,
    sourceAudienceId: record.sourceAudienceId,
    sourceTemplateId: record.sourceTemplateId,
    status: record.status,
    subject: record.templateSubject,
    templateName: record.templateName,
    updatedAt: protocolTimestamp(record.updatedAt),
  };
}

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

function errorResult(error: unknown) {
  let message = "The broadcast operation failed.";

  if (error instanceof AuthorizationError) {
    message = "The API key creator's current role does not allow this broadcast operation.";
  } else if (error instanceof BroadcastError) {
    if (error.code === "MEMBERSHIP_REQUIRED") {
      message = "Create a new API key from a current organization owner or admin.";
    } else if (error.code === "BROADCAST_NOT_FOUND") {
      message = "No broadcast with that ID exists in this organization.";
    } else if (error.code === "INVALID_TRANSITION") {
      message = "This broadcast cannot make that state transition.";
    } else {
      message = error.issues[0]?.message ?? "Check the broadcast fields.";
    }
  } else if (error instanceof TemplateError) {
    message =
      error.code === "TEMPLATE_NOT_FOUND"
        ? "No template with that ID exists in this organization."
        : error.issues[0]?.message ?? "Check the template fields.";
  } else if (error instanceof AudienceError) {
    message =
      error.code === "AUDIENCE_NOT_FOUND"
        ? "No audience with that ID exists in this organization."
        : "The audience has no active subscribed contacts.";
  } else if (error instanceof UnsubscribeConfigurationError) {
    message = "The operator must configure PAPERBOY_UNSUBSCRIBE_SIGNING_KEY before sending broadcasts.";
  } else {
    console.error("PaperBoy MCP broadcast operation failed.");
  }

  return { content: [{ text: message, type: "text" as const }], isError: true };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
    structuredContent: output,
  };
}

export function registerPaperBoyBroadcastTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpBroadcastServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  async function principal() {
    return input.authorize();
  }

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: z.object({}).strict(),
      outputSchema: broadcastsOutputSchema,
      title: "List PaperBoy broadcasts",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async () => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const records = await input.services.list(authenticated);
        return successResult({
          broadcasts: records.map(serialize),
          ...metadata(),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: broadcastIdInputSchema,
      outputSchema: broadcastOutputSchema,
      title: "Get a PaperBoy broadcast",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ broadcastId }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const record = await input.services.get(authenticated, broadcastId);
        return successResult({ broadcast: serialize(record), ...metadata() });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[2],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[2].description,
      inputSchema: createBroadcastInputSchema,
      outputSchema: broadcastOutputSchema,
      title: "Create and send a PaperBoy broadcast",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ templateId, ...payload }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const record = await input.services.create(authenticated, {
          ...payload,
          templateId,
        });
        return successResult({ broadcast: serialize(record), ...metadata() });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  const controls = [
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      index: 3,
      operation: "pause" as const,
      schema: broadcastIdInputSchema,
      title: "Pause a PaperBoy broadcast",
    },
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false,
      },
      index: 4,
      operation: "resume" as const,
      schema: broadcastIdInputSchema,
      title: "Resume a PaperBoy broadcast",
    },
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      index: 5,
      operation: "cancel" as const,
      schema: cancelBroadcastInputSchema,
      title: "Cancel a PaperBoy broadcast",
    },
  ];

  for (const control of controls) {
    input.server.registerTool(
      PAPERBOY_BROADCAST_MCP_TOOL_NAMES[control.index],
      {
        annotations: control.annotations,
        description:
          PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[control.index].description,
        inputSchema: control.schema,
        outputSchema: broadcastOutputSchema,
        title: control.title,
        _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
      },
      async ({ broadcastId }: { broadcastId: string }) => {
        const authenticated = await principal();
        if (!authenticated) return unauthorizedResult();

        try {
          const record = await input.services[control.operation](
            authenticated,
            broadcastId,
          );
          return successResult({ broadcast: serialize(record), ...metadata() });
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[6],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[6].description,
      inputSchema: updateBroadcastInputSchema,
      outputSchema: broadcastOutputSchema,
      title: "Update a scheduled PaperBoy broadcast",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ broadcastId, ...payload }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const record = await input.services.update(
          authenticated,
          broadcastId,
          payload,
        );
        return successResult({ broadcast: serialize(record), ...metadata() });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[7],
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[7].description,
      inputSchema: cancelBroadcastInputSchema,
      outputSchema: deleteBroadcastOutputSchema,
      title: "Delete a scheduled PaperBoy broadcast",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ broadcastId }: { broadcastId: string }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        await input.services.delete(authenticated, broadcastId);
        return successResult({
          broadcastId,
          deleted: true as const,
          ...metadata(),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[8],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[8].description,
      inputSchema: sendBroadcastInputSchema,
      outputSchema: broadcastOutputSchema,
      title: "Send a PaperBoy broadcast",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({
      broadcastId,
      scheduledAt,
    }: {
      broadcastId: string;
      scheduledAt?: string;
    }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const record = await input.services.send(authenticated, broadcastId, {
          ...(scheduledAt === undefined ? {} : { scheduled_at: scheduledAt }),
        });
        return successResult({ broadcast: serialize(record), ...metadata() });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[9],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[9].description,
      inputSchema: recipientsInputSchema,
      outputSchema: recipientsOutputSchema,
      title: "List a PaperBoy broadcast's recipients",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({
      broadcastId,
      ...filter
    }: {
      broadcastId: string;
      bounceType?: "permanent" | "transient" | "undetermined";
      email?: string;
      limit?: number;
      type?: string;
    }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const recipients = await input.services.listRecipients(
          authenticated,
          broadcastId,
          filter,
        );
        return successResult({
          recipients: recipients.map(serializeRecipient),
          ...metadata(),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_BROADCAST_MCP_TOOL_NAMES[10],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_BROADCAST_MCP_TOOL_DEFINITIONS[10].description,
      inputSchema: broadcastIdInputSchema,
      outputSchema: clickedLinksOutputSchema,
      title: "List a PaperBoy broadcast's clicked links",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ broadcastId }: { broadcastId: string }) => {
      const authenticated = await principal();
      if (!authenticated) return unauthorizedResult();

      try {
        const clickedLinks = await input.services.listClickedLinks(
          authenticated,
          broadcastId,
        );
        return successResult({
          clickedLinks: clickedLinks.map(serializeClickedLink),
          ...metadata(),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
