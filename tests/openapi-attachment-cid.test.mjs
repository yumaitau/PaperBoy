import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";
import { parseSendEmailInput } from "../src/lib/email-core.ts";

// ECMAScript WhiteSpace and LineTerminator characters, including BOM (U+FEFF).
const whitespace = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
].map((codePoint) => String.fromCodePoint(codePoint));

const cases = [
  { value: "logo-small", valid: true },
  { value: "s", valid: true },
  { value: "hero@example", valid: true },
  { value: "hero/logo", valid: true },
  { value: "logo\\small", valid: true },
  { value: "café/画像/📨", valid: true },
  { value: "x".repeat(256), valid: true },
  { value: "x".repeat(257), valid: false },
  // These are NOT JavaScript whitespace. In particular PCRE UCP's \s includes
  // U+0085; using it would tighten the API contract. Keep non-whitespace
  // C1 controls, format characters, and adjacent code points accepted as before.
  ...[0x0085, 0x1681, 0x180e,
    0x200b, 0x200c, 0x200d, 0x2027, 0x202a, 0x202e, 0x2030, 0x2060,
    0xfefe, 0xfffd, 0xffff,
  ].flatMap((codePoint) => [
    { value: `hero${String.fromCodePoint(codePoint)}logo`, valid: true },
    { value: `logo${String.fromCodePoint(codePoint)}`, valid: true },
  ]),
  ...whitespace.flatMap((character) => [
    { value: character, valid: false },
    { value: `${character}logo`, valid: false },
    { value: `hero${character}logo`, valid: false },
    { value: `logo${character}`, valid: false },
  ]),
  { value: "logo\r\n", valid: false },
  { value: "logo\n\n", valid: false },
  { value: "<logo>", valid: false },
  { value: "logo,small", valid: false },
  { value: "logo;small", valid: false },
];

test("parsed OpenAPI attachment CID pattern agrees with send validation", async () => {
  const source = await readFile(new URL("../openapi.yaml", import.meta.url), "utf8");
  const schema = YAML.parse(source).components.schemas.EmailAttachment;
  const pattern = new RegExp(schema.properties.content_id.pattern);

  for (const { value, valid } of cases) {
    const label = JSON.stringify(value);
    const length = Array.from(value).length;
    assert.equal(pattern.test(value)
      && length >= schema.properties.content_id.minLength
      && length <= schema.properties.content_id.maxLength, valid, `OpenAPI CID ${label}`);
    const parse = () => parseSendEmailInput({
      from: "sender@example.com",
      to: "reader@example.net",
      subject: "CID validation",
      text: "Inline image",
      attachments: [{
        content: Buffer.from("image").toString("base64"),
        content_type: "image/png",
        filename: "logo.png",
        content_id: value,
      }],
    });
    if (valid) {
      assert.equal(parse().attachments[0].contentId, value, `send CID ${label}`);
    } else {
      assert.throws(parse, (error) => error.issues.some(
        (issue) => issue.field === "attachments.0.content_id",
      ), `send CID ${label}`);
    }
  }
});

test("PHP rejects malformed UTF-8 CIDs in both validation paths", () => {
  // JSON cannot carry invalid UTF-8, so send its bytes to the PHP fixture as
  // Base64. Include invalid encodings of whitespace and a lone surrogate.
  const values = [
    [0xff], [0x80], [0xc2], [0xc0, 0xa0], [0xc0, 0x8a],
    [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe2, 0x80],
  ].flatMap((bytes) => [Buffer.from(bytes), Buffer.concat([
    Buffer.from("logo"), Buffer.from(bytes),
  ])]).map((bytes) => bytes.toString("base64"));
  const results = JSON.parse(execFileSync("php", [
    fileURLToPath(new URL("./fixtures/php-sdk-attachment-cid.php", import.meta.url)),
    "--base64",
  ], { input: JSON.stringify(values), encoding: "utf8" }));

  assert.deepEqual(results, values.map((value) => ({
    value, constructorValid: false, setterValid: false,
  })));
});

test("empty CID remains an absent value at the server and invalid in the PHP setter", () => {
  const parsed = parseSendEmailInput({
    from: "sender@example.com", to: "reader@example.net", subject: "CID", text: "Image",
    attachments: [{ content: "aW1hZ2U=", content_type: "image/png", filename: "logo.png", content_id: "" }],
  });
  assert.equal(parsed.attachments[0].contentId, null);
  const results = JSON.parse(execFileSync("php", [
    fileURLToPath(new URL("./fixtures/php-sdk-attachment-cid.php", import.meta.url)),
  ], { input: JSON.stringify([""]), encoding: "utf8" }));
  assert.deepEqual(results, [{ value: "", constructorValid: false, setterValid: false }]);
});

test("generated PHP attachment model validates CIDs through constructor and setter", () => {
  const results = JSON.parse(execFileSync("php", [
    fileURLToPath(new URL("./fixtures/php-sdk-attachment-cid.php", import.meta.url)),
  ], { input: JSON.stringify(cases.map(({ value }) => value)), encoding: "utf8" }));

  assert.equal(results.length, cases.length);
  for (const [index, { value, valid }] of cases.entries()) {
    assert.deepEqual(results[index], {
      value,
      constructorValid: valid,
      setterValid: valid,
    }, `PHP CID ${JSON.stringify(value)}`);
  }
});
