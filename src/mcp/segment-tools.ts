import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import { SegmentError } from "@/lib/segment-core";
import type {
  ContactImportRecord,
  ContactPropertyRecord,
  SegmentContactRecord,
  SegmentRecord,
  TopicRecord,
} from "@/lib/segments";
import { protocolTimestamp } from "@/lib/time";
import { PAPERBOY_MCP_SCHEMA_VERSION } from "@/mcp/contract";

export const PAPERBOY_SEGMENT_MCP_TOOL_NAMES = [
  "paperboy_list_segments",
  "paperboy_create_segment",
  "paperboy_get_segment",
  "paperboy_update_segment",
  "paperboy_delete_segment",
  "paperboy_list_topics",
  "paperboy_create_topic",
  "paperboy_get_topic",
  "paperboy_update_topic",
  "paperboy_delete_topic",
  "paperboy_list_contact_properties",
  "paperboy_create_contact_property",
  "paperboy_get_contact_property",
  "paperboy_update_contact_property",
  "paperboy_delete_contact_property",
  "paperboy_list_org_contacts",
  "paperboy_create_org_contact",
  "paperboy_get_org_contact",
  "paperboy_update_org_contact",
  "paperboy_delete_org_contact",
  "paperboy_list_contact_segments",
  "paperboy_add_contact_to_segment",
  "paperboy_remove_contact_from_segment",
  "paperboy_list_contact_topics",
  "paperboy_update_contact_topics",
  "paperboy_create_contact_import",
  "paperboy_list_contact_imports",
  "paperboy_get_contact_import",
] as const;

export const PAPERBOY_SEGMENT_MCP_TOOL_DEFINITIONS = [
  {
    description: "List organization segments with contact counts.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[0],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Create one organization segment.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[1],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one organization segment by ID.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[2],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Rename one organization segment.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[3],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one organization segment. Contact rows are kept.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[4],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List organization topics.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[5],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Create one organization topic with an immutable default subscription.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[6],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one organization topic by ID.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[7],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Update one organization topic name, description, or visibility.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[8],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one organization topic. Contact rows are kept.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[9],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List organization contact property definitions.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[10],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Define one contact property key and type.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[11],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one contact property definition by ID.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[12],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Update one contact property fallback value.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[13],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one contact property definition. Contact values are kept.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[14],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List organization contacts, optionally filtered to one segment.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[15],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Create one organization contact with optional segment and topic membership.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[16],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one organization contact by ID or email.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[17],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Update one organization contact by ID or email.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[18],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Delete one organization contact by ID or email.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[19],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List the segments one contact belongs to.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[20],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Add one contact to one segment.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[21],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Remove one contact from one segment.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[22],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List one contact's topic subscriptions.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[23],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Replace one contact's topic subscriptions in bulk.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[24],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description:
      "Import organization contacts from CSV text with an optional column map, conflict strategy, and segment or topic assignment.",
    mutating: true,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[25],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "List organization contact imports and their outcomes.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[26],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
  {
    description: "Get one organization contact import by ID.",
    mutating: false,
    name: PAPERBOY_SEGMENT_MCP_TOOL_NAMES[27],
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  },
] as const;

export type SegmentContactInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  properties?: Record<string, string | number | boolean>;
  segments?: { id: string }[];
  topics?: { id: string; subscription: "opt_in" | "opt_out" }[];
  unsubscribed?: boolean;
};

