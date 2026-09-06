import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contactImports,
  contactProperties,
  contactSegments,
  contactTopics,
  contacts,
  emailSuppressions,
  orgMembers,
  segments,
  topics,
} from "@/db/schema";
import {
  isOrgRole,
  requirePermission,
  type OrgPermission,
} from "@/lib/authorization";
import { parseCsvTable } from "@/lib/audience-core";
import {
  SegmentError,
  contactEmail,
  parseColumnMap,
  parseContactImportInput,
  parseCreateContactPropertyInput,
  parseCreateSegmentInput,
  parseCreateTopicInput,
  parseTopLevelCreateContactInput,
  parseTopLevelUpdateContactInput,
  parseUpdateContactPropertyInput,
  parseUpdateSegmentInput,
  parseUpdateTopicInput,
  type ContactImportRecord,
  type ContactPropertyRecord,
  type SegmentContactRecord,
  type SegmentRecord,
  type TopicRecord,
} from "@/lib/segment-core";
import { isPostgresErrorCode } from "@/lib/postgres-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const segmentSelection = {
  createdAt: segments.createdAt,
  id: segments.id,
  name: segments.name,
  updatedAt: segments.updatedAt,
};

const topicSelection = {
  createdAt: topics.createdAt,
  defaultSubscription: topics.defaultSubscription,
  description: topics.description,
  id: topics.id,
  name: topics.name,
  updatedAt: topics.updatedAt,
  visibility: topics.visibility,
};

const propertySelection = {
  createdAt: contactProperties.createdAt,
  fallbackValue: contactProperties.fallbackValue,
  id: contactProperties.id,
  key: contactProperties.key,
  type: contactProperties.type,
  updatedAt: contactProperties.updatedAt,
};

const contactSelection = {
  audienceId: contacts.audienceId,
  createdAt: contacts.createdAt,
  email: contacts.email,
  firstName: contacts.firstName,
  id: contacts.id,
  lastName: contacts.lastName,
  name: contacts.name,
  properties: contacts.properties,
  unsubscribedAt: contacts.unsubscribedAt,
  updatedAt: contacts.updatedAt,
};

const importSelection = {
  createdAt: contactImports.createdAt,
  createdRows: contactImports.createdRows,
  error: contactImports.error,
  fileName: contactImports.fileName,
  id: contactImports.id,
  skippedRows: contactImports.skippedRows,
  status: contactImports.status,
  totalRows: contactImports.totalRows,
  updatedAt: contactImports.updatedAt,
  updatedRows: contactImports.updatedRows,
};

function isUniqueViolation(error: unknown): boolean {
  return isPostgresErrorCode(error, "23505");
}

function requireId(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new SegmentError("SEGMENT_NOT_FOUND");
  }
}

async function requireOrganizationPermission(input: {
  actorUserId: string;
  orgId: string;
  permission: OrgPermission;
}): Promise<void> {
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
    throw new SegmentError("MEMBERSHIP_REQUIRED");
  }

  requirePermission(membership.role, input.permission);
}

