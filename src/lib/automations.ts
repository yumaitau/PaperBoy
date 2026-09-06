import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  automationRuns,
  automations,
  orgMembers,
} from "@/db/schema";
import {
  isOrgRole,
  requirePermission,
  type OrgPermission,
} from "@/lib/authorization";
import {
  AutomationError,
  parseCreateAutomationInput,
  parseUpdateAutomationInput,
  type AutomationRecord,
  type AutomationRunRecord,
} from "@/lib/automation-core";

export type { AutomationRecord, AutomationRunRecord };
import { isPostgresErrorCode } from "@/lib/postgres-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const automationSelection = {
  connections: automations.connections,
  createdAt: automations.createdAt,
  id: automations.id,
  name: automations.name,
  status: automations.status,
  steps: automations.steps,
  triggerEvent: automations.triggerEvent,
  updatedAt: automations.updatedAt,
};

const runSelection = {
  automationId: automationRuns.automationId,
  createdAt: automationRuns.createdAt,
  id: automationRuns.id,
  occurrenceId: automationRuns.occurrenceId,
  status: automationRuns.status,
  updatedAt: automationRuns.updatedAt,
};

async function requireAutomationsPermission(input: {
  actorUserId: string | null;
  orgId: string;
  permission: OrgPermission;
}): Promise<void> {
  if (!input.actorUserId) {
    throw new AutomationError("MEMBERSHIP_REQUIRED");
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
    throw new AutomationError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, input.permission);
}

function toAutomation(row: {
  connections: unknown[];
  createdAt: Date;
  id: string;
  name: string;
  status: string;
  steps: unknown[];
  triggerEvent: string;
  updatedAt: Date;
}): AutomationRecord {
  return {
    ...row,
    status: row.status as "enabled" | "disabled",
  };
}

async function readAutomation(
  orgId: string,
  automationId: string,
): Promise<{ id: string }> {
  if (!UUID_PATTERN.test(automationId)) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  const [row] = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.orgId, orgId)))
    .limit(1);

  if (!row) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  return row;
}

export async function createAutomation(input: {
  actorUserId: string | null;
  orgId: string;
  payload: unknown;
}): Promise<AutomationRecord> {
  await requireAutomationsPermission({ ...input, permission: "automations.manage" });
  const definition = parseCreateAutomationInput(input.payload);

  const [created] = await db
    .insert(automations)
    .values({
      connections: definition.connections,
      name: definition.name,
      orgId: input.orgId,
      status: definition.status,
      steps: definition.steps,
      triggerEvent: definition.triggerEvent,
    })
    .returning(automationSelection);

  if (!created) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  return toAutomation(created);
}

export async function listAutomations(input: {
  actorUserId: string | null;
  orgId: string;
  status?: string | null;
}): Promise<AutomationRecord[]> {
  await requireAutomationsPermission({ ...input, permission: "automations.read" });

  if (input.status && input.status !== "enabled" && input.status !== "disabled") {
    throw new AutomationError("VALIDATION_ERROR", [
      { field: "status", message: "Must be enabled or disabled." },
    ]);
  }

  const rows = await db
    .select(automationSelection)
    .from(automations)
    .where(
      and(
        eq(automations.orgId, input.orgId),
        ...(input.status ? [eq(automations.status, input.status)] : []),
      ),
    )
    .orderBy(asc(automations.createdAt));

  return rows.map(toAutomation);
}

export async function getAutomation(input: {
  actorUserId: string | null;
  automationId: string;
  orgId: string;
}): Promise<AutomationRecord> {
  await requireAutomationsPermission({ ...input, permission: "automations.read" });
  const { id } = await readAutomation(input.orgId, input.automationId);

  const [row] = await db
    .select(automationSelection)
    .from(automations)
    .where(eq(automations.id, id))
    .limit(1);

  if (!row) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  return toAutomation(row);
}

