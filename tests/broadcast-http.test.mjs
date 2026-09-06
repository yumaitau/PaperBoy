import assert from "node:assert/strict";
import test from "node:test";
import { BroadcastError } from "../src/lib/broadcast-core.ts";
import {
  handleCancelBroadcastRequest,
  handleCreateBroadcastRequest,
  handleDeleteBroadcastRequest,
  handleGetBroadcastRequest,
  handleListBroadcastClickedLinksRequest,
  handleListBroadcastRecipientsRequest,
  handleListBroadcastsRequest,
  handlePauseBroadcastRequest,
  handleResumeBroadcastRequest,
  handleSendBroadcastRequest,
  handleUpdateBroadcastRequest,
} from "../src/lib/broadcast-http.ts";

const fixedNow = new Date("2026-08-23T03:04:05.678Z");
const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "test",
  orgId: "11111111-1111-4111-8111-111111111111",
};
const record = {
  cancelledAt: null,
  completedAt: fixedNow,
  createdAt: fixedNow,
  environment: "test",
  from: "news@example.com",
  id: "99999999-9999-4999-8999-999999999999",
  name: "Morning edition",
  pausedAt: null,
  progress: {
    cancelled: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    queued: 18,
    suppressed: 2,
    total: 20,
  },
  scheduledFor: null,
  sourceAudienceId: "77777777-7777-4777-8777-777777777777",
  sourceTemplateId: "88888888-8888-4888-8888-888888888888",
  status: "completed",
  templateHtml: "<p>Hello</p>",
  templateName: "Welcome reader",
  templateRequiredVariables: [],
  templateSubject: "Welcome reader",
  templateText: "Hello",
  updatedAt: fixedNow,
};

function request(method, body) {
  return new Request("http://paperboy.test/api/v1/broadcasts", {
    body,
    headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
    method,
  });
}

function services(overrides = {}) {
  return {
    cancel: async () => record,
    create: async () => record,
    delete: async () => undefined,
    get: async () => record,
    list: async () => [record],
    listClickedLinks: async () => [],
    listRecipients: async () => [],
    pause: async () => record,
    resume: async () => record,
    send: async () => record,
    update: async () => record,
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    authenticate: async () => principal,
    services: services(),
    ...overrides,
  };
}