export type PaperBoyMcpSegmentServices = {
  addContactToSegment: (
    principal: ApiKeyPrincipal,
    contactId: string,
    segmentId: string,
  ) => Promise<SegmentContactRecord>;
  createContact: (
    principal: ApiKeyPrincipal,
    input: SegmentContactInput,
  ) => Promise<SegmentContactRecord>;
  createContactImport: (
    principal: ApiKeyPrincipal,
    input: Record<string, unknown>,
  ) => Promise<ContactImportRecord>;
  createContactProperty: (
    principal: ApiKeyPrincipal,
    input: Record<string, unknown>,
  ) => Promise<ContactPropertyRecord>;
  createSegment: (
    principal: ApiKeyPrincipal,
    input: { name: string },
  ) => Promise<SegmentRecord>;
  createTopic: (
    principal: ApiKeyPrincipal,
    input: Record<string, unknown>,
  ) => Promise<TopicRecord>;
  deleteContact: (
    principal: ApiKeyPrincipal,
    contactId: string,
  ) => Promise<void>;
  deleteContactProperty: (
    principal: ApiKeyPrincipal,
    propertyId: string,
  ) => Promise<void>;
  deleteSegment: (
    principal: ApiKeyPrincipal,
    segmentId: string,
  ) => Promise<void>;
  deleteTopic: (principal: ApiKeyPrincipal, topicId: string) => Promise<void>;
  getContact: (
    principal: ApiKeyPrincipal,
    contactId: string,
  ) => Promise<SegmentContactRecord>;
  getContactImport: (
    principal: ApiKeyPrincipal,
    importId: string,
  ) => Promise<ContactImportRecord>;
  getContactProperty: (
    principal: ApiKeyPrincipal,
    propertyId: string,
  ) => Promise<ContactPropertyRecord>;
  getSegment: (
    principal: ApiKeyPrincipal,
    segmentId: string,
  ) => Promise<SegmentRecord>;
  getTopic: (
    principal: ApiKeyPrincipal,
    topicId: string,
  ) => Promise<TopicRecord>;
  listContactImports: (
    principal: ApiKeyPrincipal,
  ) => Promise<ContactImportRecord[]>;
  listContactProperties: (
    principal: ApiKeyPrincipal,
  ) => Promise<ContactPropertyRecord[]>;
  listContacts: (
    principal: ApiKeyPrincipal,
    filter: { limit?: number; segmentId?: string },
  ) => Promise<SegmentContactRecord[]>;
  listSegments: (principal: ApiKeyPrincipal) => Promise<SegmentRecord[]>;
  listTopics: (principal: ApiKeyPrincipal) => Promise<TopicRecord[]>;
  removeContactFromSegment: (
    principal: ApiKeyPrincipal,
    contactId: string,
    segmentId: string,
  ) => Promise<SegmentContactRecord>;
  updateContact: (
    principal: ApiKeyPrincipal,
    contactId: string,
    input: Record<string, unknown>,
  ) => Promise<SegmentContactRecord>;
  updateContactProperty: (
    principal: ApiKeyPrincipal,
    propertyId: string,
    input: Record<string, unknown>,
  ) => Promise<ContactPropertyRecord>;
  updateContactTopics: (
    principal: ApiKeyPrincipal,
    contactId: string,
    input: Record<string, unknown>,
  ) => Promise<SegmentContactRecord>;
  updateSegment: (
    principal: ApiKeyPrincipal,
    segmentId: string,
    input: { name: string },
  ) => Promise<SegmentRecord>;
  updateTopic: (
    principal: ApiKeyPrincipal,
    topicId: string,
    input: Record<string, unknown>,
  ) => Promise<TopicRecord>;
};

const segmentSchema = z.object({
  contactCount: z.number().int().min(0),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().uuid(),
  name: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
});

const topicSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  defaultSubscription: z.enum(["opt_in", "opt_out"]),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
  visibility: z.enum(["public", "private"]),
});

const propertySchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  fallbackValue: z.string().nullable(),
  id: z.string().uuid(),
  key: z.string(),
  type: z.enum(["string", "number"]),
  updatedAt: z.iso.datetime({ offset: true }),
});

const contactSegmentSchema = z.object({ id: z.string().uuid(), name: z.string() });

const contactTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subscription: z.enum(["opt_in", "opt_out"]),
});

const contactSchema = z.object({
  audienceId: z.string().uuid().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  email: z.string(),
  firstName: z.string().nullable(),
  id: z.string().uuid(),
  lastName: z.string().nullable(),
  name: z.string().nullable(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  segments: z.array(contactSegmentSchema),
  topics: z.array(contactTopicSchema),
  unsubscribedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});

const importSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  createdRows: z.number().int().min(0),
  error: z.string().nullable(),
  fileName: z.string().nullable(),
  id: z.string().uuid(),
  skippedRows: z.number().int().min(0),
  status: z.enum(["queued", "in_progress", "completed", "failed"]),
  totalRows: z.number().int().min(0),
  updatedAt: z.iso.datetime({ offset: true }),
  updatedRows: z.number().int().min(0),
});

