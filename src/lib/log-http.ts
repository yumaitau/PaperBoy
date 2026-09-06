import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError, requireKeyScope } from "@/lib/authorization";
import {
  getRequestLog,
  listRequestLogs,
  RequestLogError,
  type RequestLogRecord,
} from "@/lib/request-logs";

export type LogHttpServices = {
  get: (
    principal: ApiKeyPrincipal,
    logId: string,
  ) => Promise<RequestLogRecord>;
  list: (
    principal: ApiKeyPrincipal,
    filter: { after?: string; before?: string; limit?: number },
  ) => Promise<RequestLogRecord[]>;
};

export type LogHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: LogHttpServices;
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

function failure(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return json(
      {
        error: {
          code: "forbidden",
          message:
            "The API key creator's current role does not allow reading logs.",
        },
      },
      403,
    );
  }

  if (error instanceof RequestLogError) {
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

    if (error.code === "LOG_NOT_FOUND") {
      return json(
        {
          error: {
            code: "log_not_found",
            message: "No log with that ID exists in this organization.",
          },
        },
        404,
      );
    }

    return json(
      {
        error: {
          code: "validation_error",
          fields: error.issues,
          message: "Correct the invalid log fields and try again.",
        },
      },
      422,
    );
  }

  console.error("PaperBoy log operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The log operation failed.",
      },
    },
    500,
  );
}

function serialize(record: {
  apiKeyId: string | null;
  createdAt: Date;
  durationMs: number;
  environment: string | null;
  id: string;
  method: string;
  orgId: string | null;
  path: string;
  status: number;
  userAgent: string | null;
}) {
  return {
    api_key_id: record.apiKeyId,
    created_at: record.createdAt.toISOString(),
    duration_ms: record.durationMs,
    environment: record.environment,
    id: record.id,
    method: record.method,
    object: "log",
    path: record.path,
    response_status: record.status,
    user_agent: record.userAgent,
  };
}

function actorUserId(principal: ApiKeyPrincipal): string {
  if (!principal.actorUserId) {
    throw new RequestLogError("MEMBERSHIP_REQUIRED");
  }

  return principal.actorUserId;
}

function scoped(principal: ApiKeyPrincipal): string {
  requireKeyScope(principal.scopes, "logs.read");
  return actorUserId(principal);
}

export const logApiServices: LogHttpServices = {
  get: (principal, logId) =>
    getRequestLog({
      actorUserId: scoped(principal),
      logId,
      orgId: principal.orgId,
    }),
  list: (principal, filter) =>
    listRequestLogs({
      actorUserId: scoped(principal),
      after: filter.after,
      before: filter.before,
      limit: filter.limit,
      orgId: principal.orgId,
    }),
};

async function authenticated(
  request: Request,
  dependencies: LogHttpDependencies,
): Promise<ApiKeyPrincipal | Response> {
  return (await dependencies.authenticate(request)) ?? unauthorized();
}

export async function handleListLogsRequest(
  request: Request,
  dependencies: LogHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const query = new URL(request.url).searchParams;
    const limit = Number(query.get("limit"));
    const logs = (await dependencies.services.list(principal, {
      ...(query.get("after") ? { after: query.get("after") as string } : {}),
      ...(query.get("before") ? { before: query.get("before") as string } : {}),
      ...(Number.isInteger(limit) && limit >= 1
        ? { limit: Math.min(limit, 100) }
        : {}),
    })) as Parameters<typeof serialize>[0][];
    return json({ data: logs.map(serialize), object: "list" }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetLogRequest(
  request: Request,
  logId: string,
  dependencies: LogHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const log = (await dependencies.services.get(
      principal,
      logId,
    )) as Parameters<typeof serialize>[0];
    return json(serialize(log), 200);
  } catch (error) {
    return failure(error);
  }
}