async function contactCountForSegment(segmentId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(contactSegments)
    .where(eq(contactSegments.segmentId, segmentId));

  return Number(row?.total ?? 0);
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toSegmentRecord(
  row: { createdAt: Date; id: string; name: string; updatedAt: Date },
  contactCount: number,
): SegmentRecord {
  return { ...row, contactCount };
}

function toTopicRecord(row: {
  createdAt: Date;
  defaultSubscription: string;
  description: string | null;
  id: string;
  name: string;
  updatedAt: Date;
  visibility: string;
}): TopicRecord {
  return {
    ...row,
    defaultSubscription: row.defaultSubscription as "opt_in" | "opt_out",
    visibility: row.visibility as "public" | "private",
  };
}

function toPropertyRecord(row: {
  createdAt: Date;
  fallbackValue: string | null;
  id: string;
  key: string;
  type: string;
  updatedAt: Date;
}): ContactPropertyRecord {
  return { ...row, type: row.type as "string" | "number" };
}

function toImportRecord(row: {
  createdAt: Date;
  createdRows: number;
  error: string | null;
  fileName: string | null;
  id: string;
  skippedRows: number;
  status: string;
  totalRows: number;
  updatedAt: Date;
  updatedRows: number;
}): ContactImportRecord {
  return {
    ...row,
    status: row.status as ContactImportRecord["status"],
  };
}

async function membershipsForContact(
  contactId: string,
  orgId: string,
): Promise<Pick<SegmentContactRecord, "segments" | "topics">> {
  const [segmentRows, topicRows] = await Promise.all([
    db
      .select({ id: segments.id, name: segments.name })
      .from(contactSegments)
      .innerJoin(segments, eq(segments.id, contactSegments.segmentId))
      .where(
        and(
          eq(contactSegments.contactId, contactId),
          eq(segments.orgId, orgId),
        ),
      )
      .orderBy(asc(segments.name)),
    db
      .select({
        id: topics.id,
        name: topics.name,
        subscription: contactTopics.subscription,
      })
      .from(contactTopics)
      .innerJoin(topics, eq(topics.id, contactTopics.topicId))
      .where(
        and(eq(contactTopics.contactId, contactId), eq(topics.orgId, orgId)),
      )
      .orderBy(asc(topics.name)),
  ]);

  return {
    segments: segmentRows,
    topics: topicRows.map((row) => ({
      ...row,
      subscription: row.subscription as "opt_in" | "opt_out",
    })),
  };
}

async function segmentContactRecordTx(
  tx: Transaction,
  contactId: string,
  orgId: string,
): Promise<SegmentContactRecord> {
  const [row] = await tx
    .select(contactSelection)
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
    .limit(1);

  if (!row) {
    throw new SegmentError("CONTACT_NOT_FOUND");
  }

  const [segmentRows, topicRows] = await Promise.all([
    tx
      .select({ id: segments.id, name: segments.name })
      .from(contactSegments)
      .innerJoin(segments, eq(segments.id, contactSegments.segmentId))
      .where(
        and(
          eq(contactSegments.contactId, contactId),
          eq(segments.orgId, orgId),
        ),
      )
      .orderBy(asc(segments.name)),
    tx
      .select({
        id: topics.id,
        name: topics.name,
        subscription: contactTopics.subscription,
      })
      .from(contactTopics)
      .innerJoin(topics, eq(topics.id, contactTopics.topicId))
      .where(
        and(eq(contactTopics.contactId, contactId), eq(topics.orgId, orgId)),
      )
      .orderBy(asc(topics.name)),
  ]);

  return {
    ...row,
    segments: segmentRows,
    topics: topicRows.map((entry) => ({
      ...entry,
      subscription: entry.subscription as "opt_in" | "opt_out",
    })),
  };
}

async function segmentContactRecord(
  contactId: string,
  orgId: string,
): Promise<SegmentContactRecord> {
  const [row] = await db
    .select(contactSelection)
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
    .limit(1);

  if (!row) {
    throw new SegmentError("CONTACT_NOT_FOUND");
  }

  const membership = await membershipsForContact(contactId, orgId);

  return { ...row, ...membership };
}

async function resolveContactId(
  orgId: string,
  idOrEmail: string,
): Promise<string> {
  if (UUID_PATTERN.test(idOrEmail)) {
    const [row] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, idOrEmail), eq(contacts.orgId, orgId)))
      .limit(1);

    if (!row) {
      throw new SegmentError("CONTACT_NOT_FOUND");
    }

    return row.id;
  }

  const email = contactEmail(idOrEmail);

  if (!email) {
    throw new SegmentError("CONTACT_NOT_FOUND");
  }

  const rows = await db
    .select({ audienceId: contacts.audienceId, id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.orgId, orgId),
        sql`lower(${contacts.email}) = lower(${email})`,
      ),
    )
    .limit(10);

  if (rows.length === 0) {
    throw new SegmentError("CONTACT_NOT_FOUND");
  }

  return (
    rows.find((row) => row.audienceId === null)?.id ?? (rows[0]?.id as string)
  );
}

async function requireSegment(
  tx: Transaction,
  orgId: string,
  segmentId: string,
): Promise<void> {
  requireId(segmentId);
  const [row] = await tx
    .select({ id: segments.id })
    .from(segments)
    .where(and(eq(segments.id, segmentId), eq(segments.orgId, orgId)))
    .limit(1);

  if (!row) {
    throw new SegmentError("SEGMENT_NOT_FOUND");
  }
}

