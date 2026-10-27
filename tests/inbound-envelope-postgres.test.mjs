import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
test("SES BCC routing authorizes the envelope and preserves visible headers", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { domains, domainDkimKeys, orgs, receivedEmails }, { processInboundS3Queue }, { receiveInboundEmail }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/inbound-s3.ts"), import("../src/lib/inbound.ts"),
  ]);
  const orgId = randomUUID();
  const domainId = randomUUID();
  const domainName = `${orgId}.example.net`;
  const raw = [
    `Received: from sender.example by inbound-smtp.us-east-1.amazonaws.com for <hidden@${domainName}>; Tue, 27 Oct 2026 00:00:00 +0000`,
    "From: sender@example.org", "To: visible@unowned.example.org", "Subject: BCC delivery",
    `Message-ID: <${randomUUID()}@example.org>`, "Content-Type: text/plain", "", "Hello hidden recipient",
  ].join("\r\n");
  const objects = new Map([["inbound/bcc", raw]]);
  const client = { async send(command) {
    if (command.constructor.name === "ListObjectsV2Command") return { Contents: [...objects.keys()].map((Key) => ({ Key })) };
    if (command.constructor.name === "GetObjectCommand") return { Body: { transformToByteArray: async () => Buffer.from(objects.get(command.input.Key)) } };
    if (command.constructor.name === "DeleteObjectCommand") { objects.delete(command.input.Key); return {}; }
    throw new Error("Unexpected command");
  } };
  try {
    await db.insert(orgs).values({ id: orgId, name: "Envelope test" });
    await db.insert(domains).values({ id: domainId, orgId, name: domainName, status: "verified" });
    await db.insert(domainDkimKeys).values({ domainId, encryptedPrivateKey: "integration-only", publicKey: "integration-only", selector: "test", status: "active" });
    // Public ingestion must not trust a sender-supplied Received header as an override.
    await assert.rejects(receiveInboundEmail({ payload: { email: raw }, principal: { environment: "live", orgId } }), { code: "DOMAIN_NOT_VERIFIED" });
    const result = await processInboundS3Queue({ client, environment: { PAPERBOY_INBOUND_S3_BUCKET: "test", PAPERBOY_INBOUND_S3_REGION: "us-east-1" } });
    assert.deepEqual(result, { deleted: 1, failed: 0, skipped: 0 });
    assert.equal(objects.size, 0);
    const rows = await db.select().from(receivedEmails).where(eq(receivedEmails.orgId, orgId));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].domainId, domainId);
    assert.deepEqual(rows[0].to, ["visible@unowned.example.org"]);
    assert.deepEqual(rows[0].bcc, []);
  } finally { await db.delete(orgs).where(eq(orgs.id, orgId)); }
});
