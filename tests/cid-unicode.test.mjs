import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";
import { parseSendEmailInput } from "../src/lib/email-core.ts";
import { checkMcpCids, checkQueuedCids, cidPayload } from "./fixtures/cid-input-boundaries.mjs";

const invalid = ["\ud800", "\ud801", "\udbff", "\udc00", "\udfff", "\udc00\ud800", "\ud800\ud800", "\udfff\udfff", "\ud800a\udc00", "📨\ud800", "\udc00📨"]
  .flatMap((value) => [value, `${value}logo`, `a${value}b`, `logo${value}`]);
const valid = ["logo@example", "café/画像/📨", "é", "e\u0301", "\ufffd", "\ud7ff", "\ue000", "\uffff", "\ud800\udc00", "\udbff\udfff", "📨📨", "\u0085", "\u200b"];
const cases = [...invalid.map((value) => ({ value, valid: false })), ...valid.map((value) => ({ value, valid: true }))];

test("ill-formed CID Unicode is rejected by shared parser and flag-independent OpenAPI pattern", async () => {
  const schema = YAML.parse(await readFile(new URL("../openapi.yaml", import.meta.url), "utf8")).components.schemas.EmailAttachment.properties.content_id;
  for (const { value, valid } of cases) {
    for (const flags of ["", "u"]) assert.equal(new RegExp(schema.pattern, flags).test(value), valid, JSON.stringify(value));
    if (valid) assert.equal(parseSendEmailInput(cidPayload(value)).attachments[0].contentId, value);
    else assert.throws(() => parseSendEmailInput(cidPayload(value)), (error) => error.code === "VALIDATION_ERROR" && error.issues.some(({ field }) => field === "attachments.0.content_id"), JSON.stringify(value));
  }
});

test("PHP preserves valid CID Unicode and rejects UTF-8 encodings of surrogate halves", () => {
  const fixture = fileURLToPath(new URL("./fixtures/php-sdk-attachment-cid.php", import.meta.url));
  const results = JSON.parse(execFileSync("php", [fixture], { input: JSON.stringify(valid), encoding: "utf8" }));
  assert.deepEqual(results, valid.map((value) => ({ value, constructorValid: true, setterValid: true })));
  // PHP strings contain bytes, not UTF-16 code units. JSON decoding rejects
  // escaped lone surrogates before model validation. Construct invalid UTF-8
  // bytes explicitly: Buffer.from(loneSurrogate) would replace them with U+FFFD.
  const malformed = [[0xed, 0xa0, 0x80], [0xed, 0xaf, 0xbf], [0xed, 0xb0, 0x80], [0xed, 0xbf, 0xbf],
    // CESU-8 encodes a valid UTF-16 pair as two invalid UTF-8 surrogate values.
    [0xed, 0xa0, 0xbd, 0xed, 0xb8, 0x80]]
    .flatMap((bytes) => [Buffer.from(bytes), Buffer.concat([Buffer.from("logo"), Buffer.from(bytes)])])
    .map((bytes) => bytes.toString("base64"));
  const rejected = JSON.parse(execFileSync("php", [fixture, "--base64"], { input: JSON.stringify(malformed), encoding: "utf8" }));
  assert.deepEqual(rejected, malformed.map((value) => ({ value, constructorValid: false, setterValid: false })));
});

test("MCP inline/template lone-surrogate CIDs fail before queue service", () => checkMcpCids(cases));

test("ill-formed CID Unicode fails before storage; distinct valid labels persist without replacement or normalization", {
  skip: process.env.PAPERBOY_TEST_DATABASE_URL ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, () => checkQueuedCids(cases, process.env.PAPERBOY_TEST_DATABASE_URL));
