import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError, requireKeyScope } from "@/lib/authorization";
import {
  createAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  getAutomationRun,
  listAutomationRuns,
  listAutomations,
  stopAutomation,
  updateAutomation,
  type AutomationRecord,
  type AutomationRunRecord,
} from "@/lib/automations";
import { AutomationError } from "@/lib/automation-core";

export type AutomationHttpServices = {
  create: (
    principal: ApiKeyPrincipal,
    payload: unknown,
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
    payload: unknown,
  ) => Promise<AutomationRecord>;
};

export type AutomationHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: AutomationHttpServices;
};

function json(data: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(data, {
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

export function automationFailure(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return json(
      {
        error: {
          code: "forbidden",
          message:
            "The API key creator's current role does not allow this automation operation.",
        },
      },
      403,
    );
  }

  if (error instanceof AutomationError) {
    if (error.code === "MEMBERSHIP_REQUIRED") {
      return json(
        {
          error: {
            code: "membership_required",
            message:
              "Create a new API key from a current organization owner or admin.",
          },
        },
        403,
      );
    }

    if (error.code === "AUTOMATION_NOT_FOUND" || error.code === "RUN_NOT_FOUND") {
      return json(
        {
          error: {
            code: "automation_not_found",
            message: "No automation or run with that ID exists in this organization.",
          },
        },
        404,
      );
    }

    if (error.code === "AUTOMATION_EXISTS") {
      return json(
        {
          error: {
            code: "automation_exists",
            message: "An automation with that name already exists in this organization.",
          },
        },
        409,
      );
    }

    return json(
      {
        error: {
          code: "validation_error",
          fields: error.issues,
          message: "Correct the invalid automation fields and try again.",
        },
      },
      422,
    );
  }

  console.error("PaperBoy automation operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The automation operation failed.",
      },
    },
    500,
  );
}

function serializeAutomation(record: AutomationRecord) {
  return {
    connections: record.connections,
    created_at: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    status: record.status,
    steps: record.steps,
    trigger_event: record.triggerEvent,
    updated_at: record.updatedAt.toISOString(),
  };
}

function serializeRun(record: AutomationRunRecord) {
  return {
    automation_id: record.automationId,
    created_at: record.createdAt.toISOString(),
    id: record.id,
    occurrence_id: record.occurrenceId,
    status: record.status,
    updated_at: record.updatedAt.toISOString(),
  };
}

function actorUserId(principal: ApiKeyPrincipal): string {
  if (!principal.actorUserId) {
    throw new AutomationError("MEMBERSHIP_REQUIRED");
  }

  return principal.actorUserId;
}

function scoped(
  principal: ApiKeyPrincipal,
  permission: "automations.manage" | "automations.read",
): string {
  requireKeyScope(principal.scopes, permission);
  return actorUserId(principal);
}

export const automationApiServices: AutomationHttpServices = {
  create: (principal, payload) =>
    createAutomation({
      actorUserId: scoped(principal, "automations.manage"),
      orgId: principal.orgId,
      payload,
    }),
  delete: (principal, automationId) =>
    deleteAutomation({
      actorUserId: scoped(principal, "automations.manage"),
      automationId,
      orgId: principal.orgId,
    }),
  duplicate: (principal, automationId) =>
    duplicateAutomation({
      actorUserId: scoped(principal, "automations.manage"),
      automationId,
      orgId: principal.orgId,
    }),
  get: (principal, automationId) =>
    getAutomation({
      actorUserId: scoped(principal, "automations.read"),
      automationId,
      orgId: principal.orgId,
    }),
  getRun: (principal, automationId, runId) =>
    getAutomationRun({
      actorUserId: scoped(principal, "automations.read"),
      automationId,
      orgId: principal.orgId,
      runId,
    }),
  list: (principal, filter) =>
    listAutomations({
      actorUserId: scoped(principal, "automations.read"),
      orgId: principal.orgId,
      status: filter.status,
    }),
  listRuns: (principal, automationId) =>
    listAutomationRuns({
      actorUserId: scoped(principal, "automations.read"),
      automationId,
      orgId: principal.orgId,
    }),
  stop: (principal, automationId) =>
    stopAutomation({
      actorUserId: scoped(principal, "automations.manage"),
      automationId,
      orgId: principal.orgId,
    }),
  update: (principal, automationId, payload) =>
    updateAutomation({
      actorUserId: scoped(principal, "automations.manage"),
      automationId,
      orgId: principal.orgId,
      payload,
    }),
};

async function authenticated(
  request: Request,
  dependencies: AutomationHttpDependencies,
): Promise<ApiKeyPrincipal | Response> {
  return (await dependencies.authenticate(request)) ?? unauthorized();
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SyntaxError("INVALID_JSON");
  }
}

function invalidJson(): Response {
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

export async function handleListAutomationsRequest(
  request: Request,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    const automations = await dependencies.services.list(principal, {
      ...(status ? { status } : {}),
    });
    return json({ data: automations.map(serializeAutomation) }, 200);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleCreateAutomationRequest(
  request: Request,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  let payload: unknown;
  try {
    payload = await requestBody(request);
  } catch {
    return invalidJson();
  }
  try {
    const created = await dependencies.services.create(
      principal,
      payload,
    );
    return json(serializeAutomation(created), 201);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleGetAutomationRequest(
  request: Request,
  automationId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const automation = await dependencies.services.get(
      principal,
      automationId,
    );
    return json(serializeAutomation(automation), 200);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleUpdateAutomationRequest(
  request: Request,
  automationId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  let payload: unknown;
  try {
    payload = await requestBody(request);
  } catch {
    return invalidJson();
  }
  try {
    const updated = await dependencies.services.update(
      principal,
      automationId,
      payload,
    );
    return json(serializeAutomation(updated), 200);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleDeleteAutomationRequest(
  request: Request,
  automationId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    await dependencies.services.delete(principal, automationId);
    return json({ deleted: true, id: automationId }, 200);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleDuplicateAutomationRequest(
  request: Request,
  automationId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const duplicated = await dependencies.services.duplicate(
      principal,
      automationId,
    );
    return json(serializeAutomation(duplicated), 201);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleStopAutomationRequest(
  request: Request,
  automationId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const stopped = await dependencies.services.stop(
      principal,
      automationId,
    );
    return json(serializeAutomation(stopped), 200);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleListAutomationRunsRequest(
  request: Request,
  automationId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const runs = await dependencies.services.listRuns(
      principal,
      automationId,
    );
    return json({ data: runs.map(serializeRun) }, 200);
  } catch (error) {
    return automationFailure(error);
  }
}

export async function handleGetAutomationRunRequest(
  request: Request,
  automationId: string,
  runId: string,
  dependencies: AutomationHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const run = await dependencies.services.getRun(
      principal,
      automationId,
      runId,
    );
    return json(serializeRun(run), 200);
  } catch (error) {
    return automationFailure(error);
  }
}