async function requireTopic(
  tx: Transaction,
  orgId: string,
  topicId: string,
): Promise<{ defaultSubscription: "opt_in" | "opt_out" }> {
  if (!UUID_PATTERN.test(topicId)) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }
  const [row] = await tx
    .select({ defaultSubscription: topics.defaultSubscription })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.orgId, orgId)))
    .limit(1);

  if (!row) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }

  return {
    defaultSubscription: row.defaultSubscription as "opt_in" | "opt_out",
  };
}

async function attachSegments(
  tx: Transaction,
  orgId: string,
  contactId: string,
  segmentIds: { id: string }[],
): Promise<void> {
  for (const segment of segmentIds) {
    await requireSegment(tx, orgId, segment.id);
    await tx
      .insert(contactSegments)
      .values({ contactId, segmentId: segment.id })
      .onConflictDoNothing();
  }
}

async function attachTopics(
  tx: Transaction,
  orgId: string,
  contactId: string,
  refs: { id: string; subscription: "opt_in" | "opt_out" }[],
): Promise<void> {
  for (const ref of refs) {
    await requireTopic(tx, orgId, ref.id);
    await tx
      .insert(contactTopics)
      .values({ contactId, subscription: ref.subscription, topicId: ref.id })
      .onConflictDoUpdate({
        set: { subscription: ref.subscription, updatedAt: new Date() },
        target: [contactTopics.contactId, contactTopics.topicId],
      });
  }
}

export async function createSegment(input: {
  actorUserId: string;
  orgId: string;
  payload: unknown;
}): Promise<SegmentRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "segments.manage",
  });
  const definition = parseCreateSegmentInput(input.payload);

  try {
    const [created] = await db
      .insert(segments)
      .values({ name: definition.name, orgId: input.orgId })
      .returning(segmentSelection);

    if (!created) {
      throw new SegmentError("SEGMENT_NOT_FOUND");
    }

    return toSegmentRecord(created, 0);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("SEGMENT_EXISTS");
    }

    throw error;
  }
}

export async function listSegments(input: {
  actorUserId: string;
  orgId: string;
}): Promise<SegmentRecord[]> {
  await requireOrganizationPermission({
    ...input,
    permission: "segments.read",
  });

  const rows = await db
    .select(segmentSelection)
    .from(segments)
    .where(eq(segments.orgId, input.orgId))
    .orderBy(asc(segments.name), asc(segments.id));

  return Promise.all(
    rows.map(async (row) => toSegmentRecord(row, await contactCountForSegment(row.id))),
  );
}

export async function getSegment(input: {
  actorUserId: string;
  orgId: string;
  segmentId: string;
}): Promise<SegmentRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "segments.read",
  });
  requireId(input.segmentId);

  const [row] = await db
    .select(segmentSelection)
    .from(segments)
    .where(
      and(eq(segments.id, input.segmentId), eq(segments.orgId, input.orgId)),
    )
    .limit(1);

  if (!row) {
    throw new SegmentError("SEGMENT_NOT_FOUND");
  }

  return toSegmentRecord(row, await contactCountForSegment(row.id));
}

export async function updateSegment(input: {
  actorUserId: string;
  orgId: string;
  payload: unknown;
  segmentId: string;
}): Promise<SegmentRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "segments.manage",
  });
  requireId(input.segmentId);
  const definition = parseUpdateSegmentInput(input.payload);

  try {
    const [updated] = await db
      .update(segments)
      .set({ name: definition.name, updatedAt: new Date() })
      .where(
        and(eq(segments.id, input.segmentId), eq(segments.orgId, input.orgId)),
      )
      .returning(segmentSelection);

    if (!updated) {
      throw new SegmentError("SEGMENT_NOT_FOUND");
    }

    return toSegmentRecord(updated, await contactCountForSegment(updated.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("SEGMENT_EXISTS");
    }

    throw error;
  }
}

export async function deleteSegment(input: {
  actorUserId: string;
  orgId: string;
  segmentId: string;
}): Promise<void> {
  await requireOrganizationPermission({
    ...input,
    permission: "segments.manage",
  });
  requireId(input.segmentId);

  const deleted = await db
    .delete(segments)
    .where(
      and(eq(segments.id, input.segmentId), eq(segments.orgId, input.orgId)),
    )
    .returning({ id: segments.id });

  if (deleted.length !== 1) {
    throw new SegmentError("SEGMENT_NOT_FOUND");
  }
}