const responseMetadata = {
  observedAt: z.iso.datetime({ offset: true }),
  protocolTimeZone: z.literal("UTC"),
  schemaVersion: z.literal(PAPERBOY_MCP_SCHEMA_VERSION),
};

function envelope<T extends z.ZodRawShape>(shape: T) {
  return z.object({ ...responseMetadata, ...shape });
}

const segmentListOutput = envelope({ segments: z.array(segmentSchema) });
const segmentResponseOutput = envelope({ segment: segmentSchema });
const topicListOutput = envelope({ topics: z.array(topicSchema) });
const topicResponseOutput = envelope({ topic: topicSchema });
const propertyListOutput = envelope({ contactProperties: z.array(propertySchema) });
const propertyResponseOutput = envelope({ contactProperty: propertySchema });
const contactListOutput = envelope({ contacts: z.array(contactSchema) });
const contactResponseOutput = envelope({ contact: contactSchema });
const contactSegmentsOutput = envelope({ contactId: z.string(), segments: z.array(contactSegmentSchema) });
const contactTopicsOutput = envelope({ contactId: z.string(), topics: z.array(contactTopicSchema) });
const importListOutput = envelope({ contactImports: z.array(importSchema) });
const importResponseOutput = envelope({ contactImport: importSchema });
const deleteOutput = envelope({ deleted: z.literal(true), id: z.string() });

const nameInput = z.object({ name: z.string().min(1).max(120) }).strict();
const segmentIdInput = z.object({ segmentId: z.string().uuid() }).strict();
const topicIdInput = z.object({ topicId: z.string().uuid() }).strict();
const propertyIdInput = z.object({ propertyId: z.string().uuid() }).strict();
const contactIdInput = z
  .object({ contactId: z.string().min(3).max(254) })
  .strict();
const importIdInput = z.object({ importId: z.string().uuid() }).strict();

const topicInput = z
  .object({
    defaultSubscription: z.enum(["opt_in", "opt_out"]),
    description: z.string().min(1).max(200).nullable().optional(),
    name: z.string().min(1).max(50),
    visibility: z.enum(["public", "private"]).default("private"),
  })
  .strict();

const topicUpdateInput = z
  .object({
    description: z.string().min(1).max(200).nullable().optional(),
    name: z.string().min(1).max(50).optional(),
    topicId: z.string().uuid(),
    visibility: z.enum(["public", "private"]).optional(),
  })
  .strict();

const propertyInput = z
  .object({
    fallbackValue: z.union([z.string(), z.number()]).nullable().optional(),
    key: z.string().regex(/^[A-Za-z0-9_]{1,50}$/),
    type: z.enum(["string", "number"]),
  })
  .strict();

const propertyUpdateInput = z
  .object({
    fallbackValue: z.union([z.string(), z.number()]).nullable(),
    propertyId: z.string().uuid(),
  })
  .strict();

const segmentRef = z.object({ id: z.string().uuid() }).strict();
const topicRef = z
  .object({
    id: z.string().uuid(),
    subscription: z.enum(["opt_in", "opt_out"]),
  })
  .strict();

const contactInput = z
  .object({
    email: z.string().min(3).max(254),
    firstName: z.string().min(1).max(200).nullable().optional(),
    lastName: z.string().min(1).max(200).nullable().optional(),
    properties: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    segments: z.array(segmentRef).max(100).optional(),
    topics: z.array(topicRef).max(100).optional(),
    unsubscribed: z.boolean().optional(),
  })
  .strict();

const contactUpdateInput = z
  .object({
    contactId: z.string().min(3).max(254),
    email: z.string().min(3).max(254).optional(),
    firstName: z.string().min(1).max(200).nullable().optional(),
    lastName: z.string().min(1).max(200).nullable().optional(),
    properties: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    unsubscribed: z.boolean().optional(),
  })
  .strict();

const contactTopicsUpdateInput = z
  .object({ contactId: z.string().min(3).max(254), topics: z.array(topicRef).max(100) })
  .strict();

const importInput = z
  .object({
    columnMap: z.record(z.string(), z.string()).optional(),
    csv: z.string().min(1).max(1024 * 1024),
    fileName: z.string().min(1).max(254).nullable().optional(),
    onConflict: z.enum(["skip", "upsert"]).default("skip"),
    segments: z.array(segmentRef).max(100).optional(),
    topics: z.array(topicRef).max(100).optional(),
  })
  .strict();

