import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  decodeFeedbackReportBase64,
  FeedbackError,
  MAX_FEEDBACK_REPORT_BYTES,
  parseFeedbackReport,
} from "../src/lib/feedback-core.ts";

const fixture = (name) =>
  readFile(new URL(`fixtures/feedback/${name}.eml`, import.meta.url));

test("RFC 3464 fixtures classify permanent and transient bounces", async () => {
  const hard = await parseFeedbackReport(await fixture("hard-bounce"));
  const soft = await parseFeedbackReport(await fixture("soft-bounce"));

  assert.deepEqual(hard.outcomes, [
    {
      classification: "hard_bounce",
      messageId: "11111111-1111-4111-8111-111111111111",
      recipient: "hard-bounce@example.net",
      status: "5.1.1",
    },
  ]);
  assert.deepEqual(soft.outcomes, [
    {
      classification: "soft_bounce",
      messageId: "22222222-2222-4222-8222-222222222222",
      recipient: "soft-bounce@example.net",
      status: "4.2.2",
    },
  ]);
  assert.match(hard.reportSha256, /^[0-9a-f]{64}$/);
  assert.notEqual(hard.reportSha256, soft.reportSha256);
});

test("RFC 5965 fixture becomes one correlated complaint", async () => {
  const complaint = await parseFeedbackReport(await fixture("complaint"));

  assert.deepEqual(complaint.outcomes, [
    {
      classification: "complaint",
      messageId: "33333333-3333-4333-8333-333333333333",
      recipient: "complaint@example.net",
      status: null,
    },
  ]);
});

test("feedback Base64 decoding is canonical and bounded", async () => {
  const raw = await fixture("hard-bounce");
  assert.deepEqual(decodeFeedbackReportBase64(raw.toString("base64")), raw);
  assert.throws(() => decodeFeedbackReportBase64("not base64"), FeedbackError);
  await assert.rejects(
    () => parseFeedbackReport(Buffer.alloc(MAX_FEEDBACK_REPORT_BYTES + 1)),
    (error) =>
      error instanceof FeedbackError && error.code === "REPORT_TOO_LARGE",
  );
});

test("ordinary messages and ambiguous report IDs are rejected", async () => {
  await assert.rejects(
    () =>
      parseFeedbackReport(
        Buffer.from("From: sender@example.com\nTo: reader@example.net\n\nHello"),
      ),
    (error) =>
      error instanceof FeedbackError && error.code === "INVALID_REPORT",
  );
  const raw = await fixture("hard-bounce");
  await assert.rejects(
    () =>
      parseFeedbackReport(
        Buffer.from(
          raw
            .toString("utf8")
            .replace(
              "X-PaperBoy-Message-ID: 11111111-1111-4111-8111-111111111111",
              "X-PaperBoy-Message-ID: 44444444-4444-4444-8444-444444444444",
            ),
        ),
      ),
    (error) =>
      error instanceof FeedbackError && error.code === "INVALID_REPORT",
  );
});

const unrelatedId = "44444444-4444-4444-8444-444444444444";
const correlationHeaders = [
  "Message-ID", "X-PaperBoy-Message-ID", "Original-Message-ID", "Original-Envelope-Id",
];

test("original message body lines cannot conflict with feedback correlation headers", async () => {
  for (const fixtureName of ["hard-bounce", "complaint"]) {
    const raw = (await fixture(fixtureName)).toString("utf8");
    const expected = (await parseFeedbackReport(Buffer.from(raw))).outcomes;
    const boundary = fixtureName === "hard-bounce" ? "hard-boundary" : "arf-boundary";
    for (const contentType of ["message/rfc822", "text/rfc822-headers"]) {
      for (const newline of ["\n", "\r\n"]) {
        const body = correlationHeaders.map((header) => `${header}: <${unrelatedId}@example.net>`).join("\n");
        const modified = raw
          .replace(/Content-Type: (?:message\/rfc822|text\/rfc822-headers)/, `Content-Type: ${contentType}`)
          .replace(`--${boundary}--`, `${body}\n\n--${boundary}--`)
          .replace(/\r?\n/g, newline);
        assert.deepEqual((await parseFeedbackReport(Buffer.from(modified))).outcomes, expected);
      }
    }
  }
});

test("unrelated attachments cannot add feedback correlation headers", async () => {
  const raw = (await fixture("complaint")).toString("utf8");
  const expected = (await parseFeedbackReport(Buffer.from(raw))).outcomes;
  for (const contentType of ["text/plain", "application/octet-stream"]) {
    const modified = raw.replace("--arf-boundary--", [
      "--arf-boundary",
      `Content-Type: ${contentType}`,
      'Content-Disposition: attachment; filename="notes.txt"',
      "",
      `Message-ID: <${unrelatedId}@example.net>`,
      "--arf-boundary--",
    ].join("\n"));
    assert.deepEqual((await parseFeedbackReport(Buffer.from(modified))).outcomes, expected);
  }
});

test("body-only correlation IDs cannot authorize a feedback report", async () => {
  const raw = (await fixture("complaint")).toString("utf8")
    .replace(/^(?:Original-Envelope-Id|Message-ID|X-PaperBoy-Message-ID):.*\n/gm, "")
    .replace("Example body.", `Message-ID: <${unrelatedId}@example.net>`);
  await assert.rejects(parseFeedbackReport(Buffer.from(raw)),
    (error) => error instanceof FeedbackError && error.code === "INVALID_REPORT");
});

test("conflicting real correlation headers remain invalid, including folded headers", async () => {
  const raw = (await fixture("complaint")).toString("utf8");
  for (const header of correlationHeaders) {
    for (const value of [` <${unrelatedId}@example.net>`, `\n\t<${unrelatedId}@example.net>`]) {
      const modified = raw.replace("Subject: Example", `${header}:${value}\nSubject: Example`);
      await assert.rejects(parseFeedbackReport(Buffer.from(modified)),
        (error) => error instanceof FeedbackError && error.code === "INVALID_REPORT");
    }
  }
});

test("folded original headers and delivery-status recipient blocks still correlate", async () => {
  const raw = (await fixture("hard-bounce")).toString("utf8");
  const expected = (await parseFeedbackReport(Buffer.from(raw))).outcomes;
  const originalId = "11111111-1111-4111-8111-111111111111";
  const originalOnly = raw
    .replace(/^Original-Envelope-Id:.*\n/gm, "")
    .replace(/^Message-ID:.*\n/gm, "")
    .replace(`X-PaperBoy-Message-ID: ${originalId}`, `X-PaperBoy-Message-ID:\n ${originalId}`);
  assert.deepEqual((await parseFeedbackReport(Buffer.from(originalOnly))).outcomes, expected);
  const statusOnly = raw
    .replace(/^Original-Envelope-Id:.*\n/gm, "")
    .replace(/^Message-ID:.*\n/gm, "")
    .replace(/^X-PaperBoy-Message-ID:.*\n/gm, "")
    .replace("Final-Recipient:", `Original-Envelope-Id:\n ${originalId}\nFinal-Recipient:`);
  assert.deepEqual((await parseFeedbackReport(Buffer.from(statusOnly))).outcomes, expected);
});
