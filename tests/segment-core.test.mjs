import assert from "node:assert/strict";
import test from "node:test";
import {
  SegmentError,
  parseContactImportInput,
  parseCreateContactPropertyInput,
  parseCreateSegmentInput,
  parseCreateTopicInput,
  parseTopLevelCreateContactInput,
  parseTopLevelUpdateContactInput,
  parseUpdateTopicInput,
} from "../src/lib/segment-core.ts";

test("segment names are required and bounded", () => {
  assert.deepEqual(parseCreateSegmentInput({ name: " Weekly " }), {
    name: "Weekly",
  });
  assert.throws(
    () => parseCreateSegmentInput({ name: " " }),
    (error) => error instanceof SegmentError && error.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () => parseCreateSegmentInput({ name: "x".repeat(121) }),
    (error) => error instanceof SegmentError,
  );
});

test("topics require an immutable default subscription", () => {
  const created = parseCreateTopicInput({
    default_subscription: "opt_out",
    name: "Receipts",
  });

  assert.equal(created.defaultSubscription, "opt_out");
  assert.equal(created.visibility, "private");
  assert.equal(created.description, null);

  assert.throws(
    () => parseCreateTopicInput({ name: "Receipts" }),
    (error) => error instanceof SegmentError,
  );
  assert.throws(
    () =>
      parseCreateTopicInput({
        default_subscription: "opt_in",
        name: "Receipts",
        visibility: "everyone",
      }),
    (error) => error instanceof SegmentError,
  );

  const updated = parseUpdateTopicInput({ visibility: "public" });
  assert.equal(updated.visibility, "public");
  assert.throws(
    () => parseUpdateTopicInput({}),
    (error) => error instanceof SegmentError,
  );
});

test("contact property keys are restricted and typed", () => {
  assert.deepEqual(
    parseCreateContactPropertyInput({ key: "plan_2", type: "string" }),
    { fallbackValue: null, key: "plan_2", type: "string" },
  );
  assert.throws(
    () => parseCreateContactPropertyInput({ key: "plan!", type: "string" }),
    (error) => error instanceof SegmentError,
  );
  assert.throws(
    () =>
      parseCreateContactPropertyInput({
        fallback_value: "free",
        key: "seats",
        type: "number",
      }),
    (error) => error instanceof SegmentError,
  );
});

test("top-level contacts accept Resend-shaped fields", () => {
  const created = parseTopLevelCreateContactInput({
    email: "Reader@Example.net ",
    first_name: "Ada",
    properties: { plan: "pro", seats: 3 },
    segments: [{ id: "33333333-3333-4333-8333-333333333333" }],
    topics: [
      {
        id: "44444444-4444-4434-8344-444444444444",
        subscription: "opt_in",
      },
    ],
    unsubscribed: false,
  });

  assert.equal(created.email, "reader@example.net");
  assert.equal(created.firstName, "Ada");
  assert.deepEqual(created.properties, { plan: "pro", seats: 3 });

  const updated = parseTopLevelUpdateContactInput({ unsubscribed: true });
  assert.equal(updated.unsubscribed, true);
  assert.throws(
    () => parseTopLevelUpdateContactInput({}),
    (error) => error instanceof SegmentError,
  );
  assert.throws(
    () => parseTopLevelCreateContactInput({ email: "not-an-email" }),
    (error) => error instanceof SegmentError,
  );
});

test("contact imports accept JSON and string-encoded references", () => {
  const parsed = parseContactImportInput({
    column_map: { email: "Email" },
    csv: "Email\nreader@example.net\n",
    on_conflict: "upsert",
    segments: '[{"id":"33333333-3333-4333-8333-333333333333"}]',
  });

  assert.equal(parsed.onConflict, "upsert");
  assert.equal(parsed.segments.length, 1);
  assert.throws(
    () => parseContactImportInput({ csv: "Email\nreader@example.net\n", on_conflict: "merge" }),
    (error) => error instanceof SegmentError,
  );
  assert.throws(
    () => parseContactImportInput({}),
    (error) => error instanceof SegmentError,
  );
});
