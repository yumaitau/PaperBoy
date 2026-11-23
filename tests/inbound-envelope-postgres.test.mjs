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

test("multi-recipient S3 inbound mail routes via Cc when SES omits for <rcpt>;", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { domains, domainDkimKeys, orgs, receivedEmails }, { processInboundS3Queue }] = await Promise.all([
    import("drizzle-orm"),
    import("../src/db/index.ts"),
    import("../src/db/schema.ts"),
    import("../src/lib/inbound-s3.ts"),
  ]);
  const orgId = randomUUID();
  const domainId = randomUUID();
  const domainName = `${orgId}.example.net`;
  const raw = [
    "Received: from sender.example by inbound-smtp.us-east-1.amazonaws.com with ESMTPS; Tue, 27 Oct 2026 00:00:00 +0000",
    "From: sender@example.org",
    "To: external@unowned.example.org",
    `Cc: support@${domainName}`,
    "Subject: Multi-recipient Cc delivery",
    `Message-ID: <${randomUUID()}@example.org>`,
    "Content-Type: text/plain",
    "",
    "Hello Cc recipient",
  ].join("\r\n");
  const objects = new Map([["inbound/cc-multi", raw]]);
  const client = {
    async send(command) {
      if (command.constructor.name === "ListObjectsV2Command") {
        return { Contents: [...objects.keys()].map((Key) => ({ Key })) };
      }
      if (command.constructor.name === "GetObjectCommand") {
        return { Body: { transformToByteArray: async () => Buffer.from(objects.get(command.input.Key)) } };
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        objects.delete(command.input.Key);
        return {};
      }
      throw new Error("Unexpected command");
    },
  };
  try {
    await db.insert(orgs).values({ id: orgId, name: "Multi-recipient Cc test" });
    await db.insert(domains).values({ id: domainId, orgId, name: domainName, status: "verified" });
    await db.insert(domainDkimKeys).values({
      domainId,
      encryptedPrivateKey: "integration-only",
      publicKey: "integration-only",
      selector: "test",
      status: "active",
    });

    const result = await processInboundS3Queue({
      client,
      environment: { PAPERBOY_INBOUND_S3_BUCKET: "test", PAPERBOY_INBOUND_S3_REGION: "us-east-1" },
    });
    assert.deepEqual(result, { deleted: 1, failed: 0, skipped: 0 });
    assert.equal(objects.size, 0);

    const rows = await db.select().from(receivedEmails).where(eq(receivedEmails.orgId, orgId));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].domainId, domainId);
    assert.deepEqual(rows[0].to, ["external@unowned.example.org"]);
    assert.deepEqual(rows[0].cc, [`support@${domainName}`]);
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
  }
});

test("multi-recipient inbound mail spanning two verified orgs fails closed", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [
    { eq },
    { db },
    { domains, domainDkimKeys, orgs, receivedEmails },
    { processInboundS3Queue },
    { findLiveOrgForInboundRecipients },
  ] = await Promise.all([
    import("drizzle-orm"),
    import("../src/db/index.ts"),
    import("../src/db/schema.ts"),
    import("../src/lib/inbound-s3.ts"),
    import("../src/lib/inbound.ts"),
  ]);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const domainA = randomUUID();
  const domainB = randomUUID();
  const domainNameA = `${orgA}.example.net`;
  const domainNameB = `${orgB}.example.net`;
  const raw = [
    "Received: from sender.example by inbound-smtp.us-east-1.amazonaws.com with ESMTPS; Tue, 27 Oct 2026 00:00:00 +0000",
    "From: sender@example.org",
    `To: first@${domainNameA}`,
    `Cc: second@${domainNameB}`,
    "Subject: Cross-org multi-recipient",
    `Message-ID: <${randomUUID()}@example.org>`,
    "Content-Type: text/plain",
    "",
    "Should not route ambiguously",
  ].join("\r\n");
  const objects = new Map([["inbound/cross-org", raw]]);
  const client = {
    async send(command) {
      if (command.constructor.name === "ListObjectsV2Command") {
        return { Contents: [...objects.keys()].map((Key) => ({ Key })) };
      }
      if (command.constructor.name === "GetObjectCommand") {
        return { Body: { transformToByteArray: async () => Buffer.from(objects.get(command.input.Key)) } };
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        objects.delete(command.input.Key);
        return {};
      }
      throw new Error("Unexpected command");
    },
  };
  try {
    await db.insert(orgs).values([
      { id: orgA, name: "Cross-org A" },
      { id: orgB, name: "Cross-org B" },
    ]);
    await db.insert(domains).values([
      { id: domainA, orgId: orgA, name: domainNameA, status: "verified" },
      { id: domainB, orgId: orgB, name: domainNameB, status: "verified" },
    ]);
    await db.insert(domainDkimKeys).values([
      { domainId: domainA, encryptedPrivateKey: "integration-only", publicKey: "integration-only", selector: "test", status: "active" },
      { domainId: domainB, encryptedPrivateKey: "integration-only", publicKey: "integration-only", selector: "test", status: "active" },
    ]);

    assert.equal(
      await findLiveOrgForInboundRecipients([`first@${domainNameA}`, `second@${domainNameB}`]),
      null,
    );

    const result = await processInboundS3Queue({
      client,
      environment: { PAPERBOY_INBOUND_S3_BUCKET: "test", PAPERBOY_INBOUND_S3_REGION: "us-east-1" },
    });
    assert.deepEqual(result, { deleted: 0, failed: 1, skipped: 0 });
    assert.equal(objects.has("inbound/cross-org"), true);
    assert.equal((await db.select().from(receivedEmails).where(eq(receivedEmails.orgId, orgA))).length, 0);
    assert.equal((await db.select().from(receivedEmails).where(eq(receivedEmails.orgId, orgB))).length, 0);
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgA));
    await db.delete(orgs).where(eq(orgs.id, orgB));
  }
});

