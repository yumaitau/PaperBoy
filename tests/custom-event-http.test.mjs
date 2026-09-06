import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError } from "../src/lib/authorization.ts";
import { CustomEventError } from "../src/lib/custom-event-core.ts";
import {
  handleCreateEventRequest,
  handleDeleteEventRequest,
  handleGetEventRequest,
  handleListEventsRequest,
  handleSendEventRequest,
  handleUpdateEventRequest,
} from "../src/lib/custom-event-http.ts";

const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "live",
  orgId: "11111111-1111-4111-8111-111111111111",
  scopes: null,
};
const fixedNow = new Date("2026-08-23T04:05:06.789Z");
const definition = {
  createdAt: fixedNow,
  id: "33333333-3333-4333-8333-333333333333",
  name: "signup",
  schema: null,
  updatedAt: fixedNow,
};
const occurrence = {
  contactEmail: "reader@example.net",
  createdAt: fixedNow,
  eventId: definition.id,
  id: "44444444-4444-4434-8344-444444444444",
  name: "signup",
  payload: {},
};

function services(overrides = {}) {
  return {
    create: async () => definition,
    delete: async () => undefined,
    get: async () => definition,
    list: async () => [definition],
    send: async () => occurrence,
    update: async () => definition,
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

function request(url, method, body, authorization = "Bearer valid") {
  return new Request(url, {
    body: body === undefined ? undefined : body,
    headers: {
      Authorization: authorization,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method,
  });
}

const eventsUrl = "https://paperboy.test/api/v1/events";

test("custom event definitions serialize with an object discriminator", async () => {
  const calls = [];
  const deps = dependencies({
    services: services({
      create: async (received, payload) => {
        calls.push(["create", received, payload]);
        return definition;
      },
      list: async (received) => {
        calls.push(["list", received]);
        return [definition];
      },
    }),
  });
  const listResponse = await handleListEventsRequest(
    request(eventsUrl, "GET"),
    deps,
  );
  const createResponse = await handleCreateEventRequest(
    request(eventsUrl, "POST", JSON.stringify({ name: "signup" })),
    deps,
  );
  const getResponse = await handleGetEventRequest(
    request(`${eventsUrl}/signup`, "GET"),
    "signup",
    deps,
  );
  const updateResponse = await handleUpdateEventRequest(
    request(`${eventsUrl}/signup`, "PATCH", JSON.stringify({ name: "signup" })),
    "signup",
    deps,
  );
  const deleteResponse = await handleDeleteEventRequest(
    request(`${eventsUrl}/signup`, "DELETE"),
    "signup",
    deps,
  );

  assert.equal(listResponse.status, 200);
  assert.equal(createResponse.status, 201);
  assert.equal(getResponse.status, 200);
  assert.equal(updateResponse.status, 200);
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual((await listResponse.json()).data[0], {
    created_at: fixedNow.toISOString(),
    id: definition.id,
    name: "signup",
    object: "event",
    schema: null,
    updated_at: fixedNow.toISOString(),
  });
  assert.deepEqual(await deleteResponse.json(), {
    deleted: true,
    id: "signup",
  });
  assert.deepEqual(calls[0], ["list", principal]);
  assert.deepEqual(calls[1], ["create", principal, { name: "signup" }]);
});

test("sending an event returns 202 with the occurrence", async () => {
  const calls = [];
  const deps = dependencies({
    services: services({
      send: async (received, payload) => {
        calls.push([received, payload]);
        return occurrence;
      },
    }),
  });
  const response = await handleSendEventRequest(
    request(
      `${eventsUrl}/send`,
      "POST",
      JSON.stringify({ email: "reader@example.net", event: "signup" }),
    ),
    deps,
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.data.name, "signup");
  assert.equal(body.data.contact_email, "reader@example.net");
  assert.deepEqual(calls, [
    [principal, { email: "reader@example.net", event: "signup" }],
  ]);
});

test("duplicate names, unknown events, and forbidden roles are explicit", async () => {
  const exists = await handleCreateEventRequest(
    request(eventsUrl, "POST", JSON.stringify({ name: "signup" })),
    dependencies({
      services: services({
        create: async () => {
          throw new CustomEventError("EVENT_EXISTS");
        },
      }),
    }),
  );
  const missing = await handleGetEventRequest(
    request(`${eventsUrl}/nope`, "GET"),
    "nope",
    dependencies({
      services: services({
        get: async () => {
          throw new CustomEventError("EVENT_NOT_FOUND");
        },
      }),
    }),
  );
  const forbidden = await handleSendEventRequest(
    request(`${eventsUrl}/send`, "POST", JSON.stringify({})),
    dependencies({
      services: services({
        send: async () => {
          throw new AuthorizationError("events.manage");
        },
      }),
    }),
  );

  assert.equal(exists.status, 409);
  assert.equal((await exists.json()).error.code, "event_exists");
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "event_not_found");
  assert.equal(forbidden.status, 403);
});
