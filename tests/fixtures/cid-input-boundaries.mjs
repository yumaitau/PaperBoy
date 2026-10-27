import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/client/validators/ajv";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { registerPaperBoyEmailTools } from "../../src/mcp/email-tools.ts";

export function cidPayload(contentId, templateId) {
  return {
    from: "sender@example.com",
    to: ["reader@example.net"],
    ...(templateId ? { template_id: templateId } : { subject: "CID", text: "Image" }),
    attachments: [{ content: "aW1hZ2U=", filename: "logo.png", content_type: "image/png", content_id: contentId }],
  };
}

export async function checkMcpCids(cases) {
  const server = new McpServer({ name: "cid-test", version: "1.0.0" });
  const client = new Client({ name: "cid-test", version: "1.0.0" });
  const calls = [];
  registerPaperBoyEmailTools({
    server,
    authorize: async () => ({ orgId: randomUUID(), environment: "test" }),
    services: {
      queue: async (_principal, payload) => {
        calls.push(payload);
        return { id: randomUUID(), createdAt: new Date(), environment: "test", deliveryMode: "test-sink", provider: "test-sink", status: "queued", replayed: false };
      },
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  try {
    const { tools } = await client.listTools();
    const schema = tools.find(({ name }) => name === "paperboy_send_email").inputSchema.properties.attachments.items.properties.content_id;
    const validate = new AjvJsonSchemaValidator().getValidator(schema);
    for (const { value, valid } of cases) {
      assert.equal(validate(value).valid, valid, `MCP JSON Schema ${JSON.stringify(value)}`);
      // Check advertised patterns both with and without Unicode-aware matching.
      for (const flags of ["", "u"]) {
        assert.equal(new RegExp(schema.pattern, flags).test(value), valid, `MCP schema ${JSON.stringify(value)} /${flags}`);
      }
      for (const templateId of [undefined, randomUUID()]) {
        const before = calls.length;
        const result = await client.callTool({ name: "paperboy_send_email", arguments: cidPayload(value, templateId) });
        assert.equal(result.isError === true, !valid, `MCP ${templateId ? "template" : "inline"} ${JSON.stringify(value)}`);
        assert.equal(calls.length, before + Number(valid), "invalid inputs must not reach the queue service");
        if (valid) assert.equal(calls.at(-1).attachments[0].content_id, value);
      }
    }
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

export async function checkQueuedCids(cases, databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  const previousDispatch = process.env.PAPERBOY_INLINE_JOB_DISPATCH;
  process.env.PAPERBOY_INLINE_JOB_DISPATCH = "false";
  const [{ eq }, { db }, { orgs, messages, messageAttachments, emailTemplates }, { queueEmail, loadMessageAttachments }, { describeEmailFailure }] = await Promise.all([
    import("drizzle-orm"), import("../../src/db/index.ts"), import("../../src/db/schema.ts"),
    import("../../src/lib/messages.ts"), import("../../src/lib/email-http.ts"),
  ]);
  const orgId = randomUUID();
  const templateId = randomUUID();
  const blobs = new Map();
  let writes = 0;
  const attachmentStore = {
    put: async ({ storageKey, content }) => { writes += 1; blobs.set(storageKey, content); },
    read: async (key) => blobs.get(key),
    delete: async (key) => { blobs.delete(key); },
  };
  try {
    await db.insert(orgs).values({ id: orgId, name: "CID validation fixture" });
    await db.insert(emailTemplates).values({ id: templateId, orgId, name: "CID", subject: "CID", textBody: "Image", status: "published", publishedVersion: 1, publishedAt: new Date() });
    const labels = [];
    for (const { value, valid } of cases) {
      for (const template of [undefined, templateId]) {
        const before = writes;
        const queue = () => queueEmail({
          payload: cidPayload(value, template),
          principal: { orgId, environment: "test", apiKeyId: null },
          attachmentStore,
        });
        if (!valid) {
          await assert.rejects(queue, (error) => {
            assert.equal(error.code, "VALIDATION_ERROR", JSON.stringify(value));
            assert.ok(error.issues.some(({ field }) => field === "attachments.0.content_id"));
            assert.equal(describeEmailFailure(error).status, 422);
            return true;
          });
          assert.equal(writes, before, "invalid CIDs must fail before blob storage");
        } else {
          const queued = await queue();
          assert.equal(queued.status, "queued");
          assert.equal(queued.provider, "test-sink");
          const [stored] = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, queued.id));
          assert.equal(stored.contentId, value, "PostgreSQL must retain the exact logical ID");
          const loaded = await loadMessageAttachments({ messageId: queued.id, attachmentStore });
          assert.equal(loaded[0].contentId, value, "delivery reconstruction must retain identity");
          assert.deepEqual(loaded[0].content, Buffer.from("image"));
          labels.push(value);
        }
        const persisted = await db.select({ id: messages.id }).from(messages).where(eq(messages.orgId, orgId));
        assert.equal(persisted.length, labels.length, "invalid inputs must not create queued messages");
      }
    }
    const stored = await db.select({ contentId: messageAttachments.contentId }).from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId)).where(eq(messages.orgId, orgId));
    assert.deepEqual(stored.map(({ contentId }) => contentId).sort(), labels.sort());
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    if (previousDispatch === undefined) delete process.env.PAPERBOY_INLINE_JOB_DISPATCH;
    else process.env.PAPERBOY_INLINE_JOB_DISPATCH = previousDispatch;
  }
}
