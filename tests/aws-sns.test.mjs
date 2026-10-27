import assert from "node:assert/strict";
import test from "node:test";
import vectors from "./fixtures/providers/aws-sns-signatures.json" with { type: "json" };
import {
  AwsSnsVerificationError,
  awsSnsStringToSign,
  parseAwsSnsEnvelope,
  verifyAwsSnsEnvelope,
} from "../src/lib/aws-sns.ts";

const payload = {
  Type: "Notification",
  MessageId: "11111111-1111-4111-8111-111111111111",
  TopicArn: "arn:aws:sns:us-east-1:123456789012:paperboy-ses-events",
  Subject: "SES event",
  Message: "{\"eventType\":\"Delivery\"}",
  Timestamp: "2026-08-24T01:02:03.000Z",
  SignatureVersion: "2",
  Signature: "ZmFrZS1zaWduYXR1cmU=",
  SigningCertURL:
    "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0123456789abcdef.pem",
};
test("SNS canonical signing input uses the documented fields and a final newline", () => {
  const envelope = parseAwsSnsEnvelope(payload);
  assert.equal(
    awsSnsStringToSign(envelope),
    [
      "Message",
      payload.Message,
      "MessageId",
      payload.MessageId,
      "Subject",
      payload.Subject,
      "Timestamp",
      payload.Timestamp,
      "TopicArn",
      payload.TopicArn,
      "Type",
      payload.Type,
    ].join("\n") + "\n",
  );
  assert.equal(awsSnsStringToSign(envelope).endsWith("\n"), true);
});

test("SNS verification rejects an unexpected topic before fetching a certificate", async () => {
  let fetched = false;
  await assert.rejects(
    () =>
      verifyAwsSnsEnvelope({
        expectedTopicArn:
          "arn:aws:sns:us-east-1:123456789012:different-topic",
        fetcher: async () => {
          fetched = true;
          throw new Error("must not fetch");
        },
        payload,
      }),
    (error) =>
      error instanceof AwsSnsVerificationError &&
      error.code === "TOPIC_MISMATCH",
  );
  assert.equal(fetched, false);
});

for (const envelope of vectors.envelopes) {
  test(`SNS verifies independent ${envelope.Type} v${envelope.SignatureVersion} signature`, async () => {
    const verify = (payload) => verifyAwsSnsEnvelope({
      expectedTopicArn: envelope.TopicArn,
      fetcher: async () => new Response(vectors.certificate),
      payload,
    });
    assert.equal((await verify(envelope)).MessageId, envelope.MessageId);
    await assert.rejects(
      () => verify({ ...envelope, Message: "tampered" }),
      (error) => error instanceof AwsSnsVerificationError && error.code === "INVALID_SIGNATURE",
    );
  });
}

test("SNS verification bounds the AWS certificate response before parsing", async () => {
  await assert.rejects(
    () =>
      verifyAwsSnsEnvelope({
        expectedTopicArn: payload.TopicArn,
        fetcher: async () =>
          new Response("oversized", {
            headers: { "Content-Length": String(64 * 1024 + 1) },
          }),
        payload,
      }),
    (error) =>
      error instanceof AwsSnsVerificationError &&
      error.code === "CERTIFICATE_UNAVAILABLE",
  );
});
