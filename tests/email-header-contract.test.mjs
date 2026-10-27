import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { YAML } from "bun";
import { Client } from "@modelcontextprotocol/client";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/client/validators/ajv";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { simpleParser } from "mailparser";
import { EmailError, parseSendEmailInput } from "../src/lib/email-core.ts";
import { buildSmtpMimeMessage } from "../src/lib/email-delivery.ts";
import { registerPaperBoyEmailTools } from "../src/mcp/email-tools.ts";

const inline = {
  from: "sender@example.com",
  to: "reader@example.net",
  subject: "Header contract",
  text: "Body",
};
const template = {
  from: inline.from,
  to: inline.to,
  template_id: "11111111-1111-4111-8111-111111111111",
};
const reserved = [
  "bcc", "cc", "content-transfer-encoding", "content-type", "date",
  "dkim-signature", "domainkey-signature", "from", "message-id", "mime-version",
  "received", "reply-to", "return-path", "return-receipt-to", "sender",
  "subject", "to", "x-paperboy-message-id",
];
const countHeaders = (count) => Object.fromEntries(
  Array.from({ length: count }, (_, i) => [`X-${i}`, "value"]),
);
// RFC 5322 section 3.6.8: ftext = %d33-57 / %d59-126 (not HTTP token).
const valid = [
  {}, countHeaders(50), { ["X".repeat(128)]: "v" },
  { "X-Value": "v".repeat(998) }, { "X-Value": " \t café " },
  { "X-Value": "\u2028\u2029" },
  { "Bad(Header": "compatible", "X(Test)": "compatible" },
  { "From-Custom": "v", "X-PaperBoy": "v", "X-PaperBoys-Custom": "v" },
  ...Array.from({ length: 94 }, (_, i) => i + 33)
    .filter((code) => code !== 58)
    .map((code) => ({ [`X${String.fromCharCode(code)}Y`]: "value" })),
];
const invalidNames = [
  "", "X".repeat(129), "Bad Header", "Bad:Header", "Bad\tHeader",
  "Bad\rHeader", "Bad\nHeader", "Bad\0Header", "Bad\x7fHeader", "X-Café",
  "X-PaperBoy-", "x-PaPeRbOy-Custom",
  ...reserved.flatMap((name) => [
    name, name.toUpperCase(),
    [...name].map((char, i) => i % 2 ? char.toUpperCase() : char).join(""),
  ]),
].map((name) => ({ [name]: "value" }));
const invalidValues = ["", "v".repeat(999), "one\rtwo", "one\ntwo", "one\r\ntwo", "v\n", null, 1]
  .map((value) => ({ "X-Value": value }));
const invalid = [...invalidNames, ...invalidValues, countHeaders(51), null, []];

const unicodeValues = [
  { value: "😀".repeat(499), accepted: true },
  { value: "😀".repeat(500), accepted: true },
  { value: "😀".repeat(998), accepted: true },
  { value: "😀".repeat(999), accepted: false },
  { value: "a".repeat(997) + "😀", accepted: true },
  { value: "a".repeat(998) + "😀", accepted: false },
  // Combining marks count separately: the contract counts code points, not graphemes.
  { value: "e\u0301".repeat(499), accepted: true },
  { value: "e\u0301".repeat(499) + "!", accepted: false },
];

const rawHeaderValues = [
  ...[42, null, false, [], {}, "", "first\nsecond", "first\rsecond", "value\n", "v".repeat(999)]
    .map((value) => ({ value, accepted: false })),
  ...["value", " \t café ", "\u2028\u2029", "v".repeat(998)]
    .map((value) => ({ value, accepted: true })),
  ...unicodeValues,
];

// Capture the actual registered input schemas, including preprocessing.
const inputSchemas = new Map();
registerPaperBoyEmailTools({
  server: { registerTool: (name, config) => inputSchemas.set(name, config.inputSchema) },
  authorize: async () => null,
  services: {},
});