function serializeSegment(segment: SegmentRecord) {
  return {
    contactCount: segment.contactCount,
    createdAt: protocolTimestamp(segment.createdAt),
    id: segment.id,
    name: segment.name,
    updatedAt: protocolTimestamp(segment.updatedAt),
  };
}

function serializeTopic(topic: TopicRecord) {
  return {
    createdAt: protocolTimestamp(topic.createdAt),
    defaultSubscription: topic.defaultSubscription,
    description: topic.description,
    id: topic.id,
    name: topic.name,
    updatedAt: protocolTimestamp(topic.updatedAt),
    visibility: topic.visibility,
  };
}

function serializeProperty(property: ContactPropertyRecord) {
  return {
    createdAt: protocolTimestamp(property.createdAt),
    fallbackValue: property.fallbackValue,
    id: property.id,
    key: property.key,
    type: property.type,
    updatedAt: protocolTimestamp(property.updatedAt),
  };
}

function serializeContact(contact: SegmentContactRecord) {
  return {
    audienceId: contact.audienceId,
    createdAt: protocolTimestamp(contact.createdAt),
    email: contact.email,
    firstName: contact.firstName,
    id: contact.id,
    lastName: contact.lastName,
    name: contact.name,
    properties: contact.properties,
    segments: contact.segments,
    topics: contact.topics,
    unsubscribedAt: contact.unsubscribedAt
      ? protocolTimestamp(contact.unsubscribedAt)
      : null,
    updatedAt: protocolTimestamp(contact.updatedAt),
  };
}

