import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { YAML } from "bun";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { parseSendEmailInput } from "../src/lib/email-core.ts";
import { registerPaperBoyEmailTools } from "../src/mcp/email-tools.ts";

const recipientLimit = /50 recipients across to, cc, and bcc/;
const addresses = (count) => Array.from({ length: count }, (_, i) => `reader${i}@example.net`);
const modes = {
  inline: { subject: "Recipient contract", text: "Body" },
  template: { template_id: "11111111-1111-4111-8111-111111111111" },
};

async function withEmailClient(run) {
  const calls = [];
  const message = {
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    deliveryMode: "test-sink",
    environment: "test",
    id: "22222222-2222-4222-8222-222222222222",
    provider: "test-sink",
    replayed: false,
    status: "queued",
  };
  const server = new McpServer({ name: "recipient-contract-test", version: "1.0.0" });
  registerPaperBoyEmailTools({
    authorize: async () => ({ apiKeyId: "test-key", environment: "test", orgId: "test-org" }),
    server,
    services: {
      queue: async (_principal, payload) => {
        calls.push(payload);
        return message;
      },
      queueBatch: async (_principal, payloads) => {
        calls.push(...payloads);
        return payloads.map(() => ({ ok: true, message }));
      },
    },
  });
  const client = new Client({ name: "recipient-contract-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  try {
    await run(client, calls);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

for (const [mode, content] of Object.entries(modes)) {
  for (const batch of [false, true]) {
    test(`MCP ${batch ? "batch" : "single"} ${mode} enforces the aggregate recipient limit before queueing`, async () => {
      await withEmailClient(async (client, calls) => {
        const send = (recipients) => {
          const payload = { from: "sender@example.com", ...content, ...recipients };
          return client.callTool({
            name: batch ? "paperboy_send_email_batch" : "paperboy_send_email",
            arguments: batch ? { emails: [payload] } : payload,
          });
        };

        for (const recipients of [
          { to: addresses(50), cc: "copy@example.net" },
          { to: "reader@example.net", bcc: addresses(50) },
          { to: addresses(49), cc: "copy@example.net", bcc: "blind@example.net" },
          { to: addresses(17), cc: addresses(17), bcc: addresses(17) },
          { to: addresses(50), cc: addresses(50), bcc: addresses(50) },
        ]) {
          assert.throws(
            () => parseSendEmailInput({ from: "sender@example.com", ...modes.inline, ...recipients }),
            (error) => error.issues.some((issue) => recipientLimit.test(issue.message)),
          );
          const result = await send(recipients);
          assert.equal(result.isError, true, "MCP must reject the same excess recipients as the shared parser");
          assert.match(result.content[0].text, recipientLimit);
          assert.equal(calls.length, 0, "invalid input must never reach a queue service");
        }

        for (const recipients of [
          { to: "reader@example.net" },
          { to: "reader@example.net", cc: "copy@example.net", bcc: "blind@example.net" },
          { to: addresses(50), reply_to: addresses(50) },
          { to: addresses(48), cc: "copy@example.net", bcc: "blind@example.net" },
          { to: "reader@example.net", cc: addresses(49) },
          { to: addresses(1), bcc: addresses(49) },
        ]) {
          assert.doesNotThrow(() => parseSendEmailInput({ from: "sender@example.com", ...modes.inline, ...recipients }));
          const before = calls.length;
          const result = await send(recipients);
          assert.equal(result.isError, undefined);
          assert.equal(calls.length, before + 1);
          assert.deepEqual(calls.at(-1), { from: "sender@example.com", ...content, ...recipients });
        }
      });
    });
  }
}

test("MCP applies the recipient cap per batch item, including later items", async () => {
  await withEmailClient(async (client, calls) => {
    const email = { from: "sender@example.com", ...modes.inline, to: addresses(50) };
    const invalid = await client.callTool({
      name: "paperboy_send_email_batch",
      arguments: { emails: [email, { ...email, cc: "copy@example.net" }] },
    });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0].text, recipientLimit);
    assert.equal(calls.length, 0);

    const valid = await client.callTool({
      name: "paperboy_send_email_batch",
      arguments: { emails: [email, email] },
    });
    assert.equal(valid.isError, undefined);
    assert.equal(calls.length, 2);
  });
});

test("MCP discovery describes the aggregate limit for single sends and each batch item", async () => {
  await withEmailClient(async (client) => {
    const { tools } = await client.listTools();
    const single = tools.find((tool) => tool.name === "paperboy_send_email").inputSchema;
    const batch = tools.find((tool) => tool.name === "paperboy_send_email_batch").inputSchema;
    for (const schema of [single, batch.properties.emails.items]) {
      assert.match(schema.description, recipientLimit);
      assert.match(schema.description, /reply_to.*(?:excluded|not count)/);
      for (const field of ["to", "cc", "bcc", "reply_to"]) {
        assert.equal(schema.properties[field].anyOf[1].maxItems, 50);
      }
    }
  });
});

test("OpenAPI send models explain the aggregate limit and preserve recipient unions", async () => {
  const { components: { schemas } } = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8"));
  for (const name of ["InlineEmailInput", "TemplateEmailInput"]) {
    assert.match(schemas[name].description, recipientLimit);
    assert.match(schemas[name].description, /reply_to.*(?:excluded|not count)/);
    for (const field of ["to", "cc", "bcc", "reply_to"]) {
      assert.equal(schemas[name].properties[field].$ref, "#/components/schemas/Recipients");
    }
  }
  assert.equal(schemas.Recipients.oneOf[0].type, "string");
  assert.equal(schemas.Recipients.oneOf[1].maxItems, 50);
});
