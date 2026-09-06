import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError, requireKeyScope } from "@/lib/authorization";
import {
  addContactToSegment,
  createContactImport,
  createContactProperty,
  createSegment,
  createTopLevelContact,
  createTopic,
  deleteContactProperty,
  deleteSegment,
  deleteTopLevelContact,
  deleteTopic,
  getContactImport,
  getContactProperty,
  getSegment,
  getTopLevelContact,
  getTopic,
  listContactImports,
  listContactProperties,
  listSegments,
  listTopLevelContacts,
  listTopics,
  removeContactFromSegment,
  removeContactTopic,
  setContactTopic,
  updateContactProperty,
  updateContactTopics,
  updateSegment,
  updateTopLevelContact,
  updateTopic,
  type ContactImportRecord,
  type ContactPropertyRecord,
  type SegmentContactRecord,
  type SegmentRecord,
  type TopicRecord,
} from "@/lib/segments";
import { SegmentError } from "@/lib/segment-core";

export type SegmentHttpServices = {
  addContactToSegment: (
    principal: ApiKeyPrincipal,
    contactId: string,
    segmentId: string,
  ) => Promise<SegmentContactRecord>;
  createContact: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<SegmentContactRecord>;
  createContactImport: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<ContactImportRecord>;
  createContactProperty: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<ContactPropertyRecord>;
  createSegment: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<SegmentRecord>;
  createTopic: (
    principal: ApiKeyPrincipal,
    payload: unknown,
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
  removeContactTopic: (
    principal: ApiKeyPrincipal,
    contactId: string,
    topicId: string,
  ) => Promise<SegmentContactRecord>;
  setContactTopic: (
    principal: ApiKeyPrincipal,
    contactId: string,
    topicId: string,
    payload: unknown,
  ) => Promise<SegmentContactRecord>;
  updateContact: (
    principal: ApiKeyPrincipal,
    contactId: string,
    payload: unknown,
  ) => Promise<SegmentContactRecord>;
  updateContactProperty: (
    principal: ApiKeyPrincipal,
    propertyId: string,
    payload: unknown,
  ) => Promise<ContactPropertyRecord>;
  updateContactTopics: (
    principal: ApiKeyPrincipal,
    contactId: string,
    payload: unknown,
  ) => Promise<SegmentContactRecord>;
  updateSegment: (
    principal: ApiKeyPrincipal,
    segmentId: string,
    payload: unknown,
  ) => Promise<SegmentRecord>;
  updateTopic: (
    principal: ApiKeyPrincipal,
    topicId: string,
    payload: unknown,
  ) => Promise<TopicRecord>;
};

export type SegmentHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: SegmentHttpServices;
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
            "The API key creator's current role does not allow this operation.",
        },
      },
      403,
    );
  }

  if (error instanceof SegmentError) {
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

    if (
      error.code === "SEGMENT_NOT_FOUND" ||
      error.code === "TOPIC_NOT_FOUND" ||
      error.code === "CONTACT_NOT_FOUND" ||
      error.code === "CONTACT_PROPERTY_NOT_FOUND" ||
      error.code === "CONTACT_IMPORT_NOT_FOUND"
    ) {
      return json(
        {
          error: {
            code: "not_found",
            message: "No record with that ID exists in this organization.",
          },
        },
        404,
      );
    }

    if (
      error.code === "SEGMENT_EXISTS" ||
      error.code === "TOPIC_EXISTS" ||
      error.code === "CONTACT_EXISTS" ||
      error.code === "CONTACT_PROPERTY_EXISTS"
    ) {
      return json(
        {
          error: {
            code: "conflict",
            message: "Another record already uses that value.",
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
          message: "Correct the invalid fields and try again.",
        },
      },
      422,
    );
  }

  console.error("PaperBoy segment operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The operation failed.",
      },
    },
    500,
  );
}

function serializeSegment(segment: SegmentRecord) {
  return {
    contact_count: segment.contactCount,
    created_at: segment.createdAt.toISOString(),
    id: segment.id,
    name: segment.name,
    updated_at: segment.updatedAt.toISOString(),
  };
}

