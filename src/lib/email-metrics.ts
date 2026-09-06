import { sql } from "drizzle-orm";
import { db } from "@/db";
import { orgMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  isOrgRole,
  requirePermission,
} from "@/lib/authorization";

export const EMAIL_METRICS = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "failed",
] as const;

export type EmailMetric = (typeof EMAIL_METRICS)[number];

export const METRIC_DIMENSIONS = ["period", "domain", "email", "broadcast"] as const;

export type MetricDimension = (typeof METRIC_DIMENSIONS)[number];

export const METRIC_GRANULARITIES = ["hourly", "daily", "weekly", "monthly"] as const;

export type MetricGranularity = (typeof METRIC_GRANULARITIES)[number];

export class EmailMetricsError extends Error {
  constructor(
    readonly code: "MEMBERSHIP_REQUIRED" | "VALIDATION_ERROR",
    readonly issues: { field: string; message: string }[] = [],
  ) {
    super(code);
    this.name = "EmailMetricsError";
  }
}

export type MetricsRow = {
  data: { metric: string; value: number }[];
  dimensions: Record<string, string | null>;
};

export type EmailMetricsResult = {
  endDate: Date;
  granularity: MetricGranularity;
  startDate: Date;
  timezone: string;
  totals: Record<string, number>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: "Use an ISO 8601 date or datetime." },
    ]);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: "Use an ISO 8601 date or datetime." },
    ]);
  }

  return date;
}

function parseList(
  value: unknown,
  field: string,
  allowed: readonly string[],
): string[] | null {
  if (value === undefined || value === null || value === "") return null;

  const items =
    typeof value === "string"
      ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
      : Array.isArray(value)
        ? value.flatMap((entry) =>
            typeof entry === "string"
              ? entry.split(",").map((part) => part.trim()).filter(Boolean)
              : [],
          )
        : null;

  if (!items) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: "Use a comma-separated list." },
    ]);
  }

  const unknown = items.filter((item) => !allowed.includes(item));
  if (unknown.length > 0) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: `Unknown values: ${unknown.join(", ")}.` },
    ]);
  }

  return [...new Set(items)];
}

function parseUuidList(value: unknown, field: string, max = 100): string[] | null {
  if (value === undefined || value === null || value === "") return null;

  const items =
    typeof value === "string"
      ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
      : Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : null;

  if (!items) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: "Use a comma-separated list." },
    ]);
  }

  if (items.length > max) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: `Provide at most ${max} IDs.` },
    ]);
  }

  const invalid = items.filter((item) => !UUID_PATTERN.test(item));
  if (invalid.length > 0) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field, message: "Each ID must be a valid UUID." },
    ]);
  }

  return [...new Set(items)];
}

export type MetricsQuery = {
  broadcastIds: string[] | null;
  dimensions: MetricDimension[];
  domainIds: string[] | null;
  emailIds: string[] | null;
  endDate: Date;
  granularity: MetricGranularity;
  metrics: EmailMetric[];
  startDate: Date;
  timezone: string;
};

export function parseMetricsQuery(value: {
  broadcast_id?: unknown;
  dimensions?: unknown;
  domain_id?: unknown;
  email_id?: unknown;
  end_date?: unknown;
  granularity?: unknown;
  metrics?: unknown;
  start_date?: unknown;
  timezone?: unknown;
}): MetricsQuery {
  const now = new Date();
  const endDate = parseDate(value.end_date, "end_date") ?? now;
  const defaultStart = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startDate = parseDate(value.start_date, "start_date") ?? defaultStart;

  if (startDate > endDate) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field: "start_date", message: "Start date must be on or before end date." },
    ]);
  }

  const granularity =
    value.granularity === undefined ||
    value.granularity === null ||
    value.granularity === ""
      ? "daily"
      : value.granularity;

  if (
    typeof granularity !== "string" ||
    !(METRIC_GRANULARITIES as readonly string[]).includes(granularity)
  ) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field: "granularity", message: "Use hourly, daily, weekly, or monthly." },
    ]);
  }

  const timezone =
    value.timezone === undefined || value.timezone === null || value.timezone === ""
      ? "UTC"
      : value.timezone;

  if (typeof timezone !== "string") {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field: "timezone", message: "Use an IANA timezone name." },
    ]);
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      { field: "timezone", message: "Use an IANA timezone name." },
    ]);
  }

  const metrics =
    parseList(value.metrics, "metrics", EMAIL_METRICS) ?? [...EMAIL_METRICS];
  const dimensions =
    (parseList(value.dimensions, "dimensions", METRIC_DIMENSIONS) ??
      []) as MetricDimension[];

  if (dimensions.includes("email") && dimensions.includes("broadcast")) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      {
        field: "dimensions",
        message: "Email and broadcast cannot be combined.",
      },
    ]);
  }

  const emailIds = parseUuidList(value.email_id, "email_id");
  const broadcastIds = parseUuidList(value.broadcast_id, "broadcast_id");
  const domainIds = parseUuidList(value.domain_id, "domain_id");

  if (emailIds && broadcastIds && dimensions.includes("broadcast")) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      {
        field: "email_id",
        message: "Email IDs cannot be combined with the broadcast dimension.",
      },
    ]);
  }

  if (broadcastIds && dimensions.includes("email")) {
    throw new EmailMetricsError("VALIDATION_ERROR", [
      {
        field: "broadcast_id",
        message: "Broadcast IDs cannot be combined with the email dimension.",
      },
    ]);
  }

  return {
    broadcastIds,
    dimensions,
    domainIds,
    emailIds,
    endDate,
    granularity: granularity as MetricGranularity,
    metrics: metrics as EmailMetric[],
    startDate,
    timezone,
  };
}

