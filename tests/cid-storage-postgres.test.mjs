import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const options = { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured" };

test("CID labels including U+0085 survive PostgreSQL queue storage and reconstruction", options, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const previousDispatch = process.env.PAPERBOY_INLINE_JOB_DISPATCH;
  process.env.PAPERBOY_INLINE_JOB_DISPATCH = "false";
  const [{ eq }, { db }, { orgs, emailTemplates, messageAttachments }, { queueEmail, loadMessageAttachments }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/messages.ts"),
  ]);
  const orgId = randomUUID();
  const templateId = randomUUID();
  const blobs = new Map();
  const attachmentStore = {
    put: async ({ storageKey, content }) => { blobs.set(storageKey, content); },
    read: async (key) => blobs.get(key),
    delete: async (key) => { blobs.delete(key); },
  };
  // The CI renderer printed this scalar as ^E; assert its actual wire bytes.
  assert.equal("\u0085".codePointAt(0), 133);
  assert.equal(Buffer.from("\u0085").toString("hex"), "c285");
  try {
    await db.insert(orgs).values({ id: orgId, name: "CID locale regression" });
    await db.insert(emailTemplates).values({ id: templateId, orgId, name: "CID", subject: "CID", textBody: "Image", status: "published", publishedVersion: 1, publishedAt: new Date() });
    for (const contentId of ["\u0085", "logo\u0085@example", "\u0080", "\u009f", "café/画像/📨", "é", "e\u0301", "\u200b", "\ufffd", "\uffff"]) {
      for (const template of [false, true]) {
        const queued = await queueEmail({
          payload: {
            from: "sender@example.com", to: ["reader@example.net"],
            ...(template ? { template_id: templateId } : { subject: "CID", text: "Image" }),
            attachments: [{ content: "aW1hZ2U=", filename: "logo.png", content_type: "image/png", content_id: contentId }],
          },
          principal: { orgId, environment: "test", apiKeyId: null },
          attachmentStore,
        });
        const [stored] = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, queued.id));
        assert.equal(stored.contentId, contentId);
        const [loaded] = await loadMessageAttachments({ messageId: queued.id, attachmentStore });
        assert.equal(loaded.contentId, contentId);
        assert.deepEqual(loaded.content, Buffer.from("image"));
      }
    }
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    if (previousDispatch === undefined) delete process.env.PAPERBOY_INLINE_JOB_DISPATCH;
    else process.env.PAPERBOY_INLINE_JOB_DISPATCH = previousDispatch;
  }
});

test("inbound CID storage preserves parsed NEL, semicolons and internal Unicode whitespace", options, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { orgs, receivedEmails, receivedEmailAttachments }, { parseInboundMime }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/inbound-core.ts"),
  ]);
  const orgId = randomUUID();
  try {
    await db.insert(orgs).values({ id: orgId, name: "Inbound CID locale regression" });
    for (const contentId of ["\u0085", "logo;part", "logo\u00a0part", "logo\ufeffpart"]) {
      const parsed = await parseInboundMime([
        "From: sender@example.com", "To: reader@example.net", "Subject: CID", "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="cid-test"', "", "--cid-test", "Content-Type: text/plain", "", "Image",
        "--cid-test", 'Content-Type: image/png; name="logo.png"', "Content-Transfer-Encoding: base64",
        'Content-Disposition: inline; filename="logo.png"', `Content-ID: ${contentId}`, "", "aW1hZ2U=", "--cid-test--", "",
      ].join("\r\n"));
      assert.equal(parsed.attachments[0].contentId, contentId);
      const [email] = await db.insert(receivedEmails).values({
        orgId, environment: "test", from: parsed.from, to: parsed.to,
        subject: parsed.subject, textBody: parsed.text, contentSha256: parsed.contentSha256,
      }).returning();
      const attachment = parsed.attachments[0];
      const [stored] = await db.insert(receivedEmailAttachments).values({
        receivedEmailId: email.id, position: 0, filename: attachment.filename,
        contentType: attachment.contentType, contentId: attachment.contentId,
        byteSize: attachment.size, contentSha256: attachment.contentSha256, storageKey: randomUUID(),
      }).returning();
      assert.equal(stored.contentId, contentId);
    }
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
  }
});