async function withEmailClient(run) {
  const server = new McpServer({ name: "header-contract", version: "1.0.0" });
  const calls = [];
  const message = {
    id: "22222222-2222-4222-8222-222222222222",
    createdAt: new Date("2026-10-27T00:00:00Z"),
    deliveryMode: "test-sink", environment: "test", provider: "test-sink",
    replayed: false, status: "queued",
  };
  registerPaperBoyEmailTools({
    server,
    authorize: async () => ({ organizationId: "header-contract-test" }),
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
  const client = new Client({ name: "header-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  try {
    await run(client, calls);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

function checkSchema(schema, cases, expected) {
  const validate = new AjvJsonSchemaValidator().getValidator(schema);
  for (const headers of cases) {
    const result = validate(headers);
    assert.equal(result.valid, expected, JSON.stringify({ headers, error: result.errorMessage }));
  }
}

test("runtime header policy accepts RFC 5322 ftext and enforces application limits", () => {
  for (const headers of valid) {
    assert.deepEqual(parseSendEmailInput({ ...inline, headers }).headers, headers);
  }
  for (const headers of invalid) {
    assert.throws(() => parseSendEmailInput({ ...inline, headers }), EmailError);
  }
});

test("OpenAPI header schema rejects invalid and reserved names while retaining ftext", async () => {
  const spec = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8"));
  for (const name of ["InlineEmailInput", "TemplateEmailInput"]) {
    assert.equal(spec.components.schemas[name].properties.headers.$ref, "#/components/schemas/EmailHeaders");
  }
  const schema = spec.components.schemas.EmailHeaders;
  checkSchema(schema, valid, true);
  checkSchema(schema, invalid, false);
});

for (const name of ["paperboy_send_email", "paperboy_send_email_batch"]) {
  test(`${name} advertises the complete header constraints`, async () => {
    await withEmailClient(async (client) => {
      const { tools } = await client.listTools();
      const input = tools.find((tool) => tool.name === name).inputSchema;
      const schema = name.endsWith("_batch")
        ? input.properties.emails.items.properties.headers
        : input.properties.headers;
      checkSchema(schema, valid, true);
      checkSchema(schema, invalid, false);
    });
  });

  test(`${name} rejects invalid headers before queueing and preserves valid headers`, async () => {
    await withEmailClient(async (client, calls) => {
      for (const mode of [inline, template]) {
        for (const headers of valid) {
          const payload = { ...mode, headers };
          const result = await client.callTool({ name, arguments: name.endsWith("_batch") ? { emails: [payload] } : payload });
          assert.notEqual(result.isError, true, JSON.stringify(headers));
          assert.deepEqual(calls.at(-1).headers, headers);
        }
        const count = calls.length;
        for (const headers of invalid) {
          const payload = { ...mode, headers };
          const result = await client.callTool({ name, arguments: name.endsWith("_batch") ? { emails: [payload] } : payload });
          assert.equal(result.isError, true, JSON.stringify(headers));
          assert.equal(calls.length, count, "Invalid headers must not reach a queue service");
        }
      }
    });
  });
}

for (const [mode, content] of Object.entries({ inline, template })) {
  for (const batch of [false, true]) {
    const name = batch ? "paperboy_send_email_batch" : "paperboy_send_email";
    const label = `${mode}, ${batch ? "later batch item" : "single"}`;

    test(`raw special header values match shared parsing and MCP discovery (${label})`, async () => {
      const spec = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8"));
      await withEmailClient(async (client) => {
        const { tools } = await client.listTools();
        const input = tools.find((tool) => tool.name === name).inputSchema;
        const discovery = batch ? input.properties.emails.items.properties.headers : input.properties.headers;
        for (const key of ["__proto__", "constructor", "toString"]) {
          for (const { value, accepted } of rawHeaderValues) {
            const headers = JSON.parse(JSON.stringify({ [key]: value, "X(Test)": "compatible" }));
            assert.equal(Object.hasOwn(headers, key), true);
            checkSchema(spec.components.schemas.EmailHeaders, [headers], accepted);
            checkSchema(discovery, [headers], accepted);
            // Template sends resolve to inline content before the shared parser runs.
            if (accepted) {
              assert.doesNotThrow(() => parseSendEmailInput({ ...inline, headers }));
            } else {
              assert.throws(() => parseSendEmailInput({ ...inline, headers }), EmailError);
            }
            const payload = { ...content, headers };
            const result = inputSchemas.get(name).safeParse(batch ? { emails: [inline, payload] } : payload);
            assert.equal(result.success, accepted, JSON.stringify({ key, value }));
            if (!accepted) {
              assert.deepEqual(result.error.issues[0].path, batch ? ["emails", 1, "headers", key] : ["headers", key]);
            }
          }
        }
      });
    });

    test(`raw special header values are checked before any queue service runs (${label})`, async () => {
      await withEmailClient(async (client, calls) => {
        for (const key of ["__proto__", "constructor", "toString"]) {
          for (const { value, accepted } of rawHeaderValues) {
            const headers = JSON.parse(JSON.stringify({ [key]: value, "X(Test)": "compatible" }));
            const before = calls.length;
            const payload = { ...content, headers };
            const result = await client.callTool({ name, arguments: batch ? { emails: [inline, payload] } : payload });
            if (accepted) {
              assert.notEqual(result.isError, true, JSON.stringify({ key, value }));
              assert.equal(calls.length, before + (batch ? 2 : 1));
              assert.deepEqual(calls.at(-1).headers, parseSendEmailInput({ ...inline, headers }).headers);
            } else {
              assert.equal(result.isError, true, JSON.stringify({ key, value }));
              assert.equal(calls.length, before, "Invalid raw values must reject the entire batch before queueing");
            }
          }
        }
      });
    });

    test(`raw header count includes an own JSON __proto__ property (${label})`, async () => {
      const spec = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8"));
      await withEmailClient(async (client, calls) => {
        const { tools } = await client.listTools();
        const input = tools.find((tool) => tool.name === name).inputSchema;
        const discovery = batch ? input.properties.emails.items.properties.headers : input.properties.headers;
        assert.equal(discovery.maxProperties, 50);

        for (const ordinaryCount of [50, 49, 0]) {
          const ordinary = countHeaders(ordinaryCount);
          const headers = JSON.parse(JSON.stringify({ ...ordinary, ["__proto__"]: "value" }));
          assert.equal(Object.hasOwn(headers, "__proto__"), true);
          assert.equal(Object.keys(headers).length, ordinaryCount + 1);
          const accepted = ordinaryCount < 50;
          checkSchema(spec.components.schemas.EmailHeaders, [headers], accepted);
          checkSchema(discovery, [headers], accepted);
          if (accepted) {
            // Keep the existing <=50-key normalization policy: __proto__ is dropped.
            assert.deepEqual(parseSendEmailInput({ ...inline, headers }).headers, ordinary);
          } else {
            assert.throws(() => parseSendEmailInput({ ...inline, headers }), EmailError);
          }

          const before = calls.length;
          const payload = { ...content, headers };
          const result = await client.callTool({ name, arguments: batch ? { emails: [inline, payload] } : payload });
          if (accepted) {
            assert.notEqual(result.isError, true);
            assert.equal(calls.length, before + (batch ? 2 : 1));
            assert.deepEqual(calls.at(-1).headers, ordinary);
          } else {
            assert.equal(result.isError, true);
            assert.match(result.content[0].text, /at most 50 headers/);
            assert.equal(calls.length, before, "No item may queue when a later item has 51 raw keys");
          }
        }
      });
    });

    test(`Unicode header values use JSON Schema code-point limits (${label})`, async () => {
      const spec = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8"));
      await withEmailClient(async (client, calls) => {
        const { tools } = await client.listTools();
        const input = tools.find((tool) => tool.name === name).inputSchema;
        const discovery = batch ? input.properties.emails.items.properties.headers : input.properties.headers;
        assert.equal(discovery.additionalProperties.maxLength, 998);

        for (const { value, accepted } of unicodeValues) {
          const headers = { "X-Value": value };
          checkSchema(spec.components.schemas.EmailHeaders, [headers], accepted);
          checkSchema(discovery, [headers], accepted);
          if (accepted) {
            assert.deepEqual(parseSendEmailInput({ ...inline, headers }).headers, headers);
          } else {
            assert.throws(() => parseSendEmailInput({ ...inline, headers }), EmailError);
          }

          const before = calls.length;
          const payload = { ...content, headers };
          const result = await client.callTool({ name, arguments: batch ? { emails: [inline, payload] } : payload });
          if (accepted) {
            assert.notEqual(result.isError, true);
            assert.equal(calls.length, before + (batch ? 2 : 1));
            assert.deepEqual(calls.at(-1).headers, headers);
          } else {
            assert.equal(result.isError, true);
            assert.equal(calls.length, before, "No item may queue when a later header exceeds 998 code points");
          }
        }
      });
    });
  }
}

test("accepted Unicode values and RFC 5322 header names survive MIME serialization", async () => {
  for (const { value } of unicodeValues.filter((entry) => entry.accepted)) {
    const headers = { "X(Test)": value, "X-Other": "preserved" };
    const input = parseSendEmailInput({ ...inline, headers });
    const raw = await buildSmtpMimeMessage(input);
    const parsed = await simpleParser(raw);
    // Mailparser leaves unknown fields encoded; Subject uses the same RFC 2047
    // unstructured-value decoding needed for this custom header.
    const decoded = await simpleParser(`Subject: ${parsed.headers.get("x(test)")}\r\n\r\n`);
    assert.equal(decoded.subject, value);
    assert.equal(parsed.headers.get("x-other"), "preserved");
    assert.equal(parsed.subject, inline.subject);
    assert.equal(parsed.text.trim(), inline.text);
    for (const line of raw.toString("ascii").split("\r\n\r\n")[0].split("\r\n")) {
      assert.ok(line.length <= 998, "MIME header lines must stay within the RFC 5322 line limit");
    }
  }
});
