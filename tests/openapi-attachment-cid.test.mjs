import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";
import { parseSendEmailInput } from "../src/lib/email-core.ts";

const cases = [
  { value: "logo-small", valid: true },
  { value: "s", valid: true },
  { value: "hero@example", valid: true },
  { value: "hero/logo", valid: true },
  { value: "logo\\small", valid: true },
  { value: "hero logo", valid: false },
  { value: "hero\tlogo", valid: false },
  { value: "hero\nlogo", valid: false },
  { value: "hero\rlogo", valid: false },
  { value: "hero\vlogo", valid: false },
  { value: "hero\flogo", valid: false },
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
    assert.equal(pattern.test(value), valid, `OpenAPI CID ${label}`);
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
