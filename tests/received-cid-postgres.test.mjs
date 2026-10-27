import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { receivedCidCases, receivedCidMime } from "./fixtures/inbound-cid.mjs";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
test("real MIME CIDs survive inbound ingestion, storage and attachment responses", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const previousDispatch = process.env.PAPERBOY_INLINE_JOB_DISPATCH;
  const previousKey = process.env.PAPERBOY_SHARE_SIGNING_KEY;
  process.env.PAPERBOY_INLINE_JOB_DISPATCH = "false";
  process.env.PAPERBOY_SHARE_SIGNING_KEY = Buffer.alloc(32, 7).toString("base64");
  const storage = await mkdtemp(join(tmpdir(), "paperboy-received-cid-"));
  const [{ eq }, { db }, { orgs, receivedEmailAttachments }, inbound, http, blobs] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"),
    import("../src/lib/inbound.ts"), import("../src/lib/inbound-http.ts"), import("../src/lib/attachment-storage.ts"),
  ]);
  // Use the real local blob store in an owned directory, restoring the singleton
  // afterwards so other integration tests retain their configured storage.
  const previousStore = { ...blobs.attachmentStore };
  Object.assign(blobs.attachmentStore, blobs.createLocalAttachmentStore(storage));
  const orgId = randomUUID();
  const principal = { orgId, environment: "test", scopes: ["messages.read"] };
  const services = {
    authenticate: async () => principal,
    listAttachments: (actor, receivedEmailId) => inbound.listReceivedEmailAttachments({ ...actor, receivedEmailId }),
    getAttachment: (actor, receivedEmailId, attachmentId) => inbound.getReceivedEmailAttachment({ ...actor, receivedEmailId, attachmentId }),
  };
  try {
    await db.insert(orgs).values({ id: orgId, name: "Received CID regression" });
    for (const sample of receivedCidCases) {
      // Ingestion must succeed even if just the CID metadata is unusable.
      const input = { payload: { email: receivedCidMime(sample) }, principal };
      const email = await inbound.receiveInboundEmail(input);
      assert.equal(email.replayed, false, sample.name);
      assert.match(email.html, /src="cid:logo@example.com"/);
      const [stored] = await db.select().from(receivedEmailAttachments)
        .where(eq(receivedEmailAttachments.receivedEmailId, email.id));
      assert.equal(stored.contentId, sample.expected, sample.name);
      assert.deepEqual(await blobs.attachmentStore.read(stored.storageKey), Buffer.from("image"));
      const request = new Request(`https://paperboy.test/api/v1/received-emails/${email.id}/attachments`);
      const list = await http.handleListReceivedEmailAttachmentsRequest(request, email.id, services);
      assert.equal(list.status, 200, sample.name);
      const { data } = await list.json();
      assert.equal(data.length, 1);
      assert.equal(data[0].content_id, sample.expected, sample.name);
      assert.equal(data[0].id, stored.id);
      const get = await http.handleGetReceivedEmailAttachmentRequest(request, email.id, stored.id, services);
      assert.equal(get.status, 200, sample.name);
      assert.equal((await get.json()).content_id, sample.expected, sample.name);
      const replay = await inbound.receiveInboundEmail(input);
      assert.equal(replay.id, email.id);
      assert.equal(replay.replayed, true);
      assert.equal((await inbound.listReceivedEmailAttachments({ ...principal, receivedEmailId: email.id })).length, 1);
    }
  } finally {
    Object.assign(blobs.attachmentStore, previousStore);
    if (previousDispatch === undefined) delete process.env.PAPERBOY_INLINE_JOB_DISPATCH;
    else process.env.PAPERBOY_INLINE_JOB_DISPATCH = previousDispatch;
    if (previousKey === undefined) delete process.env.PAPERBOY_SHARE_SIGNING_KEY;
    else process.env.PAPERBOY_SHARE_SIGNING_KEY = previousKey;
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await rm(storage, { recursive: true, force: true });
  }
});
