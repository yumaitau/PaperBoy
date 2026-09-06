import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requestLogs } from "@/db/schema";
import {
  isOrgRole,
  requirePermission,
} from "@/lib/authorization";
import { orgMembers } from "@/db/schema";

export class RequestLogError extends Error {
  constructor(
    readonly code: "LOG_NOT_FOUND" | "MEMBERSHIP_REQUIRED" | "VALIDATION_ERROR",
    readonly issues: { field: string; message: string }[] = [],
  ) {
    super(code);
    this.name = "RequestLogError";
  }
}

export type RequestLogRecord = {
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
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const logSelection = {
  apiKeyId: requestLogs.apiKeyId,
  createdAt: requestLogs.createdAt,
  durationMs: requestLogs.durationMs,
  environment: requestLogs.environment,
  id: requestLogs.id,
  method: requestLogs.method,
  orgId: requestLogs.orgId,
  path: requestLogs.path,
  status: requestLogs.status,
  userAgent: requestLogs.userAgent,
};

export async function recordApiLog(input: {
  apiKeyId?: string | null;
  durationMs: number;
  environment?: string | null;
  method: string;
  orgId?: string | null;
  path: string;
  status: number;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const method = input.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(method)) {
      return;
    }

    await db.insert(requestLogs).values({
      apiKeyId: input.apiKeyId ?? null,
      durationMs: Math.max(0, Math.min(Math.round(input.durationMs), 3600000)),
      environment: input.environment ?? null,
      method,
      orgId: input.orgId ?? null,
      path: input.path.slice(0, 2048),
      status: input.status,
      userAgent: (input.userAgent ?? null)?.slice(0, 256) ?? null,
    });
  } catch {
    return;
  }
}

type ApiLogDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
};

export async function withApiLog<Dependencies extends ApiLogDependencies>(
  request: Request,
  dependencies: Dependencies,
  run: (scoped: Dependencies) => Promise<Response>,
): Promise<Response> {
  const startedAt = Date.now();
  const principal = await dependencies.authenticate(request);
  const scoped = {
    ...dependencies,
    authenticate: async () => principal,
  };

  let response: Response;
  try {
    response = await run(scoped);
  } catch (error) {
    const url = new URL(request.url);
    await recordApiLog({
      apiKeyId: principal?.apiKeyId ?? null,
      durationMs: Date.now() - startedAt,
      environment: principal?.environment ?? null,
      method: request.method,
      orgId: principal?.orgId ?? null,
      path: `${url.pathname}${url.search}`.slice(0, 2048),
      status: 0,
      userAgent: request.headers.get("user-agent"),
    });
    throw error;
  }

  void recordApiLog({
    apiKeyId: principal?.apiKeyId ?? null,
    durationMs: Date.now() - startedAt,
    environment: principal?.environment ?? null,
    method: request.method,
    orgId: principal?.orgId ?? null,
    path: `${new URL(request.url).pathname}${new URL(request.url).search}`.slice(0, 2048),
    status: response.status,
    userAgent: request.headers.get("user-agent"),
  }).catch(() => undefined);

  return response;
}

export async function listRequestLogs(input: {
  actorUserId: string | null;
  after?: string | null;
  before?: string | null;
  limit?: number;
  orgId: string;
}): Promise<RequestLogRecord[]> {
  if (!input.actorUserId) {
    throw new RequestLogError("MEMBERSHIP_REQUIRED");
  }

  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, input.orgId),
        eq(orgMembers.userId, input.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || !isOrgRole(membership.role)) {
    throw new RequestLogError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, "logs.read");
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));

  let cursor: { createdAt: Date; id: string } | null = null;
  const cursorId = input.after ?? input.before ?? null;
  if (cursorId) {
    if (!UUID_PATTERN.test(cursorId)) {
      throw new RequestLogError("VALIDATION_ERROR", [
        { field: input.after ? "after" : "before", message: "Provide a valid log UUID." },
      ]);
    }

    const [row] = await db
      .select({ createdAt: requestLogs.createdAt, id: requestLogs.id })
      .from(requestLogs)
      .where(
        and(eq(requestLogs.id, cursorId), eq(requestLogs.orgId, input.orgId)),
      )
      .limit(1);

    if (!row) {
      throw new RequestLogError("LOG_NOT_FOUND");
    }

    cursor = row;
  }

  const cursorCondition = cursor
    ? input.after
      ? sql`("request_logs"."created_at", "request_logs"."id") < (${cursor.createdAt.toISOString()}, ${cursor.id})`
      : sql`("request_logs"."created_at", "request_logs"."id") > (${cursor.createdAt.toISOString()}, ${cursor.id})`
    : null;

  const rows = await db
    .select(logSelection)
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.orgId, input.orgId),
        ...(cursorCondition ? [cursorCondition] : []),
      ),
    )
    .orderBy(desc(requestLogs.createdAt), desc(requestLogs.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return input.before ? page.reverse() : page;
}

export async function getRequestLog(input: {
  actorUserId: string | null;
  logId: string;
  orgId: string;
}): Promise<RequestLogRecord> {
  if (!input.actorUserId) {
    throw new RequestLogError("MEMBERSHIP_REQUIRED");
  }

  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, input.orgId),
        eq(orgMembers.userId, input.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || !isOrgRole(membership.role)) {
    throw new RequestLogError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, "logs.read");

  if (!UUID_PATTERN.test(input.logId)) {
    throw new RequestLogError("LOG_NOT_FOUND");
  }

  const [row] = await db
    .select(logSelection)
    .from(requestLogs)
    .where(
      and(eq(requestLogs.id, input.logId), eq(requestLogs.orgId, input.orgId)),
    )
    .limit(1);

  if (!row) {
    throw new RequestLogError("LOG_NOT_FOUND");
  }

  return row;
}