function serializeImport(record: ContactImportRecord) {
  return {
    createdAt: protocolTimestamp(record.createdAt),
    createdRows: record.createdRows,
    error: record.error,
    fileName: record.fileName,
    id: record.id,
    skippedRows: record.skippedRows,
    status: record.status,
    totalRows: record.totalRows,
    updatedAt: protocolTimestamp(record.updatedAt),
    updatedRows: record.updatedRows,
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

function errorMessage(error: unknown): string {
  if (error instanceof AuthorizationError) {
    return "The API key creator's current role does not allow this operation.";
  }

  if (error instanceof SegmentError) {
    switch (error.code) {
      case "MEMBERSHIP_REQUIRED":
        return "Create a new API key from a current organization owner or admin.";
      case "SEGMENT_NOT_FOUND":
      case "TOPIC_NOT_FOUND":
      case "CONTACT_NOT_FOUND":
      case "CONTACT_PROPERTY_NOT_FOUND":
      case "CONTACT_IMPORT_NOT_FOUND":
        return "No record with that ID exists in this organization.";
      case "SEGMENT_EXISTS":
        return "A segment with that name already exists in this organization.";
      case "TOPIC_EXISTS":
        return "A topic with that name already exists in this organization.";
      case "CONTACT_PROPERTY_EXISTS":
        return "A contact property with that key already exists in this organization.";
      case "CONTACT_EXISTS":
        return "A contact with that email already exists.";
      default:
        return error.issues[0]?.message ?? "Check the contact fields.";
    }
  }

  console.error("PaperBoy MCP segment operation failed.");
  return "The operation failed.";
}

function errorResult(error: unknown) {
  return {
    content: [{ text: errorMessage(error), type: "text" as const }],
    isError: true,
  };
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [
      { text: JSON.stringify(output, null, 2), type: "text" as const },
    ],
    structuredContent: output,
  };
}

export function registerPaperBoySegmentTools(input: {
  authorize: () => Promise<ApiKeyPrincipal | null>;
  now?: () => Date;
  server: McpServer;
  services: PaperBoyMcpSegmentServices;
}) {
  const now = input.now ?? (() => new Date());
  const metadata = () => ({
    observedAt: protocolTimestamp(now()),
    protocolTimeZone: "UTC" as const,
    schemaVersion: PAPERBOY_MCP_SCHEMA_VERSION,
  });

  const registrations: [
    (typeof PAPERBOY_SEGMENT_MCP_TOOL_NAMES)[number],
    string,
    { destructive: boolean; readOnly: boolean },
    z.ZodType,
    z.ZodType,
    (
      principal: ApiKeyPrincipal,
       
      args: any,
    ) => Promise<Record<string, unknown>>,
  ][] = [
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[0],
      "List PaperBoy segments",
      { destructive: false, readOnly: true },
      z.object({}).strict(),
      segmentListOutput,
      async (principal) => ({
        segments: (await input.services.listSegments(principal)).map(serializeSegment),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[1],
      "Create a PaperBoy segment",
      { destructive: false, readOnly: false },
      nameInput,
      segmentResponseOutput,
      async (principal, args) => ({
        segment: serializeSegment(await input.services.createSegment(principal, args)),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[2],
      "Get a PaperBoy segment",
      { destructive: false, readOnly: true },
      segmentIdInput,
      segmentResponseOutput,
      async (principal, args) => ({
        segment: serializeSegment(
          await input.services.getSegment(principal, args.segmentId),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[3],
      "Update a PaperBoy segment",
      { destructive: false, readOnly: false },
      nameInput.extend({ segmentId: z.string().uuid() }),
      segmentResponseOutput,
      async (principal, args) => ({
        segment: serializeSegment(
          await input.services.updateSegment(principal, args.segmentId, args),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[4],
      "Delete a PaperBoy segment",
      { destructive: true, readOnly: false },
      segmentIdInput,
      deleteOutput,
      async (principal, args) => {
        await input.services.deleteSegment(principal, args.segmentId);
        return { deleted: true as const, id: args.segmentId };
      },
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[5],
      "List PaperBoy topics",
      { destructive: false, readOnly: true },
      z.object({}).strict(),
      topicListOutput,
      async (principal) => ({
        topics: (await input.services.listTopics(principal)).map(serializeTopic),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[6],
      "Create a PaperBoy topic",
      { destructive: false, readOnly: false },
      topicInput,
      topicResponseOutput,
      async (principal, args) => ({
        topic: serializeTopic(await input.services.createTopic(principal, args)),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[7],
      "Get a PaperBoy topic",
      { destructive: false, readOnly: true },
      topicIdInput,
      topicResponseOutput,
      async (principal, args) => ({
        topic: serializeTopic(await input.services.getTopic(principal, args.topicId)),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[8],
      "Update a PaperBoy topic",
      { destructive: false, readOnly: false },
      topicUpdateInput,
      topicResponseOutput,
      async (principal, args) => ({
        topic: serializeTopic(
          await input.services.updateTopic(principal, args.topicId, args),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[9],
      "Delete a PaperBoy topic",
      { destructive: true, readOnly: false },
      topicIdInput,
      deleteOutput,
      async (principal, args) => {
        await input.services.deleteTopic(principal, args.topicId);
        return { deleted: true as const, id: args.topicId };
      },
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[10],
      "List PaperBoy contact properties",
      { destructive: false, readOnly: true },
      z.object({}).strict(),
      propertyListOutput,
      async (principal) => ({
        contactProperties: (await input.services.listContactProperties(principal)).map(
          serializeProperty,
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[11],
      "Create a PaperBoy contact property",
      { destructive: false, readOnly: false },
      propertyInput,
      propertyResponseOutput,
      async (principal, args) => ({
        contactProperty: serializeProperty(
          await input.services.createContactProperty(principal, args),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[12],
      "Get a PaperBoy contact property",
      { destructive: false, readOnly: true },
      propertyIdInput,
      propertyResponseOutput,
      async (principal, args) => ({
        contactProperty: serializeProperty(
          await input.services.getContactProperty(principal, args.propertyId),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[13],
      "Update a PaperBoy contact property",
      { destructive: false, readOnly: false },
      propertyUpdateInput,
      propertyResponseOutput,
      async (principal, args) => ({
        contactProperty: serializeProperty(
          await input.services.updateContactProperty(
            principal,
            args.propertyId,
            args,
          ),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[14],
      "Delete a PaperBoy contact property",
      { destructive: true, readOnly: false },
      propertyIdInput,
      deleteOutput,
      async (principal, args) => {
        await input.services.deleteContactProperty(principal, args.propertyId);
        return { deleted: true as const, id: args.propertyId };
      },
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[15],
      "List PaperBoy contacts",
      { destructive: false, readOnly: true },
      z.object({ limit: z.number().int().min(1).max(100).optional(), segmentId: z.string().uuid().optional() }).strict(),
      contactListOutput,
      async (principal, args) => ({
        contacts: (await input.services.listContacts(principal, args)).map(serializeContact),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[16],
      "Create a PaperBoy contact",
      { destructive: false, readOnly: false },
      contactInput,
      contactResponseOutput,
      async (principal, args) => ({
        contact: serializeContact(await input.services.createContact(principal, args)),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[17],
      "Get a PaperBoy contact",
      { destructive: false, readOnly: true },
      contactIdInput,
      contactResponseOutput,
      async (principal, args) => ({
        contact: serializeContact(
          await input.services.getContact(principal, args.contactId),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[18],
      "Update a PaperBoy contact",
      { destructive: false, readOnly: false },
      contactUpdateInput,
      contactResponseOutput,
      async (principal, args) => ({
        contact: serializeContact(
          await input.services.updateContact(principal, args.contactId, args),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[19],
      "Delete a PaperBoy contact",
      { destructive: true, readOnly: false },
      contactIdInput,
      deleteOutput,
      async (principal, args) => {
        await input.services.deleteContact(principal, args.contactId);
        return { deleted: true as const, id: args.contactId };
      },
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[20],
      "List a contact's segments",
      { destructive: false, readOnly: true },
      contactIdInput,
      contactSegmentsOutput,
      async (principal, args) => {
        const contact = await input.services.getContact(principal, args.contactId);
        return { contactId: contact.id, segments: contact.segments };
      },
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[21],
      "Add a contact to a segment",
      { destructive: false, readOnly: false },
      contactIdInput.extend({ segmentId: z.string().uuid() }),
      contactResponseOutput,
      async (principal, args) => ({
        contact: serializeContact(
          await input.services.addContactToSegment(
            principal,
            args.contactId,
            args.segmentId,
          ),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[22],
      "Remove a contact from a segment",
      { destructive: false, readOnly: false },
      contactIdInput.extend({ segmentId: z.string().uuid() }),
      contactResponseOutput,
      async (principal, args) => ({
        contact: serializeContact(
          await input.services.removeContactFromSegment(
            principal,
            args.contactId,
            args.segmentId,
          ),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[23],
      "List a contact's topics",
      { destructive: false, readOnly: true },
      contactIdInput,
      contactTopicsOutput,
      async (principal, args) => {
        const contact = await input.services.getContact(principal, args.contactId);
        return { contactId: contact.id, topics: contact.topics };
      },
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[24],
      "Update a contact's topics",
      { destructive: false, readOnly: false },
      contactTopicsUpdateInput,
      contactResponseOutput,
      async (principal, args) => ({
        contact: serializeContact(
          await input.services.updateContactTopics(principal, args.contactId, args),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[25],
      "Import PaperBoy contacts",
      { destructive: false, readOnly: false },
      importInput,
      importResponseOutput,
      async (principal, args) => ({
        contactImport: serializeImport(
          await input.services.createContactImport(principal, args),
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[26],
      "List PaperBoy contact imports",
      { destructive: false, readOnly: true },
      z.object({}).strict(),
      importListOutput,
      async (principal) => ({
        contactImports: (await input.services.listContactImports(principal)).map(
          serializeImport,
        ),
      }),
    ],
    [
      PAPERBOY_SEGMENT_MCP_TOOL_NAMES[27],
      "Get a PaperBoy contact import",
      { destructive: false, readOnly: true },
      importIdInput,
      importResponseOutput,
      async (principal, args) => ({
        contactImport: serializeImport(
          await input.services.getContactImport(principal, args.importId),
        ),
      }),
    ],
  ];

  for (const [name, title, flags, inputSchema, outputSchema, run] of registrations) {
    const definition = PAPERBOY_SEGMENT_MCP_TOOL_DEFINITIONS.find(
      (entry) => entry.name === name,
    );

    input.server.registerTool(
      name,
      {
        annotations: {
          destructiveHint: flags.destructive,
          idempotentHint: flags.readOnly,
          openWorldHint: false,
          readOnlyHint: flags.readOnly,
        },
        description: definition?.description ?? title,
        inputSchema,
        outputSchema,
        title,
        _meta: { "paperboy/schemaVersion": PAPERBOY_MCP_SCHEMA_VERSION },
      },
       
      async (args: any) => {
        const account = await input.authorize();
        if (!account) return unauthorizedResult();

        try {
          return successResult({ ...metadata(), ...(await run(account, args)) });
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }
}
