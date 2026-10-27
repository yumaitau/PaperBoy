import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";
import { Client } from "@modelcontextprotocol/client";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/client/validators/ajv";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { EmailError, parseSendEmailInput } from "../src/lib/email-core.ts";
import { registerPaperBoyEmailTools } from "../src/mcp/email-tools.ts";

const cases = [
  ["a".repeat(256), true], ["a".repeat(257), false],
  ["é".repeat(256), true], ["é".repeat(257), false],
  ["😀".repeat(128), true], ["😀".repeat(129), true],
  ["😀".repeat(256), true], ["😀".repeat(257), false],
  ["a😀".repeat(128), true], ["a😀".repeat(128) + "a", false],
  ["a\u0301".repeat(128), true], ["a\u0301".repeat(129), false],
];
const attachment = (content_id) => ({
  content: "YQ==", content_type: "image/png", filename: "a.png", content_id,
});
const inline = {
  from: "sender@example.com", to: "reader@example.net", subject: "CID length", text: "Body",
};
const template = {
  from: inline.from, to: inline.to, template_id: "11111111-1111-4111-8111-111111111111",
};

test("attachment CID length agrees with OpenAPI and PHP Unicode character limits", async () => {
  const spec = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8"));
  const schema = spec.components.schemas.EmailAttachment.properties.content_id;
  const validate = new AjvJsonSchemaValidator().getValidator(schema);
  const php = JSON.parse(execFileSync("php", [
    fileURLToPath(new URL("./fixtures/php-sdk-attachment-cid-length.php", import.meta.url)),
  ], { encoding: "utf8", input: JSON.stringify(cases.map(([cid]) => cid)) }));

  for (const [index, [cid, accepted]] of cases.entries()) {
    const context = `${[...cid].length} code points / ${cid.length} UTF-16 units`;
    assert.equal(validate(cid).valid, accepted, context);
    assert.equal(php[index].valid, accepted, `PHP constructor: ${context}`);
    assert.equal(php[index].setter, accepted, `PHP setter: ${context}`);
    if (accepted) {
      const parsed = parseSendEmailInput({ ...inline, attachments: [attachment(cid)] });
      assert.equal(parsed.attachments[0].contentId, cid, context);
    } else {
      assert.throws(
        () => parseSendEmailInput({ ...inline, attachments: [attachment(cid)] }),
        (error) => error instanceof EmailError && error.issues.some((issue) => issue.field === "attachments.0.content_id"),
        context,
      );
    }
  }
});

for (const [mode, content] of Object.entries({ inline, template })) {
  test(`MCP ${mode} CID limits match discovery and preserve accepted Unicode`, async () => {
    const server = new McpServer({ name: "cid-length", version: "1.0.0" });
    const calls = [];
    registerPaperBoyEmailTools({
      server,
      authorize: async () => ({ orgId: "cid-length-test", environment: "test" }),
      services: {
        queue: async (_principal, payload) => {
          calls.push(payload);
          return {
            id: "22222222-2222-4222-8222-222222222222", createdAt: new Date("2026-10-27T00:00:00Z"),
            deliveryMode: "test-sink", environment: "test", provider: "test-sink", replayed: false, status: "queued",
          };
        },
      },
    });
    const client = new Client({ name: "cid-length-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    try {
      const { tools } = await client.listTools();
      const schema = tools.find((tool) => tool.name === "paperboy_send_email")
        .inputSchema.properties.attachments.items.properties.content_id;
      assert.equal(schema.maxLength, 256);
      const validate = new AjvJsonSchemaValidator().getValidator(schema);
      for (const [cid, accepted] of cases) {
        assert.equal(validate(cid).valid, accepted);
        const before = calls.length;
        const result = await client.callTool({
          name: "paperboy_send_email", arguments: { ...content, attachments: [attachment(cid)] },
        });
        assert.equal(result.isError === true, !accepted, `${[...cid].length} code points`);
        assert.equal(calls.length, before + Number(accepted));
        if (accepted) assert.equal(calls.at(-1).attachments[0].content_id, cid);
      }
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });
}