export async function createTopic(input: {
  actorUserId: string;
  orgId: string;
  payload: unknown;
}): Promise<TopicRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "topics.manage",
  });
  const definition = parseCreateTopicInput(input.payload);

  try {
    const [created] = await db
      .insert(topics)
      .values({
        defaultSubscription: definition.defaultSubscription,
        description: definition.description,
        name: definition.name,
        orgId: input.orgId,
        visibility: definition.visibility,
      })
      .returning(topicSelection);

    if (!created) {
      throw new SegmentError("TOPIC_NOT_FOUND");
    }

    return toTopicRecord(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("TOPIC_EXISTS");
    }

    throw error;
  }
}

export async function listTopics(input: {
  actorUserId: string;
  orgId: string;
}): Promise<TopicRecord[]> {
  await requireOrganizationPermission({ ...input, permission: "topics.read" });

  const rows = await db
    .select(topicSelection)
    .from(topics)
    .where(eq(topics.orgId, input.orgId))
    .orderBy(asc(topics.name), asc(topics.id));

  return rows.map(toTopicRecord);
}

export async function getTopic(input: {
  actorUserId: string;
  orgId: string;
  topicId: string;
}): Promise<TopicRecord> {
  await requireOrganizationPermission({ ...input, permission: "topics.read" });

  if (!UUID_PATTERN.test(input.topicId)) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }

  const [row] = await db
    .select(topicSelection)
    .from(topics)
    .where(and(eq(topics.id, input.topicId), eq(topics.orgId, input.orgId)))
    .limit(1);

  if (!row) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }

  return toTopicRecord(row);
}

export async function updateTopic(input: {
  actorUserId: string;
  orgId: string;
  payload: unknown;
  topicId: string;
}): Promise<TopicRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "topics.manage",
  });

  if (!UUID_PATTERN.test(input.topicId)) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }

  const definition = parseUpdateTopicInput(input.payload);

  try {
    const [updated] = await db
      .update(topics)
      .set({ ...definition, updatedAt: new Date() })
      .where(and(eq(topics.id, input.topicId), eq(topics.orgId, input.orgId)))
      .returning(topicSelection);

    if (!updated) {
      throw new SegmentError("TOPIC_NOT_FOUND");
    }

    return toTopicRecord(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("TOPIC_EXISTS");
    }

    throw error;
  }
}

export async function deleteTopic(input: {
  actorUserId: string;
  orgId: string;
  topicId: string;
}): Promise<void> {
  await requireOrganizationPermission({
    ...input,
    permission: "topics.manage",
  });

  if (!UUID_PATTERN.test(input.topicId)) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }

  const deleted = await db
    .delete(topics)
    .where(and(eq(topics.id, input.topicId), eq(topics.orgId, input.orgId)))
    .returning({ id: topics.id });

  if (deleted.length !== 1) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }
}

export async function createContactProperty(input: {
  actorUserId: string;
  orgId: string;
  payload: unknown;
}): Promise<ContactPropertyRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "contactProperties.manage",
  });
  const definition = parseCreateContactPropertyInput(input.payload);

  try {
    const [created] = await db
      .insert(contactProperties)
      .values({
        fallbackValue: definition.fallbackValue,
        key: definition.key,
        orgId: input.orgId,
        type: definition.type,
      })
      .returning(propertySelection);

    if (!created) {
      throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
    }

    return toPropertyRecord(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("CONTACT_PROPERTY_EXISTS");
    }

    throw error;
  }
}

export async function listContactProperties(input: {
  actorUserId: string;
  orgId: string;
}): Promise<ContactPropertyRecord[]> {
  await requireOrganizationPermission({
    ...input,
    permission: "contactProperties.read",
  });

  const rows = await db
    .select(propertySelection)
    .from(contactProperties)
    .where(eq(contactProperties.orgId, input.orgId))
    .orderBy(asc(contactProperties.key));

  return rows.map(toPropertyRecord);
}

