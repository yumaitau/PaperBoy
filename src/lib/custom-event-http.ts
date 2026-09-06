import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError, requireKeyScope } from "@/lib/authorization";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  sendCustomEvent,
  updateEvent,
  type EventDefinitionRecord,
  type EventOccurrenceRecord,
} from "@/lib/custom-events";
import { CustomEventError } from "@/lib/custom-event-core";

export type CustomEventHttpServices = {
  create: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<EventDefinitionRecord>;
  delete: (principal: ApiKeyPrincipal, identifier: string) => Promise<void>;
  get: (
    principal: ApiKeyPrincipal,
    identifier: string,
  ) => Promise<EventDefinitionRecord>;
  list: (principal: ApiKeyPrincipal) => Promise<EventDefinitionRecord[]>;
  send: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<EventOccurrenceRecord>;
  update: (
    principal: ApiKeyPrincipal,
    identifier: string,
    payload: unknown,
  ) => Promise<EventDefinitionRecord>;
};

export type CustomEventHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: CustomEventHttpServices;
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

export function customEventFailure(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return json(
      {
        error: {
          code: "forbidden",
          message:
            "The API key creator's current role does not allow this event operation.",
        },
      },
      403,
    );
  }

  if (error instanceof CustomEventError) {
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

    if (error.code === "EVENT_NOT_FOUND") {
      return json(
        {
          error: {
            code: "event_not_found",
            message: "No event with that ID or name exists in this organization.",
          },
        },
        404,
      );
    }

    if (error.code === "EVENT_EXISTS") {
      return json(
        {
          error: {
            code: "event_exists",
            message: "An event with that name already exists in this organization.",
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
          message: "Correct the invalid event fields and try again.",
        },
      },
      422,
    );
  }

  console.error("PaperBoy custom event operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The event operation failed.",
      },
    },
    500,
  );
}

function serializeDefinition(record: EventDefinitionRecord) {
  return {
    created_at: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    object: "event",
    schema: record.schema,
    updated_at: record.updatedAt.toISOString(),
  };
}

function serializeOccurrence(record: EventOccurrenceRecord) {
  return {
    contact_email: record.contactEmail,
    created_at: record.createdAt.toISOString(),
    event_id: record.eventId,
    id: record.id,
    name: record.name,
    payload: record.payload,
  };
}

function actorUserId(principal: ApiKeyPrincipal): string {
  if (!principal.actorUserId) {
    throw new CustomEventError("MEMBERSHIP_REQUIRED");
  }

  return principal.actorUserId;
}

function scoped(
  principal: ApiKeyPrincipal,
  permission: "events.manage" | "events.read",
): string {
  requireKeyScope(principal.scopes, permission);
  return actorUserId(principal);
}

export const customEventApiServices: CustomEventHttpServices = {
  create: (principal, payload) =>
    createEvent({
      actorUserId: scoped(principal, "events.manage"),
      orgId: principal.orgId,
      payload,
    }),
  delete: (principal, identifier) =>
    deleteEvent({
      actorUserId: scoped(principal, "events.manage"),
      identifier,
      orgId: principal.orgId,
    }),
  get: (principal, identifier) =>
    getEvent({
      actorUserId: scoped(principal, "events.read"),
      identifier,
      orgId: principal.orgId,
    }),
  list: (principal) =>
    listEvents({
      actorUserId: scoped(principal, "events.read"),
      orgId: principal.orgId,
    }),
  send: (principal, payload) =>
    sendCustomEvent({
      actorUserId: scoped(principal, "events.manage"),
      orgId: principal.orgId,
      payload,
    }),
  update: (principal, identifier, payload) =>
    updateEvent({
      actorUserId: scoped(principal, "events.manage"),
      identifier,
      orgId: principal.orgId,
      payload,
    }),
};

async function authenticated(
  request: Request,
  dependencies: CustomEventHttpDependencies,
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

export async function handleListEventsRequest(
  request: Request,
  dependencies: CustomEventHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const events = await dependencies.services.list(principal);
    return json({ data: events.map(serializeDefinition) }, 200);
  } catch (error) {
    return customEventFailure(error);
  }
}

export async function handleCreateEventRequest(
  request: Request,
  dependencies: CustomEventHttpDependencies,
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
    const created = await dependencies.services.create(principal, payload);
    return json(serializeDefinition(created), 201);
  } catch (error) {
    return customEventFailure(error);
  }
}

export async function handleGetEventRequest(
  request: Request,
  identifier: string,
  dependencies: CustomEventHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    const event = await dependencies.services.get(principal, identifier);
    return json(serializeDefinition(event), 200);
  } catch (error) {
    return customEventFailure(error);
  }
}

export async function handleUpdateEventRequest(
  request: Request,
  identifier: string,
  dependencies: CustomEventHttpDependencies,
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
      identifier,
      payload,
    );
    return json(serializeDefinition(updated), 200);
  } catch (error) {
    return customEventFailure(error);
  }
}

export async function handleDeleteEventRequest(
  request: Request,
  identifier: string,
  dependencies: CustomEventHttpDependencies,
): Promise<Response> {
  const principal = await authenticated(request, dependencies);
  if (principal instanceof Response) return principal;
  try {
    await dependencies.services.delete(principal, identifier);
    return json({ deleted: true, id: identifier }, 200);
  } catch (error) {
    return customEventFailure(error);
  }
}

export async function handleSendEventRequest(
  request: Request,
  dependencies: CustomEventHttpDependencies,
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
    const occurrence = await dependencies.services.send(principal, payload);
    return json({ data: serializeOccurrence(occurrence) }, 202);
  } catch (error) {
    return customEventFailure(error);
  }
}
