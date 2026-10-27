import assert from "node:assert/strict";
import test from "node:test";
import { AWS_SES_MAX_EVENT_BYTES } from "../src/lib/aws-ses-adapter.ts";
import { handleAwsSesSnsRequest } from "../src/lib/outbound-provider-sns-http.ts";
import { organizationAwsSesVariable } from "../src/lib/outbound-provider-configuration.ts";

const orgId = "11111111-1111-4111-8111-111111111111";
const environment = {
  [organizationAwsSesVariable(orgId, "REGION")]: "us-east-1",
  [organizationAwsSesVariable(orgId, "ROLE_ARN")]: "arn:aws:iam::123456789012:role/paperboy-ses",
  [organizationAwsSesVariable(orgId, "SNS_TOPIC_ARN")]: "arn:aws:sns:us-east-1:123456789012:paperboy-ses-events",
};
function request(body, headers = {}) {
  return new Request("https://paperboy.test/events", { body, headers, method: "POST", duplex: "half" });
}

for (const length of [undefined, "1", String(AWS_SES_MAX_EVENT_BYTES + 1)]) {
  test(`SNS cancels oversized uploads with Content-Length ${length}`, async () => {
    let consumed = 0;
    let cancelled = false;
    let verified = false;
    const stream = new ReadableStream({
      pull(controller) {
        consumed += 64 * 1024;
        controller.enqueue(new Uint8Array(64 * 1024));
        if (consumed >= 8 * 1024 * 1024) controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const response = await handleAwsSesSnsRequest(request(stream, length ? { "Content-Length": length } : {}), orgId, {
      environment,
      async verify() { verified = true; throw new Error("must not verify oversized payloads"); },
    });
    assert.equal(response.status, 422);
    assert.equal(cancelled, true);
    assert.ok(consumed <= AWS_SES_MAX_EVENT_BYTES + 64 * 1024, `consumed ${consumed}`);
    assert.equal(verified, false);
  });
}

test("SNS accepts exactly the byte limit and preserves UTF-8 across chunk boundaries", async () => {
  const bytes = Buffer.from(JSON.stringify({ value: "文件" }));
  const padded = Buffer.concat([bytes, Buffer.alloc(AWS_SES_MAX_EVENT_BYTES - bytes.length, 32)]);
  let offset = 0;
  let parsed;
  const stream = new ReadableStream({
    pull(controller) {
      const size = offset < bytes.length ? 1 : 65536;
      controller.enqueue(padded.subarray(offset, offset + size));
      offset += size;
      if (offset >= padded.length) controller.close();
    },
  });
  const response = await handleAwsSesSnsRequest(request(stream), orgId, {
    environment,
    async verify({ payload }) { parsed = payload; return { Type: "Notification" }; },
    async ingest() { return []; },
  });
  assert.equal(response.status, 202);
  assert.deepEqual(parsed, { value: "文件" });
});

for (const body of [null, "not json", new ReadableStream({ start(controller) { controller.error(new Error("disconnected")); } })]) {
  test("SNS rejects empty, malformed, or interrupted bodies without verification", async () => {
    const response = await handleAwsSesSnsRequest(request(body), orgId, {
      environment,
      async verify() { assert.fail("invalid body reached verifier"); },
    });
    assert.equal(response.status, 422);
  });
}