export async function getContactProperty(input: {
  actorUserId: string;
  orgId: string;
  propertyId: string;
}): Promise<ContactPropertyRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "contactProperties.read",
  });

  if (!UUID_PATTERN.test(input.propertyId)) {
    throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
  }

  const [row] = await db
    .select(propertySelection)
    .from(contactProperties)
    .where(
      and(
        eq(contactProperties.id, input.propertyId),
        eq(contactProperties.orgId, input.orgId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
  }

  return toPropertyRecord(row);
}

export async function updateContactProperty(input: {
  actorUserId: string;
  orgId: string;
  payload: unknown;
  propertyId: string;
}): Promise<ContactPropertyRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "contactProperties.manage",
  });

  if (!UUID_PATTERN.test(input.propertyId)) {
    throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
  }

  const definition = parseUpdateContactPropertyInput(input.payload);
  const [updated] = await db
    .update(contactProperties)
    .set({ fallbackValue: definition.fallbackValue, updatedAt: new Date() })
    .where(
      and(
        eq(contactProperties.id, input.propertyId),
        eq(contactProperties.orgId, input.orgId),
      ),
    )
    .returning(propertySelection);

  if (!updated) {
    throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
  }

  return toPropertyRecord(updated);
}

export async function deleteContactProperty(input: {
  actorUserId: string;
  orgId: string;
  propertyId: string;
}): Promise<void> {
  await requireOrganizationPermission({
    ...input,
    permission: "contactProperties.manage",
  });

  if (!UUID_PATTERN.test(input.propertyId)) {
    throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
  }

  const deleted = await db
    .delete(contactProperties)
    .where(
      and(
        eq(contactProperties.id, input.propertyId),
        eq(contactProperties.orgId, input.orgId),
      ),
    )
    .returning({ id: contactProperties.id });

  if (deleted.length !== 1) {
    throw new SegmentError("CONTACT_PROPERTY_NOT_FOUND");
  }
}

export async function createTopLevelContact(input: {
  actorUserId: string;
  now?: Date;
  orgId: string;
  payload: unknown;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const definition = parseTopLevelCreateContactInput(input.payload);
  const now = input.now ?? new Date();

  try {
    return await db.transaction(async (tx) => {
      const [suppression] = await tx
        .select({ reason: emailSuppressions.reason })
        .from(emailSuppressions)
        .where(
          and(
            eq(emailSuppressions.orgId, input.orgId),
            eq(emailSuppressions.email, definition.email),
          ),
        )
        .limit(1);

      const [created] = await tx
        .insert(contacts)
        .values({
          audienceId: null,
          createdAt: now,
          email: definition.email,
          firstName: definition.firstName,
          lastName: definition.lastName,
          name: null,
          orgId: input.orgId,
          properties: definition.properties,
          unsubscribedAt:
            definition.unsubscribed ||
            suppression?.reason === "unsubscribed"
              ? now
              : null,
          updatedAt: now,
        })
        .returning({ id: contacts.id });

      if (!created) {
        throw new SegmentError("CONTACT_NOT_FOUND");
      }

      await attachSegments(tx, input.orgId, created.id, definition.segments);
      await attachTopics(tx, input.orgId, created.id, definition.topics);

      return segmentContactRecordTx(tx, created.id, input.orgId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("CONTACT_EXISTS");
    }

    throw error;
  }
}

export async function listTopLevelContacts(input: {
  actorUserId: string;
  limit?: number;
  orgId: string;
  segmentId?: string | null;
}): Promise<SegmentContactRecord[]> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.read",
  });

  const limit = Math.max(1, Math.min(input.limit ?? 100, 100));
  let rows;

  if (input.segmentId) {
    requireId(input.segmentId);
    rows = await db
      .select(contactSelection)
      .from(contacts)
      .innerJoin(
        contactSegments,
        eq(contactSegments.contactId, contacts.id),
      )
      .where(
        and(
          eq(contacts.orgId, input.orgId),
          eq(contactSegments.segmentId, input.segmentId),
        ),
      )
      .orderBy(asc(contacts.email))
      .limit(limit);
  } else {
    rows = await db
      .select(contactSelection)
      .from(contacts)
      .where(eq(contacts.orgId, input.orgId))
      .orderBy(asc(contacts.email))
      .limit(limit);
  }

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      ...(await membershipsForContact(row.id, input.orgId)),
    })),
  );
}

