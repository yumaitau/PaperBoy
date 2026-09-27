import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError } from "../src/lib/authorization.ts";
import { csvCell } from "../src/lib/dashboard-export.ts";
import { describeEmailFailure } from "../src/lib/email-http.ts";
import { sesEnvelopeRecipient } from "../src/lib/inbound-core.ts";
import {
  handleGetReceivedEmailRequest,
  handleReceiveInboundEmailRequest,
} from "../src/lib/inbound-http.ts";
import {
  createWebhookSigningSecret,
  encryptWebhookSigningSecret,
  isNonPublicAddress,
  parseWebhookUrl,
} from "../src/lib/webhook-core.ts";
import { postWebhook, WebhookDeliveryError } from "../src/lib/webhook-worker-core.ts";

test("CSV export neutralizes formula-leading text but keeps numbers", () => {
  assert.equal(csvCell('=HYPERLINK("https://x.test","open")'), `"'=HYPERLINK(""https://x.test"",""open"")"`);
  for (const prefix of ["=", "+", "-", "@", "\t"]) {
    assert.ok(csvCell(`${prefix}1+1`).replace(/^"/, "").startsWith("'"), prefix);
  }
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell("plain subject"), "plain subject");
});

test("webhook URLs cannot target private, loopback, or reserved networks", () => {
  for (const address of [
    "127.0.0.1", "10.0.0.5", "172.20.1.1", "192.168.0.1", "169.254.169.254",
    "100.64.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "64:ff9b::a00:1",
  ]) {
    assert.equal(isNonPublicAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isNonPublicAddress(address), false, address);
  }
  for (const url of [
    "https://10.0.0.5:8443/admin",
    "https://2130706433/",
    "https://[::ffff:127.0.0.1]/",
    "https://localhost/",
  ]) {
    assert.throws(() => parseWebhookUrl(url, { allowPrivateNetwork: false }), url);
  }
  assert.ok(parseWebhookUrl("https://hooks.example.com/x", { allowPrivateNetwork: false }));
  assert.ok(parseWebhookUrl("https://10.0.0.5/x", { allowPrivateNetwork: true }));
});

test("webhook delivery refuses hosts that resolve to private addresses", async () => {
  const encryptionKey = Buffer.alloc(32, 9);
  const endpointId = "11111111-1111-4111-8111-111111111111";
  const orgId = "22222222-2222-4222-8222-222222222222";
  let fetched = false;
  await assert.rejects(
    postWebhook({
      claim: {
        attemptCount: 1,
        body: "{}",
        encryptedSecret: encryptWebhookSigningSecret({
          context: { endpointId, orgId },
          encryptionKey,
          secret: createWebhookSigningSecret(),
        }),
        endpointId,
        eventId: "33333333-3333-4333-8333-333333333333",
        id: "44444444-4444-4444-8444-444444444444",
        orgId,
        url: "https://internal.example.com/hook",
      },
      encryptionKey,
      fetch: async () => {
        fetched = true;
        return new Response(null, { status: 200 });
      },
      resolve: async () => ["10.0.0.5"],
    }),
    (error) =>
      error instanceof WebhookDeliveryError &&
      error.failure.code === "webhook_destination_blocked" &&
      error.failure.retryable === false,
  );
  assert.equal(fetched, false);
});

test("S3 inbound routing prefers the SES envelope recipient over the To header", () => {
  const raw = [
    "Received: from mx.sender.test by inbound-smtp.us-east-1.amazonaws.com with SMTP id abc for x@a.test; Mon, 1 Jan 2026 00:00:00 +0000",
    "Received: by attacker for spoof@b.test; forged",
    "To: reply+tok@b.test",
    "Subject: hi",
    "",
    "body",
  ].join("\r\n");
  assert.equal(sesEnvelopeRecipient(raw), "x@a.test");
  assert.equal(
    sesEnvelopeRecipient("Received: by attacker for x@b.test;\r\nTo: x@b.test\r\n\r\nbody"),
    null,
  );
});

test("received-email routes require the matching key scope", async () => {
  const principal = {
    actorUserId: "creator",
    apiKeyId: "55555555-5555-4555-8555-555555555555",
    environment: "test",
    orgId: "66666666-6666-4666-8666-666666666666",
    scopes: ["templates.read"],
  };
  const authenticate = async () => principal;
  const read = await handleGetReceivedEmailRequest(
    new Request("https://paperboy.test/api/v1/received-emails/x"),
    "x",
    { authenticate, get: async () => assert.fail("must not read") },
  );
  assert.equal(read.status, 403);
  const write = await handleReceiveInboundEmailRequest(
    new Request("https://paperboy.test/api/v1/received-emails", { body: "{}", method: "POST" }),
    { authenticate, receive: async () => assert.fail("must not ingest") },
  );
  assert.equal(write.status, 403);
});

test("a send refused for the key creator's role maps to 403", () => {
  assert.equal(describeEmailFailure(new AuthorizationError("messages.send")).status, 403);
});
