import assert from "node:assert/strict";
import test from "node:test";
import {
  EmailMetricsError,
  parseMetricsQuery,
} from "../src/lib/email-metrics.ts";
import {
  createShareToken,
  parseShareExpiry,
  verifyShareToken,
} from "../src/lib/share-links.ts";

const key = Buffer.from("a".repeat(32));

test("share tokens round-trip and expire", () => {
  const messageId = "22222222-2222-4222-8222-222222222222";
  const now = new Date("2026-08-23T10:00:00.000Z");
  const token = createShareToken({
    expiresInSeconds: 3600,
    key,
    now,
    subject: { messageId },
  });
  const verified = verifyShareToken({ key, now, token });

  assert.equal(verified?.messageId, messageId);
  assert.equal(
    verified?.expiresAt.toISOString(),
    "2026-08-23T11:00:00.000Z",
  );
  assert.equal(
    verifyShareToken({
      key,
      now: new Date("2026-08-23T12:00:00.000Z"),
      token,
    }),
    null,
  );
  assert.equal(verifyShareToken({ key, now, token: "bogus" }), null);
});

test("share attachment tokens carry the attachment subject", () => {
  const now = new Date("2026-08-23T10:00:00.000Z");
  const token = createShareToken({
    key,
    now,
    subject: {
      attachmentId: "33333333-3333-4333-8333-333333333333",
      messageId: "22222222-2222-4222-8222-222222222222",
    },
  });
  const verified = verifyShareToken({ key, now, token });

  assert.equal(
    verified && "attachmentId" in verified && verified.attachmentId,
    "33333333-3333-4333-8333-333333333333",
  );
});

test("share expiry parsing caps at 48 hours", () => {
  assert.equal(parseShareExpiry(undefined), 48 * 60 * 60);
  assert.equal(parseShareExpiry("10m"), 600);
  assert.equal(parseShareExpiry("2 hours"), 7200);
  assert.equal(parseShareExpiry("3 days"), 48 * 60 * 60);
  assert.equal(parseShareExpiry("10s"), null);
  assert.equal(parseShareExpiry("soon"), null);
});

test("metrics queries default sanely and reject bad combinations", () => {
  const query = parseMetricsQuery({});

  assert.equal(query.granularity, "daily");
  assert.equal(query.timezone, "UTC");
  assert.deepEqual(query.dimensions, []);
  assert.ok(query.metrics.includes("sent"));
  assert.ok(query.endDate >= query.startDate);

  assert.throws(
    () => parseMetricsQuery({ dimensions: "email,broadcast" }),
    (error) =>
      error instanceof EmailMetricsError &&
      error.issues.some((issue) => /cannot be combined/.test(issue.message)),
  );
  assert.throws(
    () => parseMetricsQuery({ granularity: "minutely" }),
    (error) =>
      error instanceof EmailMetricsError &&
      error.issues.some((issue) => /hourly/.test(issue.message)),
  );
  assert.throws(
    () => parseMetricsQuery({ timezone: "Mars/Olympus" }),
    (error) =>
      error instanceof EmailMetricsError &&
      error.issues.some((issue) => /IANA/.test(issue.message)),
  );

  const filtered = parseMetricsQuery({
    dimensions: "period,domain",
    email_id: "22222222-2222-4222-8222-222222222222",
    metrics: "sent,opened",
  });
  assert.deepEqual(filtered.dimensions, ["period", "domain"]);
  assert.deepEqual(filtered.metrics, ["sent", "opened"]);
  assert.deepEqual(filtered.emailIds, [
    "22222222-2222-4222-8222-222222222222",
  ]);
});