export async function getTopLevelContact(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.read",
  });

  return segmentContactRecord(
    await resolveContactId(input.orgId, input.contactId),
    input.orgId,
  );
}

export async function updateTopLevelContact(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
  payload: unknown;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const definition = parseTopLevelUpdateContactInput(input.payload);
  const id = await resolveContactId(input.orgId, input.contactId);

  try {
    const [updated] = await db
      .update(contacts)
      .set({
        ...(definition.email !== undefined ? { email: definition.email } : {}),
        ...(definition.firstName !== undefined
          ? { firstName: definition.firstName }
          : {}),
        ...(definition.lastName !== undefined
          ? { lastName: definition.lastName }
          : {}),
        ...(definition.properties !== undefined
          ? { properties: definition.properties }
          : {}),
        ...(definition.unsubscribed !== undefined
          ? {
              unsubscribedAt: definition.unsubscribed
                ? new Date()
                : null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.orgId, input.orgId)))
      .returning({ id: contacts.id });

    if (!updated) {
      throw new SegmentError("CONTACT_NOT_FOUND");
    }

    return segmentContactRecord(updated.id, input.orgId);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SegmentError("CONTACT_EXISTS");
    }

    throw error;
  }
}

export async function deleteTopLevelContact(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
}): Promise<void> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const id = await resolveContactId(input.orgId, input.contactId);

  const deleted = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, input.orgId)))
    .returning({ id: contacts.id });

  if (deleted.length !== 1) {
    throw new SegmentError("CONTACT_NOT_FOUND");
  }
}

export async function addContactToSegment(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
  segmentId: string;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const id = await resolveContactId(input.orgId, input.contactId);

  await db.transaction(async (tx) => {
    await requireSegment(tx, input.orgId, input.segmentId);
    await tx
      .insert(contactSegments)
      .values({ contactId: id, segmentId: input.segmentId })
      .onConflictDoNothing();
  });

  return segmentContactRecord(id, input.orgId);
}

export async function removeContactFromSegment(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
  segmentId: string;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const id = await resolveContactId(input.orgId, input.contactId);
  requireId(input.segmentId);

  await db
    .delete(contactSegments)
    .where(
      and(
        eq(contactSegments.contactId, id),
        eq(contactSegments.segmentId, input.segmentId),
      ),
    );

  return segmentContactRecord(id, input.orgId);
}

export async function setContactTopic(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
  payload: unknown;
  topicId: string;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const id = await resolveContactId(input.orgId, input.contactId);

  if (!isRecordPayload(input.payload)) {
    throw new SegmentError("VALIDATION_ERROR", [
      { field: "body", message: "Must be a JSON object." },
    ]);
  }

  const subscription =
    (input.payload as Record<string, unknown>)["subscription"] === "opt_out"
      ? "opt_out"
      : (input.payload as Record<string, unknown>)["subscription"] === "opt_in"
        ? "opt_in"
        : null;

  if (!subscription) {
    throw new SegmentError("VALIDATION_ERROR", [
      { field: "subscription", message: "Must be opt_in or opt_out." },
    ]);
  }

  await db.transaction(async (tx) => {
    await requireTopic(tx, input.orgId, input.topicId);
    await tx
      .insert(contactTopics)
      .values({ contactId: id, subscription, topicId: input.topicId })
      .onConflictDoUpdate({
        set: { subscription, updatedAt: new Date() },
        target: [contactTopics.contactId, contactTopics.topicId],
      });
  });

  return segmentContactRecord(id, input.orgId);
}

