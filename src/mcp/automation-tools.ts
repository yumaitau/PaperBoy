import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { AutomationError } from "@/lib/automation-core";
import type {
  AutomationRecord,
  AutomationRunRecord,
} from "@/lib/automations";
import { protocolTimestamp } from "@/lib/time";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_AUTOMATION_MCP_TOOL_NAMES = [
  "paperboy_list_automations",
  "paperboy_create_automation",
  "paperboy_get_automation",
  "paperboy_update_automation",
  "paperboy_delete_automation",
  "paperboy_duplicate_automation",
  "paperboy_stop_automation",
  "paperboy_list_automation_runs",
  "paperboy_get_automation_run",
] as const;

export const PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS = [
  {
    description: "List organization automations, optionally filtered by status.",
    mutating: false,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Create one automation with 1-150 steps including a trigger step. Automations start disabled unless enabled.",
    mutating: true,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one automation by ID.",
    mutating: false,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Update one automation name, status, steps, or connections.",
    mutating: true,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one automation and its run history.",
    mutating: true,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Duplicate one automation as a new disabled automation.",
    mutating: true,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[5],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Stop one automation by disabling it.",
    mutating: true,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[6],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List one automation's runs newest first.",
    mutating: false,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[7],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one automation run by ID.",
    mutating: false,
    name: PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[8],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type PaperBoyMcpAutomationServices = {
  create: (
    principal: ApiKeyPrincipal,
    input: Record<string, unknown>,
  ) => Promise<AutomationRecord>;
  delete: (principal: ApiKeyPrincipal, automationId: string) => Promise<void>;
  duplicate: (
    principal: ApiKeyPrincipal,
    automationId: string,
  ) => Promise<AutomationRecord>;
  get: (
    principal: ApiKeyPrincipal,
    automationId: string,
  ) => Promise<AutomationRecord>;
  getRun: (
    principal: ApiKeyPrincipal,
    automationId: string,
    runId: string,
  ) => Promise<AutomationRunRecord>;
  list: (
    principal: ApiKeyPrincipal,
    filter: { status?: string },
  ) => Promise<AutomationRecord[]>;
  listRuns: (
    principal: ApiKeyPrincipal,
    automationId: string,
  ) => Promise<AutomationRunRecord[]>;
  stop: (
    principal: ApiKeyPrincipal,
    automationId: string,
  ) => Promise<AutomationRecord>;
  update: (
    principal: ApiKeyPrincipal,
    automationId: string,
    input: Record<string, unknown>,
  ) => Promise<AutomationRecord>;
};

const automationSchema = z.object({
  connections: z.array(z.unknown()),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["enabled", "disabled"]),
  steps: z.array(z.unknown()),
  triggerEvent: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
});

const runSchema = z.object({
  automationId: z.string().uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().uuid(),
  occurrenceId: z.string().uuid().nullable(),
  status: z.enum(["completed", "failed"]),
  updatedAt: z.iso.datetime({ offset: true }),
});

const metadataSchema = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

const listOutput = z.object({ ...metadataSchema, automations: z.array(automationSchema) });
const automationOutput = z.object({ ...metadataSchema, automation: automationSchema });
const deleteOutput = z.object({
  ...metadataSchema,
  automationId: z.string().uuid(),
  deleted: z.literal(true),
});
const runsOutput = z.object({ ...metadataSchema, runs: z.array(runSchema) });
const runOutput = z.object({ ...metadataSchema, run: runSchema });

const automationIdInput = z.object({ automationId: z.string().uuid() }).strict();
const automationInput = z
  .object({
    connections: z.array(z.unknown()).optional(),
    name: z.string().min(1).max(120),
    status: z.enum(["enabled", "disabled"]).default("disabled"),
    steps: z.array(z.unknown()).min(1).max(150),
  })
  .strict();
const automationUpdateInput = z
  .object({
    automationId: z.string().uuid(),
    connections: z.array(z.unknown()).optional(),
    name: z.string().min(1).max(120).optional(),
    status: z.enum(["enabled", "disabled"]).optional(),
    steps: z.array(z.unknown()).min(1).max(150).optional(),
  })
  .strict();

function serializeAutomation(record: AutomationRecord) {
  return {
    connections: record.connections,
    createdAt: protocolTimestamp(record.createdAt),
    id: record.id,
    name: record.name,
    status: record.status,
    steps: record.steps,
    triggerEvent: record.triggerEvent,
    updatedAt: protocolTimestamp(record.updatedAt),
  };
}

function serializeRun(record: AutomationRunRecord) {
  return {
    automationId: record.automationId,
    createdAt: protocolTimestamp(record.createdAt),
    id: record.id,
    occurrenceId: record.occurrenceId,
    status: record.status,
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
  let message = "The automation operation failed.";

  if (error instanceof AuthorizationError) {
    message =
      "The API key creator's current role does not allow this automation operation.";
  } else if (error instanceof AutomationError) {
    switch (error.code) {
      case "MEMBERSHIP_REQUIRED":
        message = "Create a new API key from a current organization owner or admin.";
        break;
      case "AUTOMATION_NOT_FOUND":
      case "RUN_NOT_FOUND":
        message = "No automation or run with that ID exists in this organization.";
        break;
      case "AUTOMATION_EXISTS":
        message = "An automation with that name already exists in this organization.";
        break;
      default:
        message = error.issues[0]?.message ?? "Check the automation fields.";
    }
  } else {
    console.error("PaperBoy MCP automation operation failed.");
  }

  return { content: [{ text: message, type: "text" as const }], isError: true };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ text: JSON.stringify(output, null, 2), type: "text" as const }],
    structuredContent: output,
  };
}

export function registerPaperBoyAutomationTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpAutomationServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[0],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[0].description,
      inputSchema: z.object({ status: z.enum(["enabled", "disabled"]).optional() }).strict(),
      outputSchema: listOutput,
      title: "List PaperBoy automations",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ status }: { status?: "enabled" | "disabled" }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const automations = await input.services.list(principal, {
          ...(status ? { status } : {}),
        });
        return successResult({
          ...metadata(),
          automations: automations.map(serializeAutomation),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[1],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[1].description,
      inputSchema: automationInput,
      outputSchema: automationOutput,
      title: "Create PaperBoy automation",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
     
    async (args: any) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const automation = await input.services.create(principal, args);
        return successResult({
          ...metadata(),
          automation: serializeAutomation(automation),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[2],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[2].description,
      inputSchema: automationIdInput,
      outputSchema: automationOutput,
      title: "Get PaperBoy automation",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ automationId }: { automationId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const automation = await input.services.get(principal, automationId);
        return successResult({
          ...metadata(),
          automation: serializeAutomation(automation),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[3],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[3].description,
      inputSchema: automationUpdateInput,
      outputSchema: automationOutput,
      title: "Update PaperBoy automation",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
     
    async ({ automationId, ...payload }: any) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const automation = await input.services.update(
          principal,
          automationId,
          payload,
        );
        return successResult({
          ...metadata(),
          automation: serializeAutomation(automation),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[4],
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[4].description,
      inputSchema: automationIdInput,
      outputSchema: deleteOutput,
      title: "Delete PaperBoy automation",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ automationId }: { automationId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        await input.services.delete(principal, automationId);
        return successResult({
          ...metadata(),
          automationId,
          deleted: true as const,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[5],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[5].description,
      inputSchema: automationIdInput,
      outputSchema: automationOutput,
      title: "Duplicate PaperBoy automation",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ automationId }: { automationId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const automation = await input.services.duplicate(principal, automationId);
        return successResult({
          ...metadata(),
          automation: serializeAutomation(automation),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[6],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[6].description,
      inputSchema: automationIdInput,
      outputSchema: automationOutput,
      title: "Stop PaperBoy automation",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ automationId }: { automationId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const automation = await input.services.stop(principal, automationId);
        return successResult({
          ...metadata(),
          automation: serializeAutomation(automation),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[7],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[7].description,
      inputSchema: automationIdInput,
      outputSchema: runsOutput,
      title: "List PaperBoy automation runs",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({ automationId }: { automationId: string }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const runs = await input.services.listRuns(principal, automationId);
        return successResult({
          ...metadata(),
          runs: runs.map(serializeRun),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  input.server.registerTool(
    PAPERBOY_AUTOMATION_MCP_TOOL_NAMES[8],
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description: PAPERBOY_AUTOMATION_MCP_TOOL_DEFINITIONS[8].description,
      inputSchema: z
        .object({ automationId: z.string().uuid(), runId: z.string().uuid() })
        .strict(),
      outputSchema: runOutput,
      title: "Get PaperBoy automation run",
      _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
    },
    async ({
      automationId,
      runId,
    }: {
      automationId: string;
      runId: string;
    }) => {
      const principal = await input.authorize();
      if (!principal) return unauthorizedResult();

      try {
        const run = await input.services.getRun(principal, automationId, runId);
        return successResult({ ...metadata(), run: serializeRun(run) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