test("broadcast REST create is tenant-bound and returns UTC progress", async () => {
  let received = null;
  const payload = {
    audience_id: record.sourceAudienceId,
    from: "news@example.com",
    name: "Morning edition",
    template_id: record.sourceTemplateId,
  };
  const response = await handleCreateBroadcastRequest(
    request("POST", JSON.stringify(payload)),
    dependencies({
      services: services({
        create: async (receivedPrincipal, receivedPayload) => {
          received = { receivedPayload, receivedPrincipal };
          return record;
        },
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(received, {
    receivedPayload: payload,
    receivedPrincipal: principal,
  });
  assert.equal(body.data.created_at, fixedNow.toISOString());
  assert.equal(body.data.completed_at, fixedNow.toISOString());
  assert.equal(body.data.progress.suppressed, 2);
  assert.equal(body.data.source_audience_id, record.sourceAudienceId);
  assert.equal(body.data.scheduled_at, null);
  assert.equal(body.data.subject, "Welcome reader");
});

test("broadcast REST list, get, and controls share one authenticated service", async () => {
  const calls = [];
  const deps = dependencies({
    services: services({
      cancel: async (received, id) => {
        calls.push(["cancel", received, id]);
        return record;
      },
      get: async (received, id) => {
        calls.push(["get", received, id]);
        return record;
      },
      list: async (received) => {
        calls.push(["list", received]);
        return [record];
      },
      pause: async (received, id) => {
        calls.push(["pause", received, id]);
        return record;
      },
      resume: async (received, id) => {
        calls.push(["resume", received, id]);
        return record;
      },
      update: async (received, id, payload) => {
        calls.push(["update", received, id, payload]);
        return record;
      },
    }),
  });

  const responses = await Promise.all([
    handleListBroadcastsRequest(request("GET"), deps),
    handleGetBroadcastRequest(request("GET"), record.id, deps),
    handlePauseBroadcastRequest(request("POST"), record.id, deps),
    handleResumeBroadcastRequest(request("POST"), record.id, deps),
    handleCancelBroadcastRequest(request("POST"), record.id, deps),
    handleUpdateBroadcastRequest(
      request("PATCH", JSON.stringify({
        scheduled_for: "2026-09-24T22:00:00.000Z",
        subject: "Updated subject",
      })),
      record.id,
      deps,
    ),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200, 200, 200, 200, 200],
  );
  assert.deepEqual(calls, [
    ["list", principal],
    ["get", principal, record.id],
    ["pause", principal, record.id],
    ["resume", principal, record.id],
    ["cancel", principal, record.id],
    [
      "update",
      principal,
      record.id,
      {
        scheduled_for: "2026-09-24T22:00:00.000Z",
        subject: "Updated subject",
      },
    ],
  ]);
});

test("broadcast REST hides cross-tenant records and rejects unauthenticated requests", async () => {
  const hidden = await handleGetBroadcastRequest(
    request("GET"),
    record.id,
    dependencies({
      services: services({
        get: async () => {
          throw new BroadcastError("BROADCAST_NOT_FOUND");
        },
      }),
    }),
  );
  const unauthorized = await handleListBroadcastsRequest(
    request("GET"),
    dependencies({ authenticate: async () => null }),
  );

  assert.equal(hidden.status, 404);
  assert.equal((await hidden.json()).error.code, "broadcast_not_found");
  assert.equal(unauthorized.status, 401);
});

test("broadcast REST deletes drafts, sends on demand, and reports transition conflicts", async () => {
  const calls = [];
  const deps = dependencies({
    services: services({
      delete: async (received, broadcastId) => {
        calls.push(["delete", received, broadcastId]);
      },
      send: async (received, broadcastId, payload) => {
        calls.push(["send", received, broadcastId, payload]);
        return record;
      },
    }),
  });
  const deleted = await handleDeleteBroadcastRequest(
    request("DELETE"),
    record.id,
    deps,
  );
  const sent = await handleSendBroadcastRequest(
    request("POST", JSON.stringify({})),
    record.id,
    deps,
  );
  const conflict = await handleDeleteBroadcastRequest(
    request("DELETE"),
    record.id,
    dependencies({
      services: services({
        delete: async () => {
          throw new BroadcastError("INVALID_TRANSITION");
        },
      }),
    }),
  );

  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), {
    data: { deleted: true, id: record.id },
  });
  assert.equal(sent.status, 200);
  assert.equal(conflict.status, 409);
  assert.equal(
    (await conflict.json()).error.code,
    "invalid_broadcast_transition",
  );
  assert.deepEqual(calls, [
    ["delete", principal, record.id],
    ["send", principal, record.id, {}],
  ]);
});

test("broadcast REST lists recipients and clicked links", async () => {
  const recipient = {
    bouncedAt: null,
    clickedAt: null,
    complainedAt: null,
    contactId: null,
    deliveredAt: fixedNow,
    email: "reader@example.net",
    messageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    openedAt: null,
    position: 0,
    sentAt: fixedNow,
    status: "queued",
    unsubscribed: false,
  };
  const deps = dependencies({
    services: services({
      listRecipients: async (received, broadcastId, filter) => {
        assert.deepEqual(filter, { type: "delivered" });
        return [recipient];
      },
      listClickedLinks: async () => [
        { clickCount: 2, uniqueClicks: 2, url: "https://example.com/news" },
      ],
    }),
  });
  const recipientsUrl = `http://paperboy.test/api/v1/broadcasts/${record.id}/recipients?type=delivered`;
  const recipients = await handleListBroadcastRecipientsRequest(
    new Request(recipientsUrl, {
      headers: { Authorization: "Bearer test" },
    }),
    record.id,
    deps,
  );
  const links = await handleListBroadcastClickedLinksRequest(
    request("GET"),
    record.id,
    deps,
  );
  const recipientsBody = await recipients.json();

  assert.equal(recipients.status, 200);
  assert.equal(recipientsBody.data[0].email, "reader@example.net");
  assert.equal(recipientsBody.data[0].delivered_at, fixedNow.toISOString());
  assert.equal(links.status, 200);
  assert.deepEqual((await links.json()).data, [
    { click_count: 2, unique_clicks: 2, url: "https://example.com/news" },
  ]);
});