function serializeTopic(topic: TopicRecord) {
  return {
    created_at: topic.createdAt.toISOString(),
    default_subscription: topic.defaultSubscription,
    description: topic.description,
    id: topic.id,
    name: topic.name,
    updated_at: topic.updatedAt.toISOString(),
    visibility: topic.visibility,
  };
}

function serializeProperty(property: ContactPropertyRecord) {
  return {
    created_at: property.createdAt.toISOString(),
    fallback_value: property.fallbackValue,
    id: property.id,
    key: property.key,
    type: property.type,
    updated_at: property.updatedAt.toISOString(),
  };
}

function serializeContact(contact: SegmentContactRecord) {
  return {
    audience_id: contact.audienceId,
    created_at: contact.createdAt.toISOString(),
    email: contact.email,
    first_name: contact.firstName,
    id: contact.id,
    last_name: contact.lastName,
    name: contact.name,
    properties: contact.properties,
    segments: contact.segments,
    topics: contact.topics,
    unsubscribed_at: contact.unsubscribedAt?.toISOString() ?? null,
    updated_at: contact.updatedAt.toISOString(),
  };
}

function serializeImport(record: ContactImportRecord) {
  return {
    created_at: record.createdAt.toISOString(),
    created_rows: record.createdRows,
    error: record.error,
    file_name: record.fileName,
    id: record.id,
    skipped_rows: record.skippedRows,
    status: record.status,
    total_rows: record.totalRows,
    updated_at: record.updatedAt.toISOString(),
    updated_rows: record.updatedRows,
  };
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

async function importPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const payload: Record<string, unknown> = {};

    if (typeof file === "string") {
      payload["csv"] = file;
    } else if (file && typeof file === "object" && "text" in file) {
      payload["csv"] = await (file as File).text();
      payload["file_name"] =
        "name" in file && typeof (file as File).name === "string"
          ? (file as File).name
          : null;
    }

    for (const field of [
      "column_map",
      "on_conflict",
      "segments",
      "topics",
    ] as const) {
      const entry = form.get(field);
      if (typeof entry === "string") {
        payload[field] = entry;
      }
    }

    return payload;
  }

  return requestBody(request);
}

function actorUserId(principal: ApiKeyPrincipal): string {
  if (!principal.actorUserId) {
    throw new SegmentError("MEMBERSHIP_REQUIRED");
  }

  return principal.actorUserId;
}

function scoped(principal: ApiKeyPrincipal, permission: Parameters<typeof requireKeyScope>[1]): string {
  requireKeyScope(principal.scopes, permission);
  return actorUserId(principal);
}

