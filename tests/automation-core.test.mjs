import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationError,
  parseCreateAutomationInput,
  parseUpdateAutomationInput,
} from "../src/lib/automation-core.ts";
import {
  CustomEventError,
  parseCreateEventInput,
  parseSendEventInput,
  parseUpdateEventInput,
  validateEventPayload,
} from "../src/lib/custom-event-core.ts";

test("event definitions reject reserved prefixes", () => {
  assert.deepEqual(parseCreateEventInput({ name: " signup " }), {
    name: "signup",
    schema: null,
  });
  assert.deepEqual(
    parseCreateEventInput({ name: "signup", schema: { plan: "string" } }),
    { name: "signup", schema: { plan: "string" } },
  );
  assert.throws(
    () => parseCreateEventInput({ name: "resend:signup" }),
    (error) => error instanceof CustomEventError,
  );
  assert.throws(
    () => parseCreateEventInput({ name: "signup", schema: { plan: "uuid" } }),
    (error) => error instanceof CustomEventError,
  );

  const updated = parseUpdateEventInput({ name: "trial" });
  assert.equal(updated.name, "trial");
  assert.throws(
    () => parseUpdateEventInput({}),
    (error) => error instanceof CustomEventError,
  );
});

test("sending requires exactly one contact reference", () => {
  const sent = parseSendEventInput({
    email: "Reader@Example.net",
    event: "signup",
    payload: { plan: "pro" },
  });

  assert.equal(sent.email, "reader@example.net");
  assert.deepEqual(sent.payload, { plan: "pro" });
  assert.throws(
    () =>
      parseSendEventInput({
        contact_id: "33333333-3333-4333-8333-333333333333",
        email: "reader@example.net",
        event: "signup",
      }),
    (error) => error instanceof CustomEventError,
  );
  assert.throws(
    () => parseSendEventInput({ event: "signup" }),
    (error) => error instanceof CustomEventError,
  );
});

test("payloads validate against definition schemas", () => {
  assert.deepEqual(
    validateEventPayload({ plan: "string", seats: "number" }, { plan: "pro" }),
    [],
  );
  assert.deepEqual(
    validateEventPayload({ seats: "number" }, { seats: "many" }),
    [{ field: "payload.seats", message: "Must be a number." }],
  );
  assert.deepEqual(validateEventPayload(null, { anything: 1 }), []);
});

test("automations require a trigger step with an event", () => {
  const created = parseCreateAutomationInput({
    name: "Welcome",
    steps: [{ event: "signup", type: "trigger" }],
  });

  assert.equal(created.triggerEvent, "signup");
  assert.equal(created.status, "disabled");

  assert.throws(
    () => parseCreateAutomationInput({ name: "Welcome", steps: [] }),
    (error) => error instanceof AutomationError,
  );
  assert.throws(
    () =>
      parseCreateAutomationInput({
        name: "Welcome",
        steps: [{ type: "delay" }],
      }),
    (error) => error instanceof AutomationError,
  );

  const updated = parseUpdateAutomationInput({ status: "enabled" });
  assert.equal(updated.status, "enabled");
  assert.throws(
    () => parseUpdateAutomationInput({}),
    (error) => error instanceof AutomationError,
  );
});
