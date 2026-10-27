import assert from "node:assert/strict";
import test from "node:test";
import { simpleParser } from "mailparser";
import { parseInboundMime } from "../src/lib/inbound-core.ts";
import { receivedCidCases, receivedCidMime } from "./fixtures/inbound-cid.mjs";

test("mailparser distinguishes the wire Content-ID from its logical cid", async () => {
  const mail = await simpleParser(receivedCidMime(receivedCidCases[0]), { skipImageLinks: true });
  assert.equal(mail.attachments[0].contentId, "<logo@example.com>");
  assert.equal(mail.attachments[0].cid, "logo@example.com");
});

for (const sample of receivedCidCases) {
  test(`received MIME CID: ${sample.name}`, async () => {
    const parsed = await parseInboundMime(receivedCidMime(sample));
    assert.equal(parsed.attachments.length, 1);
    assert.equal(parsed.attachments[0].contentId, sample.expected);
    assert.deepEqual(parsed.attachments[0].content, Buffer.from("image"));
    assert.match(parsed.html, /src="cid:logo@example.com"/);
  });
}
