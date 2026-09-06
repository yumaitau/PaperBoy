import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  automationRuns,
  automations,
  contacts,
  customEventOccurrences,
  customEvents,
  orgMembers,
} from "@/db/schema";
import {
  isOrgRole,
  requirePermission,
  type OrgPermission,
} from "@/lib/authorization";
import {
  CustomEventError,
  parseCreateEventInput,
  parseSendEventInput,
  parseUpdateEventInput,
  validateEventPayload,
  type EventDefinitionRecord,
  type EventOccurrenceRecord,
} from "@/lib/custom-event-core";

export type { EventDefinitionRecord, EventOccurrenceRecord };
import { isPostgresErrorCode } from "@/lib/postgres-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const definitionSelection = {
  createdAt: customEvents.createdAt,
  id: customEvents.id,
  name: customEvents.name,
  schema: customEvents.schema,
  updatedAt: customEvents.updatedAt,
};

function isUniqueViolation(error: unknown): boolean {
  return isPostgresErrorCode(error, "23505");
}

async function requireEventsPermission(input: {
  actorUserId: string | null;
  orgId: string;
  permission: OrgPermission;
}): Promise<string> {
  if (!input.actorUserId) {
    throw new CustomEventError("MEMBERSHIP_REQUIRED");
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
    throw new CustomEventError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, input.permission);
  return input.actorUserId;
}

function toDefinition(row: {
  createdAt: Date;
  id: string;
  name: string;
  schema: Record<string, "string" | "number" | "boolean" | "date"> | null;
  updatedAt: Date;
}): EventDefinitionRecord {
  return row;
}

async function resolveDefinition(
  orgId: string,
  identifier: string,
): Promise<{ id: string | null; name: string; schema: EventDefinitionRecord["schema"] }> {
  if (UUID_PATTERN.test(identifier)) {
    const [row] = await db
      .select({ id: customEvents.id, name: customEvents.name, schema: customEvents.schema })
      .from(customEvents)
      .where(and(eq(customEvents.id, identifier), eq(customEvents.orgId, orgId)))
      .limit(1);

    if (!row) {
      throw new CustomEventError("EVENT_NOT_FOUND");
    }

    return row;
  }

  const name = identifier.trim();
  const [row] = await db
    .select({ id: customEvents.id, name: customEvents.name, schema: customEvents.schema })
    .from(customEvents)
    .where(
      and(
        eq(customEvents.orgId, orgId),
        sql`lower(${customEvents.name}) = lower(${name})`,
      ),
    )
    .limit(1);

  if (!row) {
    throw new CustomEventError("EVENT_NOT_FOUND");
  }

  return row;
}

export async function createEvent(input: {
  actorUserId: string | null;
  orgId: string;
  payload: unknown;
}): Promise<EventDefinitionRecord> {
  await requireEventsPermission({ ...input, permission: "events.manage" });
  const definition = parseCreateEventInput(input.payload);

  try {
    const [created] = await db
      .insert(customEvents)
      .values({ name: definition.name, orgId: input.orgId, schema: definition.schema })
      .returning(definitionSelection);

    if (!created) {
      throw new CustomEventError("EVENT_NOT_FOUND");
    }

    return toDefinition(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CustomEventError("EVENT_EXISTS");
    }

    throw error;
  }
}

export async function listEvents(input: {
  actorUserId: string | null;
  limit?: number;
  orgId: string;
}): Promise<EventDefinitionRecord[]> {
  await requireEventsPermission({ ...input, permission: "events.read" });
  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));

  const rows = await db
    .select(definitionSelection)
    .from(customEvents)
    .where(eq(customEvents.orgId, input.orgId))
    .orderBy(asc(customEvents.name))
    .limit(limit);

  return rows.map(toDefinition);
}

export async function getEvent(input: {
  actorUserId: string | null;
  identifier: string;
  orgId: string;
}): Promise<EventDefinitionRecord> {
  await requireEventsPermission({ ...input, permission: "events.read" });
  const resolved = await resolveDefinition(input.orgId, input.identifier);

  const [row] = await db
    .select(definitionSelection)
    .from(customEvents)
    .where(and(eq(customEvents.id, resolved.id as string), eq(customEvents.orgId, input.orgId)))
    .limit(1);

  if (!row) {
    throw new CustomEventError("EVENT_NOT_FOUND");
  }

  return toDefinition(row);
}

