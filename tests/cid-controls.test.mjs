import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";
import { parseSendEmailInput } from "../src/lib/email-core.ts";
import { checkMcpCids, checkQueuedCids, cidPayload } from "./fixtures/cid-input-boundaries.mjs";

const invalid = [...Array.from({ length: 32 }, (_, code) => code), 0x7f]
  .flatMap((code) => [String.fromCharCode(code), `a${String.fromCharCode(code)}b`, `a${String.fromCharCode(code)}`]);
const valid = ["logo@example", "café/画像/📨", "é", "e\u0301", "\u0080", "\u0085", "\u009f", "\u200b", "\ufffd", "\uffff"];
const cases = [...invalid.map((value) => ({ value, valid: false })), ...valid.map((value) => ({ value, valid: true }))];

test("CID C0/DEL rejection agrees across shared parser and OpenAPI without restricting other Unicode", async () => {
  const schema = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8")).components.schemas.EmailAttachment.properties.content_id;
  for (const { value, valid } of cases) {
    for (const flags of ["", "u"]) assert.equal(new RegExp(schema.pattern, flags).test(value), valid, JSON.stringify(value));
    if (valid) assert.equal(parseSendEmailInput(cidPayload(value)).attachments[0].contentId, value);
    else assert.throws(() => parseSendEmailInput(cidPayload(value)), (error) => error.code === "VALIDATION_ERROR" && error.issues.some(({ field }) => field === "attachments.0.content_id"), JSON.stringify(value));
  }
});

test("CID controls are rejected by PHP constructor validation and setter", () => {
  const results = JSON.parse(execFileSync("php", [fileURLToPath(new URL("./fixtures/php-sdk-attachment-cid.php", import.meta.url))], { input: JSON.stringify(cases.map(({ value }) => value)), encoding: "utf8" }));
  assert.deepEqual(results, cases.map(({ value, valid }) => ({ value, constructorValid: valid, setterValid: valid })));
});

test("MCP inline/template CID controls fail before queue service", () => checkMcpCids(cases));

test("CID controls fail before blob/message storage; valid labels survive queue reconstruction", {
  skip: process.env.PAPERBOY_TEST_DATABASE_URL ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, () => checkQueuedCids(cases, process.env.PAPERBOY_TEST_DATABASE_URL));
