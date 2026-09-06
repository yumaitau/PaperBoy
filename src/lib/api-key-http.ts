import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { AuthorizationError, requireKeyScope } from "@/lib/authorization";
import { ApiKeyError } from "@/lib/api-keys";
import {
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} from "@/lib/api-keys";

export type ApiKeyHttpServices = {
  create: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<{
    display: string;
    environment: string;
    id: string;
    name: string;
    rawKey: string;
    scopes: string[] | null;
  }>;
  get: (
    principal: ApiKeyPrincipal,
    apiKeyId: string,
  ) => Promise<Record<string, unknown>>;
  list: (principal: ApiKeyPrincipal) => Promise<Record<string, unknown>[]>;
  revoke: (
    principal: ApiKeyPrincipal,
    apiKeyId: string,
  ) => Promise<void>;
  update: (
    principal: ApiKeyPrincipal,
    apiKeyId: string,
    payload: unknown,
  ) => Promise<Record<string, unknown>>;
};

export type ApiKeyHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  services: ApiKeyHttpServices;
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
            "The API key creator's current role does not allow this API key operation.",
        },
      },
      403,
    );
  }

  if (error instanceof ApiKeyError) {
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

    if (error.code === "KEY_NOT_FOUND") {
      return json(
        {
          error: {
            code: "api_key_not_found",
            message: "No API key with that ID exists in this organization.",
          },
        },
        404,
      );
    }

    return json(
      {
        error: {
          code: "validation_error",
          message:
            "Provide a key name of 1-80 characters, a live or test environment, and scopes within your role.",
        },
      },
      422,
    );
  }

  console.error("PaperBoy API key operation failed.");
  return json(
    {
      error: {
        code: "internal_error",
        message: "The API key operation failed.",
      },
    },
    500,
  );
}

function serialize(record: Record<string, unknown>) {
  const createdAt = record["createdAt"];
  const lastUsedAt = record["lastUsedAt"];
  const revokedAt = record["revokedAt"];

  return {
    created_at: createdAt instanceof Date ? createdAt.toISOString() : null,
    display: record["display"] ?? null,
    environment: record["environment"],
    id: record["id"],
    key_id: record["keyId"],
    last_used_at: lastUsedAt instanceof Date ? lastUsedAt.toISOString() : null,
    name: record["name"],
    revoked_at: revokedAt instanceof Date ? revokedAt.toISOString() : null,
    scopes: (record["scopes"] as string[] | null) ?? null,
  };
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiKeyError("INVALID_NAME");
  }

  return payload as Record<string, unknown>;
}

export async function handleListApiKeysRequest(
  request: Request,
  dependencies: ApiKeyHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);

  if (!principal) {
    return unauthorized();
  }

  try {
    const keys = await dependencies.services.list(principal);
    return json({ data: keys.map(serialize) }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateApiKeyRequest(
  request: Request,
  dependencies: ApiKeyHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);

  if (!principal) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
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

  try {
    const created = await dependencies.services.create(principal, payload);
    return json(
      {
        display: created.display,
        environment: created.environment,
        id: created.id,
        key: created.rawKey,
        name: created.name,
        scopes: created.scopes,
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetApiKeyRequest(
  request: Request,
  apiKeyId: string,
  dependencies: ApiKeyHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);

  if (!principal) {
    return unauthorized();
  }

  try {
    return json(serialize(await dependencies.services.get(principal, apiKeyId)), 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateApiKeyRequest(
  request: Request,
  apiKeyId: string,
  dependencies: ApiKeyHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);

  if (!principal) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
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

  try {
    return json(
      serialize(await dependencies.services.update(principal, apiKeyId, payload)),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleRevokeApiKeyRequest(
  request: Request,
  apiKeyId: string,
  dependencies: ApiKeyHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);

  if (!principal) {
    return unauthorized();
  }

  try {
    await dependencies.services.revoke(principal, apiKeyId);
    return json({ deleted: true, id: apiKeyId }, 200);
  } catch (error) {
    return failure(error);
  }
}

const API_KEY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function developerKeyId(apiKeyId: string): void {
  if (!API_KEY_ID_PATTERN.test(apiKeyId)) {
    throw new ApiKeyError("KEY_NOT_FOUND");
  }
}

export const apiKeyApiServices: ApiKeyHttpServices = {
  create: (principal, payload) => {
    requireKeyScope(principal.scopes, "apiKeys.create");

    if (!principal.actorUserId) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    const input = payloadRecord(payload);

    return createApiKey({
      actorUserId: principal.actorUserId,
      environment: input["environment"] ?? "live",
      name: input["name"],
      orgId: principal.orgId,
      scopes: Object.hasOwn(input, "scopes") ? input["scopes"] : undefined,
    });
  },
  get: (principal, apiKeyId) => {
    requireKeyScope(principal.scopes, "apiKeys.read");

    if (!principal.actorUserId) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    developerKeyId(apiKeyId);

    return getApiKey({
      actorUserId: principal.actorUserId,
      apiKeyId,
      orgId: principal.orgId,
    }) as Promise<Record<string, unknown>>;
  },
  list: (principal) => {
    requireKeyScope(principal.scopes, "apiKeys.read");

    if (!principal.actorUserId) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    return listApiKeys({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
    }) as Promise<Record<string, unknown>[]>;
  },
  revoke: (principal, apiKeyId) => {
    requireKeyScope(principal.scopes, "apiKeys.revoke");

    if (!principal.actorUserId) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    developerKeyId(apiKeyId);

    return revokeApiKey({
      actorUserId: principal.actorUserId,
      apiKeyId,
      orgId: principal.orgId,
    });
  },
  update: (principal, apiKeyId, payload) => {
    requireKeyScope(principal.scopes, "apiKeys.update");

    if (!principal.actorUserId) {
      throw new ApiKeyError("MEMBERSHIP_REQUIRED");
    }

    developerKeyId(apiKeyId);
    const input = payloadRecord(payload);

    return updateApiKey({
      actorUserId: principal.actorUserId,
      apiKeyId,
      name: Object.hasOwn(input, "name") ? input["name"] : undefined,
      orgId: principal.orgId,
      scopes: Object.hasOwn(input, "scopes") ? input["scopes"] : undefined,
    }) as Promise<Record<string, unknown>>;
  },
};
