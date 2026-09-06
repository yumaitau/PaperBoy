import assert from "node:assert/strict";
import test from "node:test";
import { RequestLogError } from "../src/lib/request-logs.ts";
import {
  handleGetLogRequest,
  handleListLogsRequest,
} from "../src/lib/log-http.ts";

const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "live",
  orgId: "11111111-1111-4111-8111-111111111111",
  scopes: null,
};
const fixedNow = new Date("2026-08-23T04:05:06.789Z");
const record = {
  apiKeyId: principal.apiKeyId,
  createdAt: fixedNow,
  durationMs: 12,
  environment: "live",
  id: "33333333-3333-4333-8333-333333333333",
  method: "POST",
  orgId: principal.orgId,
  path: "/api/v1/emails",
  status: 200,
  userAgent: "test",
};

function dependencies(overrides = {}) {
  return {
    authenticate: async (request) =>
      request.headers.get("authorization") === "Bearer valid"
        ? principal
        : null,
    services: {
      get: async () => record,
      list: async () => [record],
      ...overrides,
    },
  };
}

function request(url, authorization = "Bearer valid") {
  return new Request(url, { headers: { Authorization: authorization } });
}

const logsUrl = "https://paperboy.test/api/v1/logs";

test("log listing serializes request metadata", async () => {
  const calls = [];
  const deps = dependencies({
    services: {
      get: async () => record,
      list: async (received, filter) => {
        calls.push([received, filter]);
        return [record];
      },
    },
  });
  const listResponse = await handleListLogsRequest(
    request(`${logsUrl}?limit=10`),
    deps,
  );
  const getResponse = await handleGetLogRequest(
    request(`${logsUrl}/${record.id}`),
    record.id,
    deps,
  );

  assert.equal(listResponse.status, 200);
  assert.equal(getResponse.status, 200);
  assert.deepEqual((await listResponse.json()).data[0], {
    api_key_id: principal.apiKeyId,
    created_at: fixedNow.toISOString(),
    duration_ms: 12,
    environment: "live",
    id: record.id,
    method: "POST",
    object: "log",
    path: "/api/v1/emails",
    response_status: 200,
    user_agent: "test",
  });
  assert.deepEqual(calls, [[principal, { limit: 10 }]]);
});

test("unknown logs and cursor errors are explicit", async () => {
  const missing = await handleGetLogRequest(
    request(`${logsUrl}/22222222-2222-4222-8222-222222222222`),
    "22222222-2222-4222-8222-222222222222",
    dependencies({
      services: {
        get: async () => {
          throw new RequestLogError("LOG_NOT_FOUND");
        },
        list: async () => [],
      },
    }),
  );
  const badCursor = await handleListLogsRequest(
    request(`${logsUrl}?after=not-a-uuid`),
    dependencies({
      services: {
        get: async () => record,
        list: async () => {
          throw new RequestLogError("VALIDATION_ERROR", [
            { field: "after", message: "Provide a valid log UUID." },
          ]);
        },
      },
    }),
  );

  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "log_not_found");
  assert.equal(badCursor.status, 422);
});
