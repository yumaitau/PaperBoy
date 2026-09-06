import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError } from "../src/lib/authorization.ts";
import { ApiKeyError } from "../src/lib/api-keys.ts";
import {
  handleCreateApiKeyRequest,
  handleGetApiKeyRequest,
  handleListApiKeysRequest,
  handleRevokeApiKeyRequest,
  handleUpdateApiKeyRequest,
} from "../src/lib/api-key-http.ts";

const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "live",
  orgId: "11111111-1111-4111-8111-111111111111",
  scopes: null,
};
const fixedNow = new Date("2026-08-23T04:05:06.789Z");
const apiKeyId = "33333333-3333-4333-8333-333333333333";
const record = {
  createdAt: fixedNow,
  display: "pb_live_abc_••••••••",
  environment: "live",
  id: apiKeyId,
  keyId: "abc",
  lastUsedAt: null,
  name: "Warehouse",
  revokedAt: null,
  scopes: null,
};

function services(overrides = {}) {
  return {
    create: async () => ({
      display: record.display,
      environment: record.environment,
      id: record.id,
      name: record.name,
      rawKey: "pb_live_abc_secret",
      scopes: null,
    }),
    get: async () => record,
    list: async () => [record],
    revoke: async () => undefined,
    update: async () => record,
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    authenticate: async (request) =>
      request.headers.get("authorization") === "Bearer valid"
        ? principal
        : null,
    services: services(),
    ...overrides,
  };
}

function request(method, body, authorization = "Bearer valid") {
  return new Request("https://paperboy.test/api/v1/api-keys", {
    body: body === undefined ? undefined : body,
    headers: {
      Authorization: authorization,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method,
  });
}

test("API key REST management stays bound to the authenticated principal", async () => {
  const calls = [];
  const scoped = services({
    create: async (received, payload) => {
      calls.push(["create", received, payload]);
      return {
        display: record.display,
        environment: "live",
        id: record.id,
        name: "Warehouse",
        rawKey: "pb_live_abc_secret",
        scopes: null,
      };
    },
    get: async (received, keyId) => {
      calls.push(["get", received, keyId]);
      return record;
    },
    list: async (received) => {
      calls.push(["list", received]);
      return [record];
    },
    revoke: async (received, keyId) => {
      calls.push(["revoke", received, keyId]);
    },
    update: async (received, keyId, payload) => {
      calls.push(["update", received, keyId, payload]);
      return record;
    },
  });
  const deps = dependencies({ services: scoped });
  const createPayload = { environment: "live", name: "Warehouse" };
  const listResponse = await handleListApiKeysRequest(request("GET"), deps);
  const createResponse = await handleCreateApiKeyRequest(
    request("POST", JSON.stringify(createPayload)),
    deps,
  );
  const getResponse = await handleGetApiKeyRequest(request("GET"), apiKeyId, deps);
  const updateResponse = await handleUpdateApiKeyRequest(
    request("PATCH", JSON.stringify({ name: "Updated" })),
    apiKeyId,
    deps,
  );
  const revokeResponse = await handleRevokeApiKeyRequest(
    request("DELETE"),
    apiKeyId,
    deps,
  );

  assert.equal(listResponse.status, 200);
  assert.equal(createResponse.status, 201);
  assert.equal(getResponse.status, 200);
  assert.equal(updateResponse.status, 200);
  assert.equal(revokeResponse.status, 200);
  assert.deepEqual((await listResponse.json()).data[0], {
    created_at: fixedNow.toISOString(),
    display: record.display,
    environment: "live",
    id: apiKeyId,
    key_id: "abc",
    last_used_at: null,
    name: "Warehouse",
    revoked_at: null,
    scopes: null,
  });
  assert.equal((await createResponse.json()).key, "pb_live_abc_secret");
  assert.deepEqual(await revokeResponse.json(), {
    deleted: true,
    id: apiKeyId,
  });
  assert.deepEqual(calls, [
    ["list", principal],
    ["create", principal, createPayload],
    ["get", principal, apiKeyId],
    ["update", principal, apiKeyId, { name: "Updated" }],
    ["revoke", principal, apiKeyId],
  ]);
});

test("unknown keys return 404 without leaking another tenant", async () => {
  const deps = dependencies({
    services: services({
      get: async () => {
        throw new ApiKeyError("KEY_NOT_FOUND");
      },
    }),
  });
  const response = await handleGetApiKeyRequest(
    request("GET"),
    "22222222-2222-4222-8222-222222222222",
    deps,
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "api_key_not_found");
  assert.equal(JSON.stringify(body).includes(principal.orgId), false);
});

test("invalid JSON, missing membership, and insufficient role are explicit", async () => {
  const invalidJson = await handleCreateApiKeyRequest(
    request("POST", "{bad-json"),
    dependencies(),
  );
  const noMembership = await handleListApiKeysRequest(
    request("GET"),
    dependencies({
      services: services({
        list: async () => {
          throw new ApiKeyError("MEMBERSHIP_REQUIRED");
        },
      }),
    }),
  );
  const forbidden = await handleCreateApiKeyRequest(
    request("POST", "{}"),
    dependencies({
      services: services({
        create: async () => {
          throw new AuthorizationError("apiKeys.create");
        },
      }),
    }),
  );
  const badScopes = await handleCreateApiKeyRequest(
    request("POST", JSON.stringify({ name: "Warehouse", scopes: ["nope"] })),
    dependencies({
      services: services({
        create: async () => {
          throw new ApiKeyError("INVALID_SCOPES");
        },
      }),
    }),
  );

  assert.equal(invalidJson.status, 400);
  assert.equal((await invalidJson.json()).error.code, "invalid_json");
  assert.equal(noMembership.status, 403);
  assert.equal((await noMembership.json()).error.code, "membership_required");
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error.code, "forbidden");
  assert.equal(badScopes.status, 422);
});

test("invalid bearer keys fail before API key services run", async () => {
  let called = false;
  const response = await handleListApiKeysRequest(
    request("GET", undefined, "Bearer invalid"),
    dependencies({
      services: services({
        list: async () => {
          called = true;
          return [];
        },
      }),
    }),
  );

  assert.equal(response.status, 401);
  assert.match(response.headers.get("WWW-Authenticate"), /Bearer/);
  assert.equal(called, false);
});
