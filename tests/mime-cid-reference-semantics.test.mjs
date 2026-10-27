import assert from "node:assert/strict";
import test from "node:test";
import { simpleParser } from "mailparser";
import { parse } from "parse5";
import {
  isTokenFunction,
  isTokenString,
  isTokenURL,
  isTokenWhiteSpaceOrComment,
  tokenize,
} from "@csstools/css-tokenizer";
import { buildSmtpMimeMessage } from "../src/lib/email-delivery.ts";
import {
  mimeContentIds,
  rewriteMimeCidReferences,
} from "../src/lib/mime-content-ids.ts";

const bytes = Buffer.from("semantic CSS fixture");
/**
 * Compose one non-ASCII inline-label fixture without contacting a transport.
 * Keep CID links visible during MIME parsing, assert wire-ID shape, attachment
 * bytes, and input immutability, then return MIME HTML and the direct rewrite
 * separately so tests can compare semantic output with source preservation
 * even when MIME parsing normalizes line endings.
 */
async function composed(html, label = "é") {
  const input = {
    attachments: [
      {
        content: bytes,
        contentId: label,
        contentType: "image/png",
        filename: "logo.png",
      },
    ],
    from: "from@example.org",
    to: ["to@example.net"],
    subject: "Semantic CID",
    html,
    text: null,
  };
  const original = structuredClone(input);
  const raw = await buildSmtpMimeMessage(input);
  const mime = await simpleParser(raw, { skipImageLinks: true });
  const id = mime.attachments[0].cid;
  assert.match(id, /^pb-[a-f0-9]{64}@cid\.paperboy\.invalid$/);
  assert.deepEqual(mime.attachments[0].content, bytes);
  assert.deepEqual(structuredClone(input), original);
  const rewritten = rewriteMimeCidReferences(html, mimeContentIds([label]));
  return { html: mime.html, rewritten, id };
}
/**
 * Collect direct text values from style elements in parse5's default HTML tree.
 * This inspects parsed CSS (including foreign-content entity/CDATA handling),
 * not raw markup; separate style elements are joined with a newline.
 */
function styleText(html) {
  const css = [];
  /** Visit childNodes recursively; template content is outside these fixtures. */
  function visit(node) {
    if (node.tagName === "style")
      css.push(node.childNodes.map((child) => child.value ?? "").join(""));
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parse(html));
  return css.join("\n");
}
/**
 * Read decoded URL-token and quoted url() values in token order for assertions.
 * This fixture inspector skips trivia before strings but does not validate
 * closing parentheses or parse errors; it is not the production URL validator.
 */
function urls(css) {
  const tokens = tokenize({ css });
  const values = [];
  tokens.forEach((token, index) => {
    if (isTokenURL(token)) values.push(token[4].value);
    if (isTokenFunction(token) && token[4].value.toLowerCase() === "url") {
      while (isTokenWhiteSpaceOrComment(tokens[++index])) {
        /* skip CSS trivia */
      }
      if (isTokenString(tokens[index])) values.push(tokens[index][4].value);
    }
  });
  return values;
}
/** Embed raw CSS fixture markup in foreign style content without escaping it. */
const svg = (css) => `<svg><style>${css}</style></svg>`;

for (const [name, source, expected, label = "é"] of [
  ["numeric entity", ".x{fill:url(cid:&#233;)}", ".x{fill:url(cid:WIRE)}"],
  ["hex entity", ".x{fill:url(cid:&#xE9;)}", ".x{fill:url(cid:WIRE)}"],
  [
    "named entity without semicolon",
    ".x{fill:url(cid:&eacute)}",
    ".x{fill:url(cid:WIRE)}",
  ],
  [
    "CSS escapes and entities",
    String.raw`.x{fill:u&#114;l(c&#92;69 d:\e9 )}`,
    ".x{fill:url(cid:WIRE)}",
  ],
  [
    "quoted entity URL with normalized whitespace",
    ".x{fill:url(&quot; c&#9;id:%C3%A9 &quot;)}",
    '.x{fill:url("cid:WIRE")}',
  ],
  [
    "CDATA interior",
    ".x{fill:url(ci<![CDATA[d:é]]>)}",
    ".x{fill:url(cid:WIRE)<![CDATA[]]>}",
  ],
  [
    "CDATA contains complete URL",
    "<![CDATA[.x{fill:url(cid:é)}]]>",
    "<![CDATA[.x{fill:url(cid:WIRE)}]]>",
  ],
  [
    "mixed CDATA and entity",
    "<![CDATA[.x{fill:url(ci]]>d:&#233;<![CDATA[)}]]>",
    "<![CDATA[.x{fill:url(cid:WIRE)]]><![CDATA[}]]>",
  ],
  [
    "HTML comment between text nodes",
    "ur<!-- retain -->l(cid:&#233;)",
    "url(cid:WIRE)<!-- retain -->",
  ],
  ["ignored end tag", "u</unknown>rl(cid:&#233;)", "url(cid:WIRE)</unknown>"],
  [
    "nested foreign element",
    "url(cid:&#233;)<g>keep cid:é</g>",
    "url(cid:WIRE)<g>keep cid:é</g>",
  ],
  ["multi-codepoint entity", "url(cid:é&fjlig;)", "url(cid:WIRE)", "éfj"],
  ["astral entity", "url(cid:&#128512;)", "url(cid:WIRE)", "😀"],
  [
    "CRLF outside URL",
    "/* unchanged\r\n */url(cid:&#233;)\r\n",
    "/* unchanged\r\n */url(cid:WIRE)\r\n",
  ],
]) {
  test(`foreign CSS maps source spans: ${name}`, async () => {
    const result = await composed(svg(source), label);
    const expectedHtml = svg(expected.replaceAll("WIRE", result.id));
    assert.equal(result.rewritten, expectedHtml);
    // Mailparser normalizes MIME HTML line endings; source preservation is
    // checked independently before that transport/parser boundary above.
    assert.equal(result.html, expectedHtml.replaceAll("\r\n", "\n"));
    assert.deepEqual(urls(styleText(result.html)), [`cid:${result.id}`]);
  });
}

