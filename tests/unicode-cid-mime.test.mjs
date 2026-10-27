import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { simpleParser } from "mailparser";
import { parse } from "parse5";
import { createAwsSesAdapter } from "../src/lib/aws-ses-adapter.ts";
import {
  emailRequestHash,
  parseSendEmailInput,
} from "../src/lib/email-core.ts";
import {
  buildArchiveMimeMessage,
  buildSmtpMimeMessage,
  prepareCloudflareEmailMessage,
} from "../src/lib/email-delivery.ts";
import { createSmtpAdapter } from "../src/lib/smtp-adapter.ts";

const accent = "\u00e9";
const emoji = "\ud83d\ude00";
const bytes = Buffer.from("inline image fixture");
const now = () => new Date("2026-10-27T00:00:00.000Z");
function message(labels = [accent], html = `<img src="cid:${labels[0]}">`) {
  return {
    attemptCount: 1,
    attachments: labels.map((contentId) => ({
      content: bytes,
      contentId,
      contentType: "image/png",
      filename: "original.png",
    })),
    bcc: ["hidden@example.org"],
    cc: ["copy@example.org"],
    date: now(),
    deliveryMode: "live",
    environment: "live",
    from: "sender@example.com",
    headers: { "X(test)": "custom value" },
    html,
    id: "11111111-1111-4111-8111-111111111111",
    orgId: "22222222-2222-4222-8222-222222222222",
    provider: "smtp",
    subject: "Unicode inline attachment",
    text: `Original cid:${labels[0]}`,
    to: ["reader@example.net"],
  };
}
async function parsedMime(input) {
  const raw = await buildSmtpMimeMessage(input);
  return { raw, parsed: await simpleParser(raw, { skipImageLinks: true }) };
}
function assertWire(id) {
  assert.match(id, /^pb-[a-f0-9]{64}@cid\.paperboy\.invalid$/);
  assert.ok(Buffer.byteLength(`Content-ID: <${id}>`) < 998);
}
function attrs(html, tag, name) {
  const result = [];
  const pending = [parse(html)];
  while (pending.length) {
    const node = pending.pop();
    if (node.tagName === tag) {
      const attr = node.attrs.find(
        (attr) =>
          (attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name) === name,
      );
      if (attr) result.push(attr.value);
    }
    if (node.childNodes) pending.push(...[...node.childNodes].reverse());
    if (node.content) pending.push(node.content);
  }
  return result;
}

