import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError } from "@/lib/authorization";
import type {
  WebhookConfigurationResult,
  WebhookEndpointRecord,
  WebhookEventAttempt,
  WebhookEventRecord,
} from "@/lib/webhooks";
import { WebhookError } from "@/lib/webhook-core";

export type WebhookHttpServices = {
  configure: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<WebhookConfigurationResult>;
  create: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<WebhookConfigurationResult>;
  delete: (principal: ApiKeyPrincipal, webhookId: string) => Promise<void>;
  get: (principal: ApiKeyPrincipal) => Promise<WebhookEndpointRecord | null>;
  getEvent: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    eventId: string,
  ) => Promise<WebhookEventRecord>;
  getWebhook: (
    principal: ApiKeyPrincipal,
    webhookId: string,
  ) => Promise<WebhookEndpointRecord>;
  list: (principal: ApiKeyPrincipal) => Promise<WebhookEndpointRecord[]>;
  listEventAttempts: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    eventId: string,
  ) => Promise<WebhookEventAttempt[]>;
  listEvents: (
    principal: ApiKeyPrincipal,
    webhookId: string,
  ) => Promise<WebhookEventRecord[]>;
  replayEvent: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    eventId: string,
  ) => Promise<WebhookEventRecord>;
  update: (
    principal: ApiKeyPrincipal,
    webhookId: string,
    payload: unknown,
  ) => Promise<WebhookConfigurationResult>;
};

type WebhookHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: WebhookHttpServices;
};

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store", ...headers },
    status,
  });
}

function serialize(endpoint: WebhookEndpointRecord) {
  return {
    created_at: endpoint.createdAt.toISOString(),
    enabled: endpoint.enabled,
    id: endpoint.id,
    updated_at: endpoint.updatedAt.toISOString(),
    url: endpoint.url,
  };
}

function serializeEvent(event: WebhookEventRecord) {
  return {
    attempt_count: event.attemptCount,
    created_at: event.createdAt.toISOString(),
    delivered_at: event.deliveredAt?.toISOString() ?? null,
    endpoint_id: event.endpointId,
    event_type: event.eventType,
    failed_at: event.failedAt?.toISOString() ?? null,
    failure_reason: event.failureReason,
    id: event.id,
    last_attempt_at: event.lastAttemptAt?.toISOString() ?? null,
    last_error_code: event.lastErrorCode,
    response_status: event.responseStatus,
    status: event.status,
    updated_at: event.updatedAt.toISOString(),
    url: event.url,
  };
}

function serializeAttempt(attempt: WebhookEventAttempt) {
  return {
    attempt_count: attempt.attemptCount,
    attempted_at: attempt.attemptedAt?.toISOString() ?? null,
    failure_reason: attempt.failureReason,
    last_error_code: attempt.lastErrorCode,
    response_status: attempt.responseStatus,
    status: attempt.status,
  };
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
            "The API key creator's current role does not allow webhook configuration.",
        },
      },
      403,
    );
  }

  if (error instanceof WebhookError) {
    if (error.code === "MEMBERSHIP_REQUIRED") {
      return json(
        {
          error: {
            code: "membership_required",
            message: "Create a new API key from a current organization admin.",
          },
        },
        403,
      );
    }

    if (error.code === "WEBHOOK_NOT_FOUND" || error.code === "EVENT_NOT_FOUND") {
      return json(
        {
          error: {
            code: "webhook_not_found",
            message: "No webhook or event with that ID exists in this organization.",
          },
        },
        404,
      );
    }

    if (error.code === "ENDPOINT_DISABLED") {
      return json(
        {
          error: {
            code: "webhook_disabled",
            message: "Enable the webhook before replaying its events.",
          },
        },
        422,
      );
    }

    if (error.code === "INVALID_INPUT" || error.code === "INVALID_URL") {
      return json(
        {
          error: {
            code: "invalid_webhook_url",
            message:
              "Provide one HTTPS webhook URL without embedded credentials or a fragment.",
          },
        },
        422,
      );
    }

    return json(
      {
        error: {
          code: "webhook_configuration_unavailable",
          message:
            "Webhook secret encryption is unavailable. Ask the operator to check PAPERBOY_WEBHOOK_ENCRYPTION_KEY.",
        },
      },
      503,
    );
  }

  console.error("PaperBoy webhook configuration operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The webhook operation failed.",
      },
    },
    500,
  );
}

async function principal(
  request: Request,
  dependencies: WebhookHttpDependencies,
): Promise<ApiKeyPrincipal | Response> {
  return (await dependencies.authenticate(request)) ?? unauthorized();
}

export async function handleGetWebhookRequest(
  request: Request,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const endpoint = await dependencies.services.get(authenticated);
    return json({ data: endpoint ? serialize(endpoint) : null }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleConfigureWebhookRequest(
  request: Request,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json(
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
      400,
    );
  }

  try {
    const configured = await dependencies.services.configure(
      authenticated,
      payload,
    );
    return json(
      {
        data: {
          ...serialize(configured.endpoint),
          signing_secret: configured.signingSecret,
        },
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

async function requestPayload(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SyntaxError("INVALID_JSON");
  }
}

function badJson(): Response {
  return json(
    {
      error: {
        code: "invalid_json",
        message: "Request body must be valid JSON.",
      },
    },
    400,
  );
}

export async function handleListWebhooksRequest(
  request: Request,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const endpoints = await dependencies.services.list(authenticated);
    return json({ data: endpoints.map(serialize) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateWebhookRequest(
  request: Request,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  let payload: unknown;

  try {
    payload = await requestPayload(request);
  } catch {
    return badJson();
  }

  try {
    const created = await dependencies.services.create(authenticated, payload);
    return json(
      {
        ...serialize(created.endpoint),
        signing_secret: created.signingSecret,
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetWebhookByIdRequest(
  request: Request,
  webhookId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    return json(
      serialize(await dependencies.services.getWebhook(authenticated, webhookId)),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateWebhookRequest(
  request: Request,
  webhookId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  let payload: unknown;

  try {
    payload = await requestPayload(request);
  } catch {
    return badJson();
  }

  try {
    const updated = await dependencies.services.update(
      authenticated,
      webhookId,
      payload,
    );
    return json(
      {
        ...serialize(updated.endpoint),
        signing_secret: updated.signingSecret,
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteWebhookRequest(
  request: Request,
  webhookId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    await dependencies.services.delete(authenticated, webhookId);
    return json({ deleted: true, id: webhookId }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleListWebhookEventsRequest(
  request: Request,
  webhookId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const events = await dependencies.services.listEvents(authenticated, webhookId);
    return json({ data: events.map(serializeEvent) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetWebhookEventRequest(
  request: Request,
  webhookId: string,
  eventId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    return json(
      serializeEvent(
        await dependencies.services.getEvent(authenticated, webhookId, eventId),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleReplayWebhookEventRequest(
  request: Request,
  webhookId: string,
  eventId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    return json(
      serializeEvent(
        await dependencies.services.replayEvent(authenticated, webhookId, eventId),
      ),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleListWebhookEventAttemptsRequest(
  request: Request,
  webhookId: string,
  eventId: string,
  dependencies: WebhookHttpDependencies,
): Promise<Response> {
  const authenticated = await principal(request, dependencies);

  if (authenticated instanceof Response) {
    return authenticated;
  }

  try {
    const attempts = await dependencies.services.listEventAttempts(
      authenticated,
      webhookId,
      eventId,
    );
    return json({ data: attempts.map(serializeAttempt) }, 200);
  } catch (error) {
    return failure(error);
  }
}
