import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError } from "../src/lib/authorization.ts";
import { WebhookError } from "../src/lib/webhook-core.ts";
import {
  handleConfigureWebhookRequest,
  handleCreateWebhookRequest,
  handleDeleteWebhookRequest,
  handleGetWebhookByIdRequest,
  handleGetWebhookEventRequest,
  handleGetWebhookRequest,
  handleListWebhookEventsRequest,
  handleListWebhooksRequest,
  handleReplayWebhookEventRequest,
  handleUpdateWebhookRequest,
} from "../src/lib/webhook-http.ts";

const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "live",
  orgId: "11111111-1111-4111-8111-111111111111",
};
const endpoint = {
  createdAt: new Date("2026-08-24T01:00:00.000Z"),
  enabled: true,
  id: "22222222-2222-4222-8222-222222222222",
  updatedAt: new Date("2026-08-24T01:01:00.000Z"),
  url: "https://hooks.example.com/paperboy",
};
const delivery = {
  attemptCount: 1,
  createdAt: new Date("2026-08-24T01:02:00.000Z"),
  deliveredAt: new Date("2026-08-24T01:02:03.000Z"),
  endpointId: endpoint.id,
  eventType: "email.delivered",
  failedAt: null,
  failureReason: null,
  id: "33333333-3333-4333-8333-333333333333",
  lastAttemptAt: new Date("2026-08-24T01:02:03.000Z"),
  lastErrorCode: null,
  responseStatus: 200,
  status: "delivered",
  updatedAt: new Date("2026-08-24T01:02:03.000Z"),
  url: endpoint.url,
};

function request(method = "GET", body) {
  return new Request("https://paperboy.test/api/v1/webhooks", {
    body,
    headers: { Authorization: "Bearer test-key" },
    method,
  });
}

function dependencies(overrides = {}) {
  return {
    authenticate: async (received) =>
      received.headers.has("authorization") ? principal : null,
    services: {
      configure: async () => ({
        endpoint,
        signingSecret: "whsec_shown-once",
      }),
      create: async () => ({
        endpoint,
        signingSecret: "whsec_shown-once",
      }),
      delete: async () => undefined,
      get: async () => endpoint,
      getEvent: async () => delivery,
      getWebhook: async () => endpoint,
      list: async () => [endpoint],
      listEventAttempts: async () => [],
      listEvents: async () => [delivery],
      replayEvent: async () => delivery,
      update: async () => ({ endpoint, signingSecret: null }),
      ...overrides,
    },
  };
}

test("webhook REST configuration returns its signing secret once with UTC", async () => {
  let received;
  const response = await handleConfigureWebhookRequest(
    request("PUT", JSON.stringify({ url: endpoint.url })),
    dependencies({
      async configure(receivedPrincipal, payload) {
        received = [receivedPrincipal, payload];
        return { endpoint, signingSecret: "whsec_shown-once" };
      },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(received, [principal, { url: endpoint.url }]);
  assert.equal(body.data.signing_secret, "whsec_shown-once");
  assert.equal(body.data.created_at, endpoint.createdAt.toISOString());
  assert.equal(body.data.updated_at, endpoint.updatedAt.toISOString());
});

test("webhook REST reads configuration without returning encrypted or raw secrets", async () => {
  const response = await handleGetWebhookRequest(request(), dependencies());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    data: {
      created_at: endpoint.createdAt.toISOString(),
      enabled: true,
      id: endpoint.id,
      updated_at: endpoint.updatedAt.toISOString(),
      url: endpoint.url,
    },
  });
  assert.equal(JSON.stringify(body).includes("secret"), false);
});

test("webhook REST rejects invalid JSON, invalid URLs, and insufficient roles", async () => {
  const invalidJson = await handleConfigureWebhookRequest(
    request("PUT", "{"),
    dependencies(),
  );
  const invalidUrl = await handleConfigureWebhookRequest(
    request("PUT", JSON.stringify({ url: "http://public.example.com" })),
    dependencies({
      async configure() {
        throw new WebhookError("INVALID_URL");
      },
    }),
  );
  const forbidden = await handleGetWebhookRequest(
    request(),
    dependencies({
      async get() {
        throw new AuthorizationError("webhooks.read");
      },
    }),
  );

  assert.equal(invalidJson.status, 400);
  assert.equal(invalidUrl.status, 422);
  assert.equal(forbidden.status, 403);
});

test("webhook REST manages multiple endpoints", async () => {
  const calls = [];
  const deps = dependencies({
    create: async (received, payload) => {
      calls.push(["create", received, payload]);
      return { endpoint, signingSecret: "whsec_shown-once" };
    },
    update: async (received, webhookId, payload) => {
      calls.push(["update", received, webhookId, payload]);
      return { endpoint, signingSecret: null };
    },
    delete: async (received, webhookId) => {
      calls.push(["delete", received, webhookId]);
    },
  });
  const listResponse = await handleListWebhooksRequest(request(), deps);
  const createResponse = await handleCreateWebhookRequest(
    request("POST", JSON.stringify({ url: endpoint.url })),
    deps,
  );
  const getResponse = await handleGetWebhookByIdRequest(
    request(),
    endpoint.id,
    deps,
  );
  const updateResponse = await handleUpdateWebhookRequest(
    request("PATCH", JSON.stringify({ enabled: false })),
    endpoint.id,
    deps,
  );
  const deleteResponse = await handleDeleteWebhookRequest(
    request("DELETE"),
    endpoint.id,
    deps,
  );

  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).data.length, 1);
  assert.equal(createResponse.status, 201);
  assert.equal((await createResponse.json()).signing_secret, "whsec_shown-once");
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).enabled, true);
  assert.equal(updateResponse.status, 200);
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), {
    deleted: true,
    id: endpoint.id,
  });
  assert.deepEqual(calls, [
    ["create", principal, { url: endpoint.url }],
    ["update", principal, endpoint.id, { enabled: false }],
    ["delete", principal, endpoint.id],
  ]);
});

test("webhook REST reads, replays, and rejects disabled replays", async () => {
  const deps = dependencies();
  const eventsResponse = await handleListWebhookEventsRequest(
    request(),
    endpoint.id,
    deps,
  );
  const eventResponse = await handleGetWebhookEventRequest(
    request(),
    endpoint.id,
    delivery.id,
    deps,
  );
  const replayResponse = await handleReplayWebhookEventRequest(
    request("POST"),
    endpoint.id,
    delivery.id,
    deps,
  );
  const disabled = await handleReplayWebhookEventRequest(
    request("POST"),
    endpoint.id,
    delivery.id,
    dependencies({
      replayEvent: async () => {
        throw new WebhookError("ENDPOINT_DISABLED");
      },
    }),
  );
  const missing = await handleGetWebhookEventRequest(
    request(),
    endpoint.id,
    "00000000-0000-4000-8000-000000000000",
    dependencies({
      getEvent: async () => {
        throw new WebhookError("EVENT_NOT_FOUND");
      },
    }),
  );

  assert.equal(eventsResponse.status, 200);
  assert.equal((await eventsResponse.json()).data.length, 1);
  assert.equal(eventResponse.status, 200);
  assert.equal((await eventResponse.json()).event_type, "email.delivered");
  assert.equal(replayResponse.status, 200);
  assert.equal(disabled.status, 422);
  assert.equal((await disabled.json()).error.code, "webhook_disabled");
  assert.equal(missing.status, 404);
});