test("CDATA boundaries at every CSS URL offset preserve semantic binding and delimiters", async () => {
  for (const css of [
    "url(cid:é)",
    'url("cid:%C3%A9")',
    String.raw`u\72l(c\69 d:\e9 )`,
  ]) {
    for (let start = 0; start <= css.length; start++) {
      for (let end = start; end <= css.length; end++) {
        const source = `${css.slice(0, start)}<![CDATA[${css.slice(start, end)}]]>${css.slice(end)}`;
        const result = await composed(svg(source));
        assert.deepEqual(
          urls(styleText(result.html)),
          [`cid:${result.id}`],
          source,
        );
        assert.equal(
          (result.html.match(/<!\[CDATA\[/g) ?? []).length,
          1,
          source,
        );
        assert.equal((result.html.match(/\]\]>/g) ?? []).length, 1, source);
      }
    }
  }
});

test("foreign strings/comments and unrelated raw source survive an adjacent real URL edit", async () => {
  const untouched =
    ".a{content:&quot;url(cid:é)&quot;}&#47;* url(cid:é) */" +
    ".b{fill:url(https://example.org/?x=1&amp;y=2)}" +
    "<![CDATA[.c{fill:url(cid:&#233;)}]]>" +
    ".d{fill:url(cid:missing);content:&apos;url(cid:é)&apos;}";
  const html = svg(untouched + ".real{fill:url(cid:&#233;)}");
  const result = await composed(html);
  assert.equal(
    result.html,
    svg(untouched + `.real{fill:url(cid:${result.id})}`),
  );
});

test("HTML raw-text style keeps literal entities while foreign CSS decodes them", async () => {
  const htmlStyle =
    '<style>.a{fill:url(cid:&#233;);content:"url(cid:é)"}/*url(cid:é)*/</style>';
  const result = await composed(htmlStyle + svg("url(cid:&#233;)"));
  assert.equal(result.html, htmlStyle + svg(`url(cid:${result.id})`));
});

for (const [name, url] of [
  ["spaces", " cid:%C3%A9 "],
  ["edge C0", "\x01\x0b\x1fcid:%C3%A9\x02\x0c\x20"],
  ["embedded TAB LF CR", "c\ti\nd\r:%C3%\tA9"],
]) {
  test(`URL input preprocessing in HTML attributes: ${name}`, async () => {
    assert.equal(new URL(url).href, "cid:%C3%A9");
    const result = await composed(`<img src="${url}">`);
    const node = parse(result.html)
      .childNodes.find((n) => n.tagName === "html")
      .childNodes.find((n) => n.tagName === "body").childNodes[0];
    assert.equal(new URL(node.attrs[0].value).href, `cid:${result.id}`);
  });
}

for (const css of [
  'url(" cid:%C3%A9 ")',
  String.raw`url("\1 \b cid:%C3%A9\1f ")`,
  String.raw`url("c\9 i\a d\d :%C3%\9 A9")`,
  String.raw`url("cid:\
%C3%A9")`,
]) {
  test(`URL input preprocessing after CSS escapes: ${JSON.stringify(css)}`, async () => {
    assert.equal(new URL(urls(css)[0]).href, "cid:%C3%A9");
    const result = await composed(`<style>.x{background:${css}}</style>`);
    assert.deepEqual(urls(styleText(result.html)), [`cid:${result.id}`]);
  });
}

test("shared URL preprocessing covers decoded attributes, srcset and SVG presentation URLs", async () => {
  const html =
    '<div style="background:url(&quot; c&#9;id:%C3%A9 &quot;)"></div>' +
    '<img srcset="&#1;cid:%C3%A9&#2; 1x, https://example.org/a?x=1&amp;y=2 2x">' +
    '<svg><use href="c&#10;id:%C3%A9"/><path fill="url(&quot; cid:%C3%A9 &quot;)"/></svg>';
  const result = await composed(html);
  assert.equal(
    (result.html.match(new RegExp(`cid:${result.id}`, "g")) ?? []).length,
    4,
  );
  assert.ok(result.html.includes("https://example.org/a?x=1&amp;y=2 2x"));
});

test("unmatched URL syntax remains byte-for-byte intact", async () => {
  const inputs = [
    " cid:missing ",
    " https://example.org/cid:%C3%A9 ",
    "cid:%25C3%25A9",
    "cid:%E9",
    "cid:é+",
    "cid:e\u0301",
    "\u00a0cid:é",
    "cid:é\u200b",
    "cid:%0A%C3%A9",
    "cid:é%20",
    "cid:\x0bé",
    "cid:\x0cé",
    "cid:é\x7f",
    "cid:É",
  ];
  for (const value of inputs) {
    const html = `<img src="${value}">`;
    assert.equal((await composed(html)).html, html, JSON.stringify(value));
  }
  const css =
    '.x{fill:url(" cid:missing ");mask:url("https://example.org/cid:é");content:"url(cid:é)"}';
  assert.equal((await composed(svg(css))).html, svg(css));
});

test("percent decoding stays once-only, plus stays literal and Unicode identity stays exact", async () => {
  for (const label of ["é+", "e\u0301", "é%20", "😀".repeat(256)]) {
    const html = `<style>url(" cid:${encodeURIComponent(label)} ")</style>`;
    const result = await composed(html, label);
    assert.deepEqual(urls(styleText(result.html)), [`cid:${result.id}`]);
  }
});
