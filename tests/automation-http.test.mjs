import assert from "node:assert/strict";
import test from "node:test";
import { AutomationError } from "../src/lib/automation-core.ts";
import {
  handleCreateAutomationRequest,
  handleDeleteAutomationRequest,
  handleDuplicateAutomationRequest,
  handleGetAutomationRequest,
  handleGetAutomationRunRequest,
  handleListAutomationRunsRequest,
  handleListAutomationsRequest,
  handleStopAutomationRequest,
  handleUpdateAutomationRequest,
} from "../src/lib/automation-http.ts";

const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "live",
  orgId: "11111111-1111-4111-8111-111111111111",
  scopes: null,
};
const fixedNow = new Date("2026-08-23T04:05:06.789Z");
const automation = {
  connections: [],
  createdAt: fixedNow,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Welcome series",
  status: "disabled",
  steps: [{ event: "signup", type: "trigger" }],
  triggerEvent: "signup",
  updatedAt: fixedNow,
};
const run = {
  automationId: automation.id,
  createdAt: fixedNow,
  id: "44444444-4444-4434-8344-444444444444",
  occurrenceId: null,
  status: "completed",
  updatedAt: fixedNow,
};

function services(overrides = {}) {
  return {
    create: async () => automation,
    delete: async () => undefined,
    duplicate: async () => automation,
    get: async () => automation,
    getRun: async () => run,
    list: async () => [automation],
    listRuns: async () => [run],
    stop: async () => ({ ...automation, status: "disabled" }),
    update: async () => automation,
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

const automationsUrl = "https://paperboy.test/api/v1/automations";

test("automation CRUD serializes trigger events and stays principal-bound", async () => {
  const calls = [];
  const deps = dependencies({
    services: services({
      create: async (received, payload) => {
        calls.push(["create", received, payload]);
        return automation;
      },
      list: async (received, filter) => {
        calls.push(["list", received, filter]);
        return [automation];
      },
    }),
  });
  const payload = {
    name: "Welcome series",
    steps: [{ event: "signup", type: "trigger" }],
  };
  const listResponse = await handleListAutomationsRequest(
    request(automationsUrl, "GET"),
    deps,
  );
  const createResponse = await handleCreateAutomationRequest(
    request(automationsUrl, "POST", JSON.stringify(payload)),
    deps,
  );
  const getResponse = await handleGetAutomationRequest(
    request(`${automationsUrl}/${automation.id}`, "GET"),
    automation.id,
    deps,
  );
  const duplicateResponse = await handleDuplicateAutomationRequest(
    request(`${automationsUrl}/${automation.id}/duplicate`, "POST"),
    automation.id,
    deps,
  );
  const stopResponse = await handleStopAutomationRequest(
    request(`${automationsUrl}/${automation.id}/stop`, "POST"),
    automation.id,
    deps,
  );
  const runsResponse = await handleListAutomationRunsRequest(
    request(`${automationsUrl}/${automation.id}/runs`, "GET"),
    automation.id,
    deps,
  );
  const runResponse = await handleGetAutomationRunRequest(
    request(`${automationsUrl}/${automation.id}/runs/${run.id}`, "GET"),
    automation.id,
    run.id,
    deps,
  );

  assert.equal(listResponse.status, 200);
  assert.equal(createResponse.status, 201);
  assert.equal(getResponse.status, 200);
  assert.equal(duplicateResponse.status, 201);
  assert.equal(stopResponse.status, 200);
  assert.equal(runsResponse.status, 200);
  assert.equal(runResponse.status, 200);
  assert.deepEqual((await listResponse.json()).data[0], {
    connections: [],
    created_at: fixedNow.toISOString(),
    id: automation.id,
    name: "Welcome series",
    status: "disabled",
    steps: [{ event: "signup", type: "trigger" }],
    trigger_event: "signup",
    updated_at: fixedNow.toISOString(),
  });
  assert.equal((await runsResponse.json()).data.length, 1);
  assert.deepEqual(calls[0], ["list", principal, {}]);
  assert.deepEqual(calls[1], ["create", principal, payload]);
});

test("unknown automations and invalid steps are explicit", async () => {
  const missing = await handleGetAutomationRequest(
    request(`${automationsUrl}/22222222-2222-4222-8222-222222222222`, "GET"),
    "22222222-2222-4222-8222-222222222222",
    dependencies({
      services: services({
        get: async () => {
          throw new AutomationError("AUTOMATION_NOT_FOUND");
        },
      }),
    }),
  );
  const badDelete = await handleDeleteAutomationRequest(
    request(`${automationsUrl}/${automation.id}`, "DELETE"),
    automation.id,
    dependencies({
      services: services({
        delete: async () => {
          throw new AutomationError("RUN_NOT_FOUND");
        },
      }),
    }),
  );

  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "automation_not_found");
  assert.equal(badDelete.status, 404);
});

test("automation updates validate step graphs", async () => {
  const deps = dependencies({
    services: services({
      update: async () => {
        throw new AutomationError("VALIDATION_ERROR", [
          { field: "steps", message: "Provide a trigger step." },
        ]);
      },
    }),
  });
  const response = await handleUpdateAutomationRequest(
    request(
      `${automationsUrl}/${automation.id}`,
      "PATCH",
      JSON.stringify({ steps: [] }),
    ),
    automation.id,
    deps,
  );

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "validation_error");
});