export async function updateAutomation(input: {
  actorUserId: string | null;
  automationId: string;
  orgId: string;
  payload: unknown;
}): Promise<AutomationRecord> {
  await requireAutomationsPermission({ ...input, permission: "automations.manage" });
  const { id } = await readAutomation(input.orgId, input.automationId);
  const definition = parseUpdateAutomationInput(input.payload);

  const [updated] = await db
    .update(automations)
    .set({
      ...(definition.name !== undefined ? { name: definition.name } : {}),
      ...(definition.status !== undefined ? { status: definition.status } : {}),
      ...(definition.steps !== undefined ? { steps: definition.steps } : {}),
      ...(definition.connections !== undefined
        ? { connections: definition.connections }
        : {}),
      ...(definition.triggerEvent !== undefined
        ? { triggerEvent: definition.triggerEvent }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, id))
    .returning(automationSelection);

  if (!updated) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  return toAutomation(updated);
}

export async function deleteAutomation(input: {
  actorUserId: string | null;
  automationId: string;
  orgId: string;
}): Promise<void> {
  await requireAutomationsPermission({ ...input, permission: "automations.manage" });
  const { id } = await readAutomation(input.orgId, input.automationId);

  const deleted = await db
    .delete(automations)
    .where(eq(automations.id, id))
    .returning({ id: automations.id });

  if (deleted.length !== 1) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }
}

export async function duplicateAutomation(input: {
  actorUserId: string | null;
  automationId: string;
  orgId: string;
}): Promise<AutomationRecord> {
  await requireAutomationsPermission({ ...input, permission: "automations.manage" });
  const { id } = await readAutomation(input.orgId, input.automationId);

  const [source] = await db
    .select(automationSelection)
    .from(automations)
    .where(eq(automations.id, id))
    .limit(1);

  if (!source) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  const [created] = await db
    .insert(automations)
    .values({
      connections: source.connections,
      name: `Copy of ${source.name}`.slice(0, 120),
      orgId: input.orgId,
      status: "disabled",
      steps: source.steps,
      triggerEvent: source.triggerEvent,
    })
    .returning(automationSelection);

  if (!created) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  return toAutomation(created);
}

export async function stopAutomation(input: {
  actorUserId: string | null;
  automationId: string;
  orgId: string;
}): Promise<AutomationRecord> {
  await requireAutomationsPermission({ ...input, permission: "automations.manage" });
  const { id } = await readAutomation(input.orgId, input.automationId);

  const [updated] = await db
    .update(automations)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(automations.id, id))
    .returning(automationSelection);

  if (!updated) {
    throw new AutomationError("AUTOMATION_NOT_FOUND");
  }

  return { ...toAutomation(updated), connections: [] };
}

function toRun(row: {
  automationId: string;
  createdAt: Date;
  id: string;
  occurrenceId: string | null;
  status: string;
  updatedAt: Date;
}): AutomationRunRecord {
  return { ...row, status: row.status as "completed" | "failed" };
}

export async function listAutomationRuns(input: {
  actorUserId: string | null;
  automationId: string;
  limit?: number;
  orgId: string;
}): Promise<AutomationRunRecord[]> {
  await requireAutomationsPermission({ ...input, permission: "automations.read" });
  const { id } = await readAutomation(input.orgId, input.automationId);
  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));

  const rows = await db
    .select(runSelection)
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.automationId, id),
        eq(automationRuns.orgId, input.orgId),
      ),
    )
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit);

  return rows.map(toRun);
}

export async function getAutomationRun(input: {
  actorUserId: string | null;
  automationId: string;
  orgId: string;
  runId: string;
}): Promise<AutomationRunRecord> {
  await requireAutomationsPermission({ ...input, permission: "automations.read" });
  const { id } = await readAutomation(input.orgId, input.automationId);

  if (!UUID_PATTERN.test(input.runId)) {
    throw new AutomationError("RUN_NOT_FOUND");
  }

  const [row] = await db
    .select(runSelection)
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.id, input.runId),
        eq(automationRuns.automationId, id),
        eq(automationRuns.orgId, input.orgId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AutomationError("RUN_NOT_FOUND");
  }

  return toRun(row);
}