export async function updateEvent(input: {
  actorUserId: string | null;
  identifier: string;
  orgId: string;
  payload: unknown;
}): Promise<EventDefinitionRecord> {
  await requireEventsPermission({ ...input, permission: "events.manage" });
  const resolved = await resolveDefinition(input.orgId, input.identifier);
  const definition = parseUpdateEventInput(input.payload);

  try {
    const [updated] = await db
      .update(customEvents)
      .set({ ...definition, updatedAt: new Date() })
      .where(
        and(
          eq(customEvents.id, resolved.id as string),
          eq(customEvents.orgId, input.orgId),
        ),
      )
      .returning(definitionSelection);

    if (!updated) {
      throw new CustomEventError("EVENT_NOT_FOUND");
    }

    return toDefinition(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CustomEventError("EVENT_EXISTS");
    }

    throw error;
  }
}

export async function deleteEvent(input: {
  actorUserId: string | null;
  identifier: string;
  orgId: string;
}): Promise<void> {
  await requireEventsPermission({ ...input, permission: "events.manage" });
  const resolved = await resolveDefinition(input.orgId, input.identifier);

  const deleted = await db
    .delete(customEvents)
    .where(
      and(
        eq(customEvents.id, resolved.id as string),
        eq(customEvents.orgId, input.orgId),
      ),
    )
    .returning({ id: customEvents.id });

  if (deleted.length !== 1) {
    throw new CustomEventError("EVENT_NOT_FOUND");
  }
}

export async function sendCustomEvent(input: {
  actorUserId: string | null;
  now?: Date;
  orgId: string;
  payload: unknown;
}): Promise<EventOccurrenceRecord> {
  await requireEventsPermission({ ...input, permission: "events.manage" });
  const definition = parseSendEventInput(input.payload);
  const now = input.now ?? new Date();

  let contactEmail: string | null = null;

  if (definition.contactId) {
    const [contact] = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(
        and(eq(contacts.id, definition.contactId), eq(contacts.orgId, input.orgId)),
      )
      .limit(1);

    if (!contact) {
      throw new CustomEventError("VALIDATION_ERROR", [
        { field: "contact_id", message: "No contact with that ID exists in this organization." },
      ]);
    }

    contactEmail = contact.email;
  } else if (definition.email) {
    contactEmail = definition.email;
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: customEvents.id, name: customEvents.name, schema: customEvents.schema })
      .from(customEvents)
      .where(
        and(
          eq(customEvents.orgId, input.orgId),
          sql`lower(${customEvents.name}) = lower(${definition.event})`,
        ),
      )
      .limit(1);

    if (existing) {
      const issues = validateEventPayload(existing.schema, definition.payload);
      if (issues.length > 0) {
        throw new CustomEventError("VALIDATION_ERROR", issues.slice(0, 100));
      }
    }

    const [occurrence] = await tx
      .insert(customEventOccurrences)
      .values({
        contactEmail,
        createdAt: now,
        eventId: existing?.id ?? null,
        name: existing?.name ?? definition.event,
        orgId: input.orgId,
        payload: definition.payload,
      })
      .returning({
        contactEmail: customEventOccurrences.contactEmail,
        createdAt: customEventOccurrences.createdAt,
        eventId: customEventOccurrences.eventId,
        id: customEventOccurrences.id,
        name: customEventOccurrences.name,
        payload: customEventOccurrences.payload,
      });

    if (!occurrence) {
      throw new CustomEventError("EVENT_NOT_FOUND");
    }

    const triggers = await tx
      .select({ id: automations.id })
      .from(automations)
      .where(
        and(
          eq(automations.orgId, input.orgId),
          eq(automations.status, "enabled"),
          sql`lower(${automations.triggerEvent}) = lower(${occurrence.name})`,
        ),
      );

    for (const trigger of triggers) {
      await tx.insert(automationRuns).values({
        automationId: trigger.id,
        createdAt: now,
        occurrenceId: occurrence.id,
        orgId: input.orgId,
        status: "completed",
        updatedAt: now,
      });
    }

    return occurrence;
  });
}

export async function listEventOccurrences(input: {
  actorUserId: string | null;
  limit?: number;
  orgId: string;
}): Promise<EventOccurrenceRecord[]> {
  await requireEventsPermission({ ...input, permission: "events.read" });
  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));

  return db
    .select({
      contactEmail: customEventOccurrences.contactEmail,
      createdAt: customEventOccurrences.createdAt,
      eventId: customEventOccurrences.eventId,
      id: customEventOccurrences.id,
      name: customEventOccurrences.name,
      payload: customEventOccurrences.payload,
    })
    .from(customEventOccurrences)
    .where(eq(customEventOccurrences.orgId, input.orgId))
    .orderBy(desc(customEventOccurrences.createdAt))
    .limit(limit);
}