export async function updateContactTopics(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
  payload: unknown;
}): Promise<SegmentContactRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const id = await resolveContactId(input.orgId, input.contactId);

  if (!isRecordPayload(input.payload) || !Array.isArray(input.payload["topics"])) {
    throw new SegmentError("VALIDATION_ERROR", [
      {
        field: "topics",
        message:
          "Provide an array of topic IDs with opt_in or opt_out subscriptions.",
      },
    ]);
  }

  const refs = (input.payload["topics"] as unknown[]).map((entry) => {
    if (!isRecordPayload(entry) || typeof entry["id"] !== "string") {
      return null;
    }

    const subscription =
      entry["subscription"] === "opt_out"
        ? "opt_out"
        : entry["subscription"] === "opt_in"
          ? "opt_in"
          : null;

    if (!UUID_PATTERN.test(entry["id"]) || !subscription) {
      return null;
    }

    return { id: entry["id"], subscription };
  });

  if (refs.some((ref) => !ref)) {
    throw new SegmentError("VALIDATION_ERROR", [
      {
        field: "topics",
        message:
          "Each entry needs a valid topic ID and an opt_in or opt_out subscription.",
      },
    ]);
  }

  await db.transaction(async (tx) => {
    for (const ref of refs as {
      id: string;
      subscription: "opt_in" | "opt_out";
    }[]) {
      await requireTopic(tx, input.orgId, ref.id);
      await tx
        .insert(contactTopics)
        .values({
          contactId: id,
          subscription: ref.subscription,
          topicId: ref.id,
        })
        .onConflictDoUpdate({
          set: { subscription: ref.subscription, updatedAt: new Date() },
          target: [contactTopics.contactId, contactTopics.topicId],
        });
    }
  });

  return segmentContactRecord(id, input.orgId);
}

function isRecordPayload(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function removeContactTopic(input: {
  actorUserId: string;
  contactId: string;
  orgId: string;
  topicId: string;
}): Promise<SegmentContactRecord> {  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const id = await resolveContactId(input.orgId, input.contactId);

  if (!UUID_PATTERN.test(input.topicId)) {
    throw new SegmentError("TOPIC_NOT_FOUND");
  }

  await db
    .delete(contactTopics)
    .where(
      and(
        eq(contactTopics.contactId, id),
        eq(contactTopics.topicId, input.topicId),
      ),
    );

  return segmentContactRecord(id, input.orgId);
}

type ImportRow = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  unsubscribed: boolean;
};

function parseImportRows(
  csv: string,
  columnMap: Record<string, string>,
): ImportRow[] {
  const table = parseCsvTable(csv);
  const header = (table.shift() ?? []).map((cell) => cell.trim().toLowerCase());
  const columns = new Map<string, number>();

  for (const [field, label] of Object.entries(columnMap)) {
    const index = header.indexOf(label.trim().toLowerCase());

    if (index === -1) {
      throw new SegmentError("VALIDATION_ERROR", [
        {
          field: "column_map",
          message: `Column "${label}" was not found in the CSV header.`,
        },
      ]);
    }

    columns.set(field, index);
  }

  const rows = table.filter(
    (row) => !(row.length === 1 && row[0].trim().length === 0),
  );

  if (rows.length === 0) {
    throw new SegmentError("VALIDATION_ERROR", [
      { field: "csv", message: "Include at least one contact row." },
    ]);
  }

  const issues: { field: string; message: string }[] = [];
  const parsed: ImportRow[] = [];

  rows.forEach((row, index) => {
    const field = `csv.rows.${index + 2}`;
    const email = contactEmail(row[columns.get("email") as number] ?? "");

    if (!email) {
      issues.push({ field: `${field}.email`, message: "Must be one plain email address." });
      return;
    }

    const firstRaw = columns.has("first_name")
      ? (row[columns.get("first_name") as number] ?? "").trim()
      : "";
    const lastRaw = columns.has("last_name")
      ? (row[columns.get("last_name") as number] ?? "").trim()
      : "";
    const unsubRaw = columns.has("unsubscribed")
      ? (row[columns.get("unsubscribed") as number] ?? "").trim().toLowerCase()
      : "";

    parsed.push({
      email,
      firstName: firstRaw ? firstRaw.slice(0, 200) : null,
      lastName: lastRaw ? lastRaw.slice(0, 200) : null,
      unsubscribed: ["true", "1", "yes", "y"].includes(unsubRaw),
    });
  });

  if (issues.length > 0) {
    throw new SegmentError("VALIDATION_ERROR", issues.slice(0, 100));
  }

  const deduplicated = new Map<string, ImportRow>();
  for (const row of parsed) {
    deduplicated.set(row.email, row);
  }

  return [...deduplicated.values()];
}