export const segmentApiServices: SegmentHttpServices = {
  addContactToSegment: (principal, contactId, segmentId) =>
    addContactToSegment({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
      segmentId,
    }),
  createContact: (principal, payload) =>
    createTopLevelContact({
      actorUserId: scoped(principal, "audiences.manage"),
      orgId: principal.orgId,
      payload,
    }),
  createContactImport: (principal, payload) =>
    createContactImport({
      actorUserId: scoped(principal, "audiences.manage"),
      orgId: principal.orgId,
      payload,
    }),
  createContactProperty: (principal, payload) =>
    createContactProperty({
      actorUserId: scoped(principal, "contactProperties.manage"),
      orgId: principal.orgId,
      payload,
    }),
  createSegment: (principal, payload) =>
    createSegment({
      actorUserId: scoped(principal, "segments.manage"),
      orgId: principal.orgId,
      payload,
    }),
  createTopic: (principal, payload) =>
    createTopic({
      actorUserId: scoped(principal, "topics.manage"),
      orgId: principal.orgId,
      payload,
    }),
  deleteContact: (principal, contactId) =>
    deleteTopLevelContact({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
    }),
  deleteContactProperty: (principal, propertyId) =>
    deleteContactProperty({
      actorUserId: scoped(principal, "contactProperties.manage"),
      orgId: principal.orgId,
      propertyId,
    }),
  deleteSegment: (principal, segmentId) =>
    deleteSegment({
      actorUserId: scoped(principal, "segments.manage"),
      orgId: principal.orgId,
      segmentId,
    }),
  deleteTopic: (principal, topicId) =>
    deleteTopic({
      actorUserId: scoped(principal, "topics.manage"),
      orgId: principal.orgId,
      topicId,
    }),
  getContact: (principal, contactId) =>
    getTopLevelContact({
      actorUserId: scoped(principal, "audiences.read"),
      contactId,
      orgId: principal.orgId,
    }),
  getContactImport: (principal, importId) =>
    getContactImport({
      actorUserId: scoped(principal, "audiences.read"),
      importId,
      orgId: principal.orgId,
    }),
  getContactProperty: (principal, propertyId) =>
    getContactProperty({
      actorUserId: scoped(principal, "contactProperties.read"),
      orgId: principal.orgId,
      propertyId,
    }),
  getSegment: (principal, segmentId) =>
    getSegment({
      actorUserId: scoped(principal, "segments.read"),
      orgId: principal.orgId,
      segmentId,
    }),
  getTopic: (principal, topicId) =>
    getTopic({
      actorUserId: scoped(principal, "topics.read"),
      orgId: principal.orgId,
      topicId,
    }),
  listContactImports: (principal) =>
    listContactImports({
      actorUserId: scoped(principal, "audiences.read"),
      orgId: principal.orgId,
    }),
  listContactProperties: (principal) =>
    listContactProperties({
      actorUserId: scoped(principal, "contactProperties.read"),
      orgId: principal.orgId,
    }),
  listContacts: (principal, filter) =>
    listTopLevelContacts({
      actorUserId: scoped(principal, "audiences.read"),
      limit: filter.limit,
      orgId: principal.orgId,
      segmentId: filter.segmentId,
    }),
  listSegments: (principal) =>
    listSegments({
      actorUserId: scoped(principal, "segments.read"),
      orgId: principal.orgId,
    }),
  listTopics: (principal) =>
    listTopics({
      actorUserId: scoped(principal, "topics.read"),
      orgId: principal.orgId,
    }),
  removeContactFromSegment: (principal, contactId, segmentId) =>
    removeContactFromSegment({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
      segmentId,
    }),
  removeContactTopic: (principal, contactId, topicId) =>
    removeContactTopic({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
      topicId,
    }),
  setContactTopic: (principal, contactId, topicId, payload) =>
    setContactTopic({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
      payload,
      topicId,
    }),
  updateContact: (principal, contactId, payload) =>
    updateTopLevelContact({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
      payload,
    }),
  updateContactProperty: (principal, propertyId, payload) =>
    updateContactProperty({
      actorUserId: scoped(principal, "contactProperties.manage"),
      orgId: principal.orgId,
      payload,
      propertyId,
    }),
  updateContactTopics: (principal, contactId, payload) =>
    updateContactTopics({
      actorUserId: scoped(principal, "audiences.manage"),
      contactId,
      orgId: principal.orgId,
      payload,
    }),
  updateSegment: (principal, segmentId, payload) =>
    updateSegment({
      actorUserId: scoped(principal, "segments.manage"),
      orgId: principal.orgId,
      payload,
      segmentId,
    }),
  updateTopic: (principal, topicId, payload) =>
    updateTopic({
      actorUserId: scoped(principal, "topics.manage"),
      orgId: principal.orgId,
      payload,
      topicId,
    }),
};

