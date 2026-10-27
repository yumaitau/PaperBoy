import assert from "node:assert/strict";
import test from "node:test";
import bytes from "next/dist/compiled/bytes/index.js";
import nextConfig from "../next.config.ts";
import { MAX_TEMPLATE_BODY_LENGTH, parseCreateTemplateInput } from "../src/lib/template-core.ts";
import { MAX_CONTACT_CSV_BYTES } from "../src/lib/audience-core.ts";

const limit = bytes.parse(nextConfig.experimental?.serverActions?.bodySizeLimit ?? "1mb");

async function wireSize(form) {
  const request = new Request("https://paperboy.test/action", { method: "POST", body: form });
  return (await request.arrayBuffer()).byteLength;
}

test("server action transport accommodates combined valid multibyte template bodies", async () => {
  const html = `<p>${"文".repeat(MAX_TEMPLATE_BODY_LENGTH - 7)}</p>`;
  const text = "文".repeat(MAX_TEMPLATE_BODY_LENGTH);
  const payload = { name: "Large template", subject: "A valid subject", html, text };
  parseCreateTemplateInput(payload);
  const form = new FormData();
  for (const [name, value] of Object.entries(payload)) form.set(name, value);
  form.set("requiredVariables", "");
  form.set("$ACTION_ID_test", "");
  assert.ok(await wireSize(form) < limit, "valid HTML and text must fit together including UTF-8 and multipart overhead");
  assert.ok(limit <= 16 * 1024 * 1024, "keep a finite transport memory bound");
});

test("maximum-sized CSV uploads have room for multipart overhead", async () => {
  const form = new FormData();
  form.set("file", new File(["a".repeat(MAX_CONTACT_CSV_BYTES)], "contacts.csv", { type: "text/csv" }));
  form.set("audienceId", "11111111-1111-4111-8111-111111111111");
  form.set("$ACTION_ID_test", "");
  assert.ok(await wireSize(form) < limit);
});