// A real loopback SMTP conversation, with no SMTPUTF8 capability advertised.
async function smtpLoopback() {
  const transactions = [];
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffered = "";
    let recipients = [];
    let data = null;
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffered += chunk;
      let end;
      while ((end = buffered.indexOf("\r\n")) !== -1) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        if (data !== null) {
          if (line === ".") {
            transactions.push({
              recipients,
              raw: Buffer.from(data.join("\r\n")),
            });
            data = null;
            socket.write("250 queued\r\n");
          } else data.push(line.replace(/^\.\./, "."));
        } else if (line.startsWith("MAIL FROM:")) {
          assert.doesNotMatch(line, /SMTPUTF8/);
          recipients = [];
          socket.write("250 OK\r\n");
        } else if (line.startsWith("RCPT TO:")) {
          recipients.push(line.match(/<([^>]+)>/)[1]);
          socket.write("250 OK\r\n");
        } else if (line === "DATA") {
          data = [];
          socket.write("354 Send message\r\n");
        } else if (line === "QUIT") socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    transactions,
    environment: {
      SMTP_TLS_MODE: "disabled",
      SMTP_URL: `smtp://127.0.0.1:${server.address().port}`,
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

for (const transport of ["smtp", "ses", "archive", "cloudflare-email"]) {
  test(`${transport}: ASCII controls and Unicode MIME bind without changing originals or privacy`, async () => {
    const loopback =
      transport === "smtp" || transport === "cloudflare-email"
        ? await smtpLoopback()
        : null;
    const adapter = loopback
      ? createSmtpAdapter({
          environment: loopback.environment,
          now,
          provider: transport,
        })
      : null;
    try {
      // 128 emoji is current main's runtime ceiling; 256 exercises PR111's public
      // code-point ceiling too, without changing that separate validation issue.
      for (const label of [
        "abc",
        "logo@example.net",
        accent,
        emoji,
        `${accent}@example.net`,
        accent.repeat(256),
        emoji.repeat(128),
        emoji.repeat(256),
      ]) {
        const input = message([label]);
        const original = structuredClone(input);
        let raw;
        if (adapter) {
          await adapter.send({ ...input, provider: transport });
          const transaction = loopback.transactions.at(-1);
          assert.deepEqual(transaction.recipients, [
            "reader@example.net",
            "copy@example.org",
            "hidden@example.org",
          ]);
          raw = transaction.raw;
        } else if (transport === "archive")
          raw = await buildArchiveMimeMessage(input);
        else {
          let submitted;
          const ses = createAwsSesAdapter({
            now,
            configuration: {
              region: "us-east-1",
              scope: "organization",
              configurationSetName: "fixture-events",
              credentials: {
                kind: "access-key",
                credentials: {
                  accessKeyId: "fixture",
                  secretAccessKey: "fixture",
                },
              },
            },
            client: {
              async send(command) {
                submitted = command.input;
                return { MessageId: "fixture-ses-id" };
              },
            },
          });
          assert.deepEqual(await ses.send({ ...input, provider: "aws-ses" }), {
            providerMessageId: "fixture-ses-id",
          });
          assert.deepEqual(submitted.Destination.BccAddresses, [
            "hidden@example.org",
          ]);
          assert.deepEqual(submitted.EmailTags, [
            { Name: "paperboy_message_id", Value: input.id },
          ]);
          assert.equal(submitted.ConfigurationSetName, "fixture-events");
          raw = Buffer.from(submitted.Content.Raw.Data);
        }
        const parsed = await simpleParser(raw, { skipImageLinks: true });
        const attachment = parsed.attachments[0];
        if (/[^\x00-\x7f]/.test(label)) assertWire(attachment.cid);
        else assert.equal(attachment.cid, label);
        assert.deepEqual(attrs(parsed.html, "img", "src"), [
          `cid:${attachment.cid}`,
        ]);
        assert.match(
          (await simpleParser(raw)).html,
          /src="data:image\/png;base64,/,
        );
        assert.equal(attachment.contentDisposition, "inline");
        assert.equal(attachment.filename, "original.png");
        assert.equal(attachment.contentType, "image/png");
        assert.deepEqual(attachment.content, bytes);
        assert.equal(parsed.text.trim(), input.text);
        assert.equal(parsed.headers.get("x(test)"), "custom value");
        assert.doesNotMatch(raw.toString(), /^(?:DKIM-Signature|ARC-Seal):/im);
        assert.doesNotMatch(raw.toString(), /^Content-ID:.*=\?UTF-8/im);
        if (transport === "archive")
          assert.equal(parsed.bcc.value[0].address, "hidden@example.org");
        else {
          assert.equal(parsed.headers.has("bcc"), false);
          assert.doesNotMatch(raw.toString(), /hidden@example\.org/i);
          assert.equal(parsed.headers.get("x-paperboy-message-id"), input.id);
        }
        assert.deepEqual(structuredClone(input), original);
        const repeated = await parsedMime(input);
        assert.equal(repeated.parsed.attachments[0].cid, attachment.cid);
      }
    } finally {
      adapter?.close();
      await loopback?.close();
    }
  });
}

test("entity and percent-decoded CID URLs match exactly, with unchanged unrelated source", async () => {
  const html =
    `<!doctype html><!-- cid:${accent} -->\n<p title='cid:${accent}'>cid:${accent}</p>` +
    `<img DATA-note="cid:${accent}" SRC = 'CID:&#233;' alt='&copy;'>` +
    `<img src="cid:%C3%A9"><img src=cid:${accent}><a href=" cid:${accent} ">image</a>` +
    `<img src="cid:${accent}extra"><img src="https://example.net/cid:${accent}">` +
    `<img src="cid:%ZZ"><img src="cid:%25C3%25A9"><img src="cid:missing">` +
    `<script src="cid:${accent}">const x = '<img src="cid:${accent}">';</script>` +
    `<textarea><img src="cid:${accent}"></textarea>`;
  const { parsed } = await parsedMime(message([accent], html));
  const id = parsed.attachments[0].cid;
  assertWire(id);
  const expected = html
    .replace("CID:&#233;", `cid:${id}`)
    .replace("cid:%C3%A9", `cid:${id}`)
    .replace(`src=cid:${accent}`, `src=cid:${id}`)
    .replace(`href=" cid:${accent} "`, `href=" cid:${id} "`);
  assert.equal(parsed.html, expected);
});

test("SVG, picture/source/srcset and URL-bearing attributes retain binding and descriptors", async () => {
  const html =
    `<picture><source srcset="data:image/png;base64,AAAA 1x, cid:%C3%A9 2x">` +
    `<img srcset="cid:${accent} 100w, cid:missing 200w" src="cid:${accent}"></picture>` +
    `<svg><image xlink:href="cid:&#233;"/><use href="cid:${accent}"/>` +
    `<path fill="url(cid:${accent})" data-src="cid:${accent}"/></svg>` +
    `<video poster="cid:${accent}"><source src="cid:${accent}"></video>` +
    `<object data="cid:${accent}"></object><table background="cid:${accent}"></table>` +
    `<link imagesrcset="cid:${accent} 1x, cid:missing 2x">`;
  const { parsed } = await parsedMime(message([accent], html));
  const id = parsed.attachments[0].cid;
  assertWire(id);
  assert.deepEqual(attrs(parsed.html, "source", "srcset"), [
    `data:image/png;base64,AAAA 1x, cid:${id} 2x`,
  ]);
  assert.deepEqual(attrs(parsed.html, "img", "srcset"), [
    `cid:${id} 100w, cid:missing 200w`,
  ]);
  for (const [tag, attr] of [
    ["img", "src"],
    ["image", "xlink:href"],
    ["use", "href"],
    ["video", "poster"],
    ["source", "src"],
    ["object", "data"],
    ["table", "background"],
  ]) {
    assert.deepEqual(attrs(parsed.html, tag, attr), [`cid:${id}`]);
  }
  assert.deepEqual(attrs(parsed.html, "path", "fill"), [`url(cid:${id})`]);
  assert.deepEqual(attrs(parsed.html, "path", "data-src"), [`cid:${accent}`]);
  assert.deepEqual(attrs(parsed.html, "link", "imagesrcset"), [
    `cid:${id} 1x, cid:missing 2x`,
  ]);
});

test("CSS escapes, quoted URLs, entities and raw style blocks rewrite only URL tokens", async () => {
  const html =
    `<style>/* url(cid:${accent}) */ .image{background:U\\52L(c\\69 d:\\e9 );` +
    `mask:url('cid:%C3%A9');content:'cid:${accent}';--image:url(cid:${accent})}` +
    `.unmatched{background:url(https://example.net/cid:${accent})}</style>` +
    `<div style='background: url(&quot;cid:&#233;&quot;); content: &quot;don&#39;t &amp; stop&quot;; color: red'></div>` +
    `<div style=background:url(cid:${accent})></div>`;
  const { parsed } = await parsedMime(message([accent], html));
  const id = parsed.attachments[0].cid;
  assertWire(id);
  assert.ok(
    parsed.html.startsWith(
      `<style>/* url(cid:${accent}) */ .image{background:url(cid:${id});mask:url("cid:${id}");content:'cid:${accent}';--image:url(cid:${id})}`,
    ),
  );
  assert.ok(
    parsed.html.includes(
      `.unmatched{background:url(https://example.net/cid:${accent})}</style>`,
    ),
  );
  assert.deepEqual(attrs(parsed.html, "div", "style"), [
    `background: url("cid:${id}"); content: "don't & stop"; color: red`,
    `background:url(cid:${id})`,
  ]);
});

test("special label characters are URL-decoded once and changed attributes remain escaped", async () => {
  const label = `${accent}&'"%+/#?`;
  const encoded = encodeURIComponent(label).replaceAll("'", "%27");
  const { parsed } = await parsedMime(
    message(
      [label],
      `<img src='cid:${encoded}'><img src="cid:${accent}&amp;&#39;&quot;%25+/#?">` +
        `<source srcset='cid:${encoded} 1x, https://example.net/?a=1&amp;b=&quot;q&quot; 2x'>`,
    ),
  );
  const id = parsed.attachments[0].cid;
  assertWire(id);
  assert.deepEqual(attrs(parsed.html, "img", "src"), [
    `cid:${id}`,
    `cid:${id}`,
  ]);
  assert.deepEqual(attrs(parsed.html, "source", "srcset"), [
    `cid:${id} 1x, https://example.net/?a=1&b="q" 2x`,
  ]);
});

test("ASCII collisions, duplicates, reorderings and null labels preserve exact identity", async () => {
  const first = await parsedMime(message());
  const reserved = first.parsed.attachments[0].cid;
  assertWire(reserved);
  const labels = [accent, reserved, emoji, accent, null];
  const input = message(
    labels,
    `<img src="cid:${accent}"><img src="cid:${reserved}"><img src="cid:${emoji}">`,
  );
  const { parsed } = await parsedMime(input);
  const ids = parsed.attachments.map((attachment) => attachment.cid);
  assertWire(ids[0]);
  assert.notEqual(ids[0], reserved);
  assert.equal(ids[1], reserved);
  assert.notEqual(ids[0], ids[2]);
  assert.equal(ids[3], ids[0]);
  assert.equal(ids[4], undefined);
  assert.equal(parsed.attachments[4].contentDisposition, "attachment");
  assert.deepEqual(
    attrs(parsed.html, "img", "src"),
    ids.slice(0, 3).map((id) => `cid:${id}`),
  );
  const reordered = await parsedMime({
    ...input,
    attachments: [...input.attachments].reverse(),
  });
  // Nodemailer groups related inline parts before ordinary attachments.
  assert.deepEqual(
    reordered.parsed.attachments.map((attachment) => attachment.cid),
    [...ids.slice(0, 4).reverse(), undefined],
  );
  assert.equal(reordered.parsed.html, parsed.html);
  const secondCollision = await parsedMime(message([accent, reserved, ids[0]]));
  assert.ok(
    ![reserved, ids[0]].includes(secondCollision.parsed.attachments[0].cid),
  );
});

test("malformed and unmatched references remain intact, including invalid srcset and CSS", async () => {
  const html =
    `<img src="cid:%E9"><img src="cid:${accent}#unmatched">` +
    `<img srcset="cid:${accent} 1x 2x, cid:${accent} unknown(1,2), cid:missing 3x">` +
    `<div style="background:url('cid:${accent}')garbage;"></div>` +
    `<style>.x{background:url('cid:${accent}</style>` +
    `<img title="src=cid:${accent}"><!-- <img src='cid:${accent}'> -->`;
  const { parsed } = await parsedMime(message([accent], html));
  assertWire(parsed.attachments[0].cid);
  // The well-tokenized url() is still a URL token even in an invalid declaration.
  const expected = html
    .replace(
      `url('cid:${accent}')garbage`,
      `url("cid:${parsed.attachments[0].cid}")garbage`,
    )
    .replace(
      `style="background:url("cid:${parsed.attachments[0].cid}")garbage;"`,
      `style="background:url(&quot;cid:${parsed.attachments[0].cid}&quot;)garbage;"`,
    );
  assert.equal(parsed.html, expected);
});

test("ASCII-only composition keeps original labels and HTML", async () => {
  const asciiHtml = `<!-- original --> <img SRC = 'cid:logo@example.net'><style>a{content:'cid:logo@example.net'}</style>`;
  const ascii = message(["logo@example.net"], asciiHtml);
  assert.equal((await parsedMime(ascii)).parsed.html, asciiHtml);
});

test("Cloudflare structured compatibility and API idempotency retain original content", async () => {
  const input = message([accent]);
  Object.freeze(input.attachments[0]);
  Object.freeze(input.attachments);
  Object.freeze(input);
  const structured = prepareCloudflareEmailMessage(input);
  assert.equal(structured.html, input.html);
  assert.equal(structured.attachments[0].content_id, accent);
  assert.equal(structured.attachments[0].disposition, "inline");
  assertWire((await parsedMime(input)).parsed.attachments[0].cid);
  const parsed = parseSendEmailInput({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: [
      {
        content: bytes.toString("base64"),
        filename: "original.png",
        content_type: "image/png",
        content_id: accent,
      },
    ],
  });
  assert.equal(parsed.attachments[0].contentId, accent);
  assert.equal(parsed.html, input.html);
  const hash = emailRequestHash(parsed);
  await parsedMime(parsed);
  assert.equal(parsed.attachments[0].contentId, accent);
  assert.equal(parsed.html, input.html);
  assert.equal(emailRequestHash(parsed), hash);
});

test("exact Unicode identity, malformed UTF-16 and null HTML remain deterministic", async () => {
  const labels = [accent, "e\u0301", "\ud800", "\ud801", "\ufffd"];
  const html = labels.map((id) => `<img src="cid:${id}">`).join("");
  const { parsed } = await parsedMime(message(labels, html));
  const ids = parsed.attachments.map((attachment) => attachment.cid);
  ids.forEach(assertWire);
  assert.equal(new Set(ids).size, labels.length);
  assert.deepEqual(
    attrs(parsed.html, "img", "src"),
    ids.map((id) => `cid:${id}`),
  );
  const withoutHtml = await parsedMime(message([accent], null));
  assert.equal(withoutHtml.parsed.attachments[0].cid, ids[0]);
  assert.equal(withoutHtml.parsed.html, false);
});

test("HTML error recovery and malformed CSS preserve surrounding valid reference contexts", async () => {
  const html =
    `<constructor src="cid:${accent}" style="background:url(cid:${accent})"></constructor>` +
    `<img src="cid:${accent}" src="cid:unchanged"><p><b><i><img src="cid:${accent}"></b></i>` +
    `<style>.valid{background:url(cid:${accent})}.broken{background:url('cid:${accent}</style>` +
    `<style type="text/plain">background:url(cid:${accent})</style>` +
    `<img srcset="cid:${accent}, cid:${accent} 0x, cid:${accent} 1e1x, cid:${accent} -0x, cid:${accent} -1x, cid:${accent} 1h, cid:${accent} 2w 3h">`;
  const { parsed } = await parsedMime(message([accent], html));
  const id = parsed.attachments[0].cid;
  assertWire(id);
  assert.deepEqual(attrs(parsed.html, "constructor", "src"), [`cid:${accent}`]);
  assert.deepEqual(attrs(parsed.html, "constructor", "style"), [
    `background:url(cid:${id})`,
  ]);
  assert.ok(parsed.html.includes(`src="cid:${id}" src="cid:unchanged"`));
  assert.ok(
    parsed.html.includes(
      `<style>.valid{background:url(cid:${id})}.broken{background:url('cid:${accent}</style>`,
    ),
  );
  assert.ok(
    parsed.html.includes(
      `<style type="text/plain">background:url(cid:${accent})</style>`,
    ),
  );
  assert.deepEqual(attrs(parsed.html, "img", "srcset"), [
    `cid:${id}, cid:${id} 0x, cid:${id} 1e1x, cid:${id} -0x, cid:${accent} -1x, cid:${accent} 1h, cid:${id} 2w 3h`,
  ]);
});