export async function getEmailMetrics(input: {
  actorUserId: string | null;
  orgId: string;
  query: MetricsQuery;
}): Promise<EmailMetricsResult & { data: MetricsRow[] }> {
  if (!input.actorUserId) {
    throw new EmailMetricsError("MEMBERSHIP_REQUIRED");
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
    throw new EmailMetricsError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, "emails.metrics");

  const { query } = input;
  const bucket =
    query.granularity === "hourly"
      ? "hour"
      : query.granularity === "weekly"
        ? "week"
        : query.granularity === "monthly"
          ? "month"
          : "day";

  const conditions = [
    sql`"messages"."org_id" = ${input.orgId}`,
    sql`"messages"."created_at" >= ${query.startDate.toISOString()}`,
    sql`"messages"."created_at" <= ${query.endDate.toISOString()}`,
  ];

  if (query.emailIds) {
    conditions.push(sql`"messages"."id" = ANY(${query.emailIds})`);
  }

  if (query.domainIds) {
    conditions.push(sql`"messages"."domain_id" = ANY(${query.domainIds})`);
  }

  if (query.broadcastIds) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM jsonb_to_recordset("messages"."tags") AS tag("name" text, "value" text)
      WHERE tag."name" = 'broadcast_id' AND tag."value" = ANY(${query.broadcastIds})
    )`);
  }

  const where = sql.join(conditions, sql` AND `);
  const periodExpr =
    sql`date_trunc(${bucket}, "messages"."created_at" AT TIME ZONE ${query.timezone})`;
  const domainExpr = sql`lower(substring("messages"."from" from '@([^@>]+)>?$'))`;
  const broadcastExpr = sql`(
    SELECT tag."value" FROM jsonb_to_recordset("messages"."tags") AS tag("name" text, "value" text)
    WHERE tag."name" = 'broadcast_id' LIMIT 1
  )`;

  const groupColumns: string[] = [];
  if (query.dimensions.includes("period")) groupColumns.push("period");
  if (query.dimensions.includes("domain")) groupColumns.push("domain");
  if (query.dimensions.includes("email")) groupColumns.push("email");
  if (query.dimensions.includes("broadcast")) groupColumns.push("broadcast");

  const selects = [
    query.dimensions.includes("period")
      ? sql`(${periodExpr}) AS "period"`
      : sql`NULL AS "period"`,
    query.dimensions.includes("domain")
      ? sql`(${domainExpr}) AS "domain"`
      : sql`NULL AS "domain"`,
    query.dimensions.includes("email")
      ? sql`"messages"."id" AS "email"`
      : sql`NULL AS "email"`,
    query.dimensions.includes("broadcast")
      ? sql`(${broadcastExpr}) AS "broadcast"`
      : sql`NULL AS "broadcast"`,
    sql`count(*)::int AS "sent"`,
    sql`count(*) FILTER (WHERE "messages"."status" = 'failed')::int AS "failed"`,
    sql`count(DISTINCT "open_events"."message_id")::int AS "opened"`,
    sql`count(DISTINCT "click_events"."message_id")::int AS "clicked"`,
    sql`count(DISTINCT "delivered_events"."message_id")::int AS "delivered"`,
    sql`count(DISTINCT "bounce_events"."message_id")::int AS "bounced"`,
    sql`count(DISTINCT "complaint_events"."message_id")::int AS "complained"`,
  ];

  const groupBy =
    groupColumns.length > 0
      ? sql`GROUP BY ${sql.join(
          groupColumns.map((column) => sql.raw(`"${column}"`)),
          sql`, `,
        )}`
      : sql``;

  const rows = (await db.execute(sql`
    SELECT ${sql.join(selects, sql`, `)}
    FROM "messages"
    LEFT JOIN "events" AS "open_events"
      ON "open_events"."message_id" = "messages"."id" AND "open_events"."type" = 'opened'
    LEFT JOIN "events" AS "click_events"
      ON "click_events"."message_id" = "messages"."id" AND "click_events"."type" = 'clicked'
    LEFT JOIN "events" AS "delivered_events"
      ON "delivered_events"."message_id" = "messages"."id" AND "delivered_events"."type" = 'delivered'
    LEFT JOIN "events" AS "bounce_events"
      ON "bounce_events"."message_id" = "messages"."id" AND "bounce_events"."type" = 'bounced'
    LEFT JOIN "events" AS "complaint_events"
      ON "complaint_events"."message_id" = "messages"."id" AND "complaint_events"."type" = 'complained'
    WHERE ${where}
    ${groupBy}
    ORDER BY ${groupColumns.length > 0 ? sql.join(groupColumns.map((column) => sql.raw(`"${column}"`)), sql`, `) : sql`1`}
    LIMIT 10000
  `)) as unknown as Record<string, string | number | null>[];

  const totals: Record<string, number> = {};
  for (const metric of query.metrics) {
    totals[metric] = 0;
  }

  const data: MetricsRow[] = rows.map((row) => {
    const values = query.metrics.map((metric) => {
      const value = Number(row[metric] ?? 0);
      totals[metric] += value;
      return { metric, value };
    });

    return {
      data: values,
      dimensions: Object.fromEntries(
        groupColumns.map((column) => [column, row[column] == null ? null : String(row[column])]),
      ),
    };
  });

  return {
    data: query.dimensions.length > 0 ? data : [],
    endDate: query.endDate,
    granularity: query.granularity,
    startDate: query.startDate,
    timezone: query.timezone,
    totals,
  };
}
