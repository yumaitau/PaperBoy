import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseSendEmailInput } from "../src/lib/email-core.ts";

for (const mode of ["array", "single", "roundtrip", "single-roundtrip", "array-access"]) {
  test(`PHP recipient models preserve addresses (${mode})`, () => {
    const body = JSON.parse(execFileSync("php", [
      fileURLToPath(new URL("./fixtures/php-sdk-recipients.php", import.meta.url)), mode,
    ], { encoding: "utf8" }));
    const to = mode.startsWith("single") ? "Reader <reader@example.net>" : ["first@example.net", "second@example.net"];
    assert.deepEqual(body.to, to);
    assert.deepEqual(body.cc, ["copy@example.net"]);
    assert.deepEqual(body.bcc, ["hidden@example.net"]);
    assert.deepEqual(body.reply_to, ["reply@example.net"]);
    const parsed = parseSendEmailInput(body);
    assert.deepEqual(parsed.to, typeof to === "string" ? [to] : to);
    assert.deepEqual(parsed.cc, body.cc);
    assert.deepEqual(parsed.bcc, body.bcc);
    assert.deepEqual(parsed.replyTo, body.reply_to);
  });
}