async function authenticated(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<ApiKeyPrincipal | Response> {
  return (await dependencies.authenticate(request)) ?? unauthorized();
}

function contactFilter(url: string): { limit?: number; segmentId?: string } {
  const query = new URL(url).searchParams;
  const limit = Number(query.get("limit"));
  const segmentId = query.get("segment_id") ?? undefined;

  return {
    ...(Number.isInteger(limit) && limit >= 1
      ? { limit: Math.min(limit, 100) }
      : {}),
    ...(segmentId ? { segmentId } : {}),
  };
}

export async function handleListSegmentsRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const segments = await dependencies.services.listSegments(principal);
    return json({ data: segments.map(serializeSegment) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateSegmentRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeSegment(await dependencies.services.createSegment(principal, payload)),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetSegmentRequest(
  request: Request,
  segmentId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeSegment(await dependencies.services.getSegment(principal, segmentId)),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateSegmentRequest(
  request: Request,
  segmentId: string,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeSegment(
        await dependencies.services.updateSegment(principal, segmentId, payload),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteSegmentRequest(
  request: Request,
  segmentId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    await dependencies.services.deleteSegment(principal, segmentId);
    return json({ deleted: true, id: segmentId }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleListTopicsRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const topics = await dependencies.services.listTopics(principal);
    return json({ data: topics.map(serializeTopic) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateTopicRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeTopic(await dependencies.services.createTopic(principal, payload)),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetTopicRequest(
  request: Request,
  topicId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeTopic(await dependencies.services.getTopic(principal, topicId)),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateTopicRequest(
  request: Request,
  topicId: string,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeTopic(
        await dependencies.services.updateTopic(principal, topicId, payload),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteTopicRequest(
  request: Request,
  topicId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    await dependencies.services.deleteTopic(principal, topicId);
    return json({ deleted: true, id: topicId }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleListContactPropertiesRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const properties = await dependencies.services.listContactProperties(principal);
    return json({ data: properties.map(serializeProperty) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateContactPropertyRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeProperty(
        await dependencies.services.createContactProperty(principal, payload),
      ),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetContactPropertyRequest(
  request: Request,
  propertyId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeProperty(
        await dependencies.services.getContactProperty(principal, propertyId),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateContactPropertyRequest(
  request: Request,
  propertyId: string,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeProperty(
        await dependencies.services.updateContactProperty(
          principal,
          propertyId,
          payload,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteContactPropertyRequest(
  request: Request,
  propertyId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    await dependencies.services.deleteContactProperty(principal, propertyId);
    return json({ deleted: true, id: propertyId }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleListContactsRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const contacts = await dependencies.services.listContacts(
      principal,
      contactFilter(request.url),
    );
    return json({ data: contacts.map(serializeContact) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateContactRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeContact(await dependencies.services.createContact(principal, payload)),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetContactRequest(
  request: Request,
  contactId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeContact(await dependencies.services.getContact(principal, contactId)),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateContactRequest(
  request: Request,
  contactId: string,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeContact(
        await dependencies.services.updateContact(principal, contactId, payload),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteContactRequest(
  request: Request,
  contactId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    await dependencies.services.deleteContact(principal, contactId);
    return json({ deleted: true, id: contactId }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleAddContactToSegmentRequest(
  request: Request,
  contactId: string,
  segmentId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeContact(
        await dependencies.services.addContactToSegment(
          principal,
          contactId,
          segmentId,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleRemoveContactFromSegmentRequest(
  request: Request,
  contactId: string,
  segmentId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeContact(
        await dependencies.services.removeContactFromSegment(
          principal,
          contactId,
          segmentId,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleSetContactTopicRequest(
  request: Request,
  contactId: string,
  topicId: string,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeContact(
        await dependencies.services.setContactTopic(
          principal,
          contactId,
          topicId,
          payload,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleRemoveContactTopicRequest(
  request: Request,
  contactId: string,
  topicId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeContact(
        await dependencies.services.removeContactTopic(
          principal,
          contactId,
          topicId,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateContactImportRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  let payload: unknown;
  try {
    payload = await importPayload(request);
  } catch {
    return invalidJson();
  }
  try {
    return json(
      serializeImport(
        await dependencies.services.createContactImport(principal, payload),
      ),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleListContactImportsRequest(
  request: Request,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const imports = await dependencies.services.listContactImports(principal);
    return json({ data: imports.map(serializeImport) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetContactImportRequest(
  request: Request,
  importId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    return json(
      serializeImport(
        await dependencies.services.getContactImport(principal, importId),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleListContactSegmentsRequest(
  request: Request,
  contactId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const contact = await dependencies.services.getContact(
      principal,
      contactId,
    );
    return json({ data: contact.segments }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleListContactTopicsRequest(
  request: Request,
  contactId: string,
  dependencies: SegmentHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const contact = await dependencies.services.getContact(
      principal,
      contactId,
    );
    return json({ data: contact.topics }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateContactTopicsRequest(
  request: Request,
  contactId: string,
  dependencies: SegmentHttpDependencies,
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
    return json(
      serializeContact(
        await dependencies.services.updateContactTopics(
          principal,
          contactId,
          payload,
        ),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}