export async function createContactImport(input: {
  actorUserId: string;
  now?: Date;
  orgId: string;
  payload: unknown;
}): Promise<ContactImportRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.manage",
  });
  const definition = parseContactImportInput(input.payload);
  const columnMap = parseColumnMap(definition.columnMap) ?? definition.columnMap;
  const now = input.now ?? new Date();

  const [record] = await db
    .insert(contactImports)
    .values({
      createdAt: now,
      fileName: definition.fileName,
      orgId: input.orgId,
      status: "in_progress",
      updatedAt: now,
    })
    .returning(importSelection);

  if (!record) {
    throw new SegmentError("CONTACT_IMPORT_NOT_FOUND");
  }

  try {
    const rows = parseImportRows(definition.csv, columnMap);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    await db.transaction(async (tx) => {
      for (const segment of definition.segments) {
        await requireSegment(tx, input.orgId, segment.id);
      }
      for (const topic of definition.topics) {
        await requireTopic(tx, input.orgId, topic.id);
      }

      for (const row of rows) {
        const [existing] = await tx
          .select({ id: contacts.id, unsubscribedAt: contacts.unsubscribedAt })
          .from(contacts)
          .where(
            and(
              eq(contacts.orgId, input.orgId),
              isNull(contacts.audienceId),
              sql`lower(${contacts.email}) = lower(${row.email})`,
            ),
          )
          .limit(1);

        let contactId = existing?.id ?? null;

        if (!existing) {
          const [inserted] = await tx
            .insert(contacts)
            .values({
              audienceId: null,
              createdAt: now,
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              name: null,
              orgId: input.orgId,
              properties: {},
              unsubscribedAt: row.unsubscribed ? now : null,
              updatedAt: now,
            })
            .returning({ id: contacts.id });

          contactId = inserted?.id ?? null;
          created += 1;
        } else if (definition.onConflict === "skip") {
          skipped += 1;
          continue;
        } else {
          await tx
            .update(contacts)
            .set({
              firstName: row.firstName,
              lastName: row.lastName,
              ...(row.unsubscribed && !existing.unsubscribedAt
                ? { unsubscribedAt: now }
                : {}),
              updatedAt: now,
            })
            .where(eq(contacts.id, existing.id));
          updated += 1;
        }

        if (contactId) {
          await attachSegments(tx, input.orgId, contactId, definition.segments);
          await attachTopics(tx, input.orgId, contactId, definition.topics);
        }
      }
    });

    const [completed] = await db
      .update(contactImports)
      .set({
        createdRows: created,
        skippedRows: skipped,
        status: "completed",
        totalRows: rows.length,
        updatedAt: new Date(),
        updatedRows: updated,
      })
      .where(eq(contactImports.id, record.id))
      .returning(importSelection);

    if (!completed) {
      throw new SegmentError("CONTACT_IMPORT_NOT_FOUND");
    }

    return toImportRecord(completed);
  } catch (error) {
    const message =
      error instanceof SegmentError && error.code === "VALIDATION_ERROR"
        ? "Correct the CSV rows and try again."
        : error instanceof SegmentError
          ? error.code
          : "The contact import failed.";

    await db
      .update(contactImports)
      .set({ error: message, status: "failed", updatedAt: new Date() })
      .where(eq(contactImports.id, record.id));

    throw error;
  }
}

export async function listContactImports(input: {
  actorUserId: string;
  orgId: string;
}): Promise<ContactImportRecord[]> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.read",
  });

  const rows = await db
    .select(importSelection)
    .from(contactImports)
    .where(eq(contactImports.orgId, input.orgId))
    .orderBy(asc(contactImports.createdAt));

  return rows.map(toImportRecord);
}

export async function getContactImport(input: {
  actorUserId: string;
  importId: string;
  orgId: string;
}): Promise<ContactImportRecord> {
  await requireOrganizationPermission({
    ...input,
    permission: "audiences.read",
  });

  if (!UUID_PATTERN.test(input.importId)) {
    throw new SegmentError("CONTACT_IMPORT_NOT_FOUND");
  }

  const [row] = await db
    .select(importSelection)
    .from(contactImports)
    .where(
      and(
        eq(contactImports.id, input.importId),
        eq(contactImports.orgId, input.orgId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new SegmentError("CONTACT_IMPORT_NOT_FOUND");
  }

  return toImportRecord(row);
}

export type {
  ContactImportRecord,
  ContactPropertyRecord,
  SegmentContactRecord,
  SegmentRecord,
  TopicRecord,
};