test("receiveInboundEmail and queueEmail stage attachments outside db.transaction and clean up on replay or DB failure", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const previousDispatch = process.env.PAPERBOY_INLINE_JOB_DISPATCH;
  process.env.PAPERBOY_INLINE_JOB_DISPATCH = "false";
  const [
    { eq },
    { db },
    { broadcastRecipients, broadcasts, emailSuppressions, messageAttachments, orgs, receivedEmailAttachments },
    { receiveInboundEmail },
    { queueEmail },
  ] = await Promise.all([
    import("drizzle-orm"),
    import("../src/db/index.ts"),
    import("../src/db/schema.ts"),
    import("../src/lib/inbound.ts"),
    import("../src/lib/messages.ts"),
  ]);

  const orgId = randomUUID();
  let activeTransactions = 0;
  const timeline = [];
  const hadOwnTransaction = Object.prototype.hasOwnProperty.call(db, "transaction");
  const originalTransaction = db.transaction;
  db.transaction = async function wrappedTransaction(...args) {
    activeTransactions += 1;
    timeline.push("tx:start");
    try {
      return await originalTransaction.apply(this, args);
    } finally {
      timeline.push("tx:end");
      activeTransactions -= 1;
    }
  };

  function createSpyStore() {
    const blobs = new Map();
    const puts = [];
    const deletes = [];
    return {
      blobs,
      deletes,
      puts,
      store: {
        async put({ content, storageKey }) {
          assert.equal(activeTransactions, 0, "attachmentStore.put must run outside db.transaction");
          timeline.push("put");
          puts.push(storageKey);
          blobs.set(storageKey, Buffer.from(content));
        },
        async read(storageKey) {
          return blobs.get(storageKey);
        },
        async delete(storageKey) {
          deletes.push(storageKey);
          blobs.delete(storageKey);
        },
      },
    };
  }

  try {
    await db.insert(orgs).values({ id: orgId, name: "Attachment staging test" });

    // 1. receiveInboundEmail: stages outside tx, cleans up on duplicate replay and DB failure.
    const inboundSpy = createSpyStore();
    const inboundMime = [
      "From: sender@example.org",
      "To: reader@example.net",
      "Subject: Inbound attachment staging",
      `Message-ID: <${randomUUID()}@example.org>`,
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="stage-bound"',
      "",
      "--stage-bound",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Body text",
      "--stage-bound",
      'Content-Type: text/plain; name="note.txt"',
      "Content-Transfer-Encoding: base64",
      'Content-Disposition: attachment; filename="note.txt"',
      "",
      Buffer.from("hello inbound").toString("base64"),
      "--stage-bound--",
      "",
    ].join("\r\n");

    timeline.length = 0;
    const storedInbound = await receiveInboundEmail({
      attachmentStore: inboundSpy.store,
      payload: { email: inboundMime },
      principal: { environment: "test", orgId },
    });
    assert.equal(storedInbound.replayed, false);
    assert.deepEqual(timeline, ["put", "tx:start", "tx:end"]);
    assert.equal(inboundSpy.blobs.size, 1);
    const [inboundAttachmentRow] = await db
      .select()
      .from(receivedEmailAttachments)
      .where(eq(receivedEmailAttachments.receivedEmailId, storedInbound.id));
    assert.ok(inboundAttachmentRow);
    assert.equal(inboundSpy.blobs.has(inboundAttachmentRow.storageKey), true);

    // Duplicate replay hits unique constraint inside tx and deletes newly staged blob.
    const replayedInbound = await receiveInboundEmail({
      attachmentStore: inboundSpy.store,
      payload: { email: inboundMime },
      principal: { environment: "test", orgId },
    });
    assert.equal(replayedInbound.replayed, true);
    assert.equal(replayedInbound.id, storedInbound.id);
    assert.equal(inboundSpy.puts.length, 2);
    assert.equal(inboundSpy.deletes.length, 1);
    assert.equal(inboundSpy.blobs.size, 1);
    assert.equal(inboundSpy.blobs.has(inboundAttachmentRow.storageKey), true);

    // DB failure (missing org FK) deletes newly staged blob.
    await assert.rejects(
      receiveInboundEmail({
        attachmentStore: inboundSpy.store,
        payload: { email: inboundMime },
        principal: { environment: "test", orgId: randomUUID() },
      }),
    );
    assert.equal(inboundSpy.puts.length, 3);
    assert.equal(inboundSpy.deletes.length, 2);
    assert.equal(inboundSpy.blobs.size, 1);

    // 2. queueEmail: stages outside tx, cleans up on DB/suppression failure and broadcast replay.
    const outboundSpy = createSpyStore();
    const attachmentPayload = {
      content: Buffer.from("hello outbound").toString("base64"),
      content_type: "text/plain",
      filename: "out.txt",
    };

    timeline.length = 0;
    const queued = await queueEmail({
      attachmentStore: outboundSpy.store,
      payload: {
        attachments: [attachmentPayload],
        from: "sender@example.org",
        subject: "Outbound attachment staging",
        text: "Hello",
        to: ["reader@example.net"],
      },
      principal: { apiKeyId: null, environment: "test", orgId },
    });
    assert.equal(queued.replayed, false);
    assert.deepEqual(timeline, ["put", "tx:start", "tx:end"]);
    assert.equal(outboundSpy.blobs.size, 1);
    const [outboundAttachmentRow] = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, queued.id));
    assert.ok(outboundAttachmentRow);
    assert.equal(outboundSpy.blobs.has(outboundAttachmentRow.storageKey), true);

    // Suppression failure inside tx deletes newly staged blob.
    await db.insert(emailSuppressions).values({
      email: "suppressed@example.net",
      orgId,
      reason: "manual",
    });
    await assert.rejects(
      queueEmail({
        attachmentStore: outboundSpy.store,
        payload: {
          attachments: [attachmentPayload],
          from: "sender@example.org",
          subject: "Suppressed send",
          text: "Blocked",
          to: ["suppressed@example.net"],
        },
        principal: { apiKeyId: null, environment: "test", orgId },
      }),
      { code: "RECIPIENT_SUPPRESSED" },
    );
    assert.equal(outboundSpy.puts.length, 2);
    assert.equal(outboundSpy.deletes.length, 1);
    assert.equal(outboundSpy.blobs.size, 1);
    assert.equal(outboundSpy.blobs.has(outboundAttachmentRow.storageKey), true);

    // Broadcast recipient replay inside tx cleans up newly staged blob.
    const [broadcast] = await db
      .insert(broadcasts)
      .values({
        environment: "test",
        from: "sender@example.org",
        name: "Replay test",
        orgId,
        status: "running",
        templateName: "T",
        templateSubject: "S",
        templateText: "Body",
      })
      .returning({ id: broadcasts.id });
    const [recipient] = await db
      .insert(broadcastRecipients)
      .values({
        broadcastId: broadcast.id,
        email: "reader@example.net",
        messageId: queued.id,
        position: 0,
        status: "queued",
      })
      .returning({ id: broadcastRecipients.id, updatedAt: broadcastRecipients.updatedAt });
    const broadcastReplay = await queueEmail({
      attachmentStore: outboundSpy.store,
      broadcastRecipient: {
        broadcastId: broadcast.id,
        claimedAt: recipient.updatedAt,
        recipientId: recipient.id,
      },
      payload: {
        attachments: [attachmentPayload],
        from: "sender@example.org",
        subject: "Outbound attachment staging",
        text: "Hello",
        to: ["reader@example.net"],
      },
      principal: { apiKeyId: null, environment: "test", orgId },
    });
    assert.equal(broadcastReplay.replayed, true);
    assert.equal(broadcastReplay.id, queued.id);
    assert.equal(outboundSpy.puts.length, 3);
    assert.equal(outboundSpy.deletes.length, 2);
    assert.equal(outboundSpy.blobs.size, 1);
    assert.equal(outboundSpy.blobs.has(outboundAttachmentRow.storageKey), true);
  } finally {
    if (hadOwnTransaction) {
      db.transaction = originalTransaction;
    } else {
      delete db.transaction;
    }
    if (previousDispatch === undefined) {
      delete process.env.PAPERBOY_INLINE_JOB_DISPATCH;
    } else {
      process.env.PAPERBOY_INLINE_JOB_DISPATCH = previousDispatch;
    }
    await db.delete(orgs).where(eq(orgs.id, orgId));
  }
});
