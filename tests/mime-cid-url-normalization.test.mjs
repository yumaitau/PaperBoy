import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "parse5";
import {
  mimeContentIds,
  rewriteMimeCidReferences,
} from "../src/lib/mime-content-ids.ts";

function imageUrl(html) {
  const pending = [parse(html)];
  while (pending.length) {
    const node = pending.pop();
    if (node.tagName === "img")
      return node.attrs.find((attr) => attr.name === "src")?.value;
    pending.push(...(node.childNodes ?? []));
  }
  assert.fail("Missing image");
}

test("URL edge preprocessing trims every representable C0/space and no Unicode whitespace", () => {
  const mapping = mimeContentIds(["é"]);
  const wireUrl = `cid:${mapping.get("é")}`;
  for (let code = 1; code <= 0x20; code++) {
    const edge = String.fromCharCode(code);
    const html = `<img src="${edge}CiD:%C3%A9${edge}">`;
    const rewritten = rewriteMimeCidReferences(html, mapping);
    // The URL implementation independently checks preprocessing, including
    // outer HTML whitespace that rewriteUrl deliberately keeps in the source.
    assert.equal(new URL(imageUrl(rewritten)).href, wireUrl, `U+${code.toString(16)}`);
    const css = `<style>url("\\${code.toString(16)} CiD:%C3%A9\\${code.toString(16)} ")</style>`;
    assert.equal(rewriteMimeCidReferences(css, mapping), `<style>url("${wireUrl}")</style>`);
  }
  // HTML/CSS parsing replaces NUL before mappedUrl sees it; it must not bind.
  for (const edge of ["\0", "\x7f", "\u00a0", "\u1680", "\u2003", "\u2028", "\u2029", "\u3000", "\ufeff"]) {
    for (const url of [`${edge}cid:é`, `cid:é${edge}`]) {
      const html = `<img src="${url}">`;
      assert.equal(rewriteMimeCidReferences(html, mapping), html);
    }
  }
});

test("only raw internal TAB/LF/CR disappear; other C0/space stays part of the CID", () => {
  for (let code = 1; code <= 0x20; code++) {
    const char = String.fromCharCode(code);
    const label = `é${char}z`;
    const mapping = mimeContentIds([label, "éz"]);
    const expectedLabel = [0x09, 0x0a, 0x0d].includes(code) ? "éz" : label;
    const html = `<img src="cid:é${char}z">`;
    assert.equal(
      imageUrl(rewriteMimeCidReferences(html, mapping)),
      `cid:${mapping.get(expectedLabel)}`,
      `U+${code.toString(16)}`,
    );
  }
});

test("percent-encoded edge controls decode after trimming and keep exact label identity", () => {
  for (let code = 0; code <= 0x20; code++) {
    const char = String.fromCharCode(code);
    const label = `${char}é${char}`;
    const mapping = mimeContentIds([label, "é"]);
    const html = `<img src="cid:${encodeURIComponent(label)}">`;
    assert.equal(
      imageUrl(rewriteMimeCidReferences(html, mapping)),
      `cid:${mapping.get(label)}`,
      `U+${code.toString(16)}`,
    );
  }
});

test("empty and all-C0 URL values remain unchanged beside a matching reference", () => {
  const mapping = mimeContentIds(["é"]);
  const matching = '<img src="cid:é">';
  const replacement = `<img src="cid:${mapping.get("é")}">`;
  for (const value of ["", " ", "\x01", "\t\n\r\x0b\x1f "]) {
    const html = `<a href="${value}">link</a>`;
    assert.equal(rewriteMimeCidReferences(html + matching, mapping), html + replacement);
  }
  const css = '<style>url("") url("\\1 \\20 ")</style>';
  assert.equal(rewriteMimeCidReferences(css + matching, mapping), css + replacement);
});

test("large internal whitespace URL runs complete within a bounded child process", { timeout: 15_000 }, () => {
  // A child with a hard timeout protects the runner if synchronous regex
  // backtracking returns. The broad budget avoids relying on timing ratios.
  const moduleUrl = new URL("../src/lib/mime-content-ids.ts", import.meta.url).href;
  const script = `
    import assert from "node:assert/strict";
    import { mimeContentIds, rewriteMimeCidReferences } from ${JSON.stringify(moduleUrl)};
    const mapping = mimeContentIds(["é"]);
    const spaces = " ".repeat(500_000);
    const controls = "\\x01".repeat(500_000);
    const fixtures = [
      '<a href="x' + spaces + 'y">link</a>',
      '<style>.x{background:url("x' + spaces + 'y")}</style>',
      '<svg><style><![CDATA[.x{fill:url("x' + spaces + 'y")}]]></style></svg>',
      '<img srcset="x' + controls + 'y 1x">',
    ];
    const matching = '<noscript><img src="cid:%C3%A9"></noscript>';
    const replacement = '<noscript><img src="cid:' + mapping.get("é") + '"></noscript>';
    for (const html of fixtures) {
      // Preserve every unmatched byte while still rewriting a real reference.
      assert.equal(rewriteMimeCidReferences(html + matching, mapping), html + replacement);
      assert.equal(rewriteMimeCidReferences(html + matching, mimeContentIds(["ascii"])), html + matching);
    }
    const padded = '<style>url("' + controls + 'cid:%C3%A9' + controls + '")</style>';
    assert.equal(rewriteMimeCidReferences(padded, mapping), '<style>url("cid:' + mapping.get("é") + '")</style>');
    console.log("checked five bounded URL fixtures");
  `;
  const result = spawnSync(process.execPath, ["--no-env-file", "--eval", script], {
    env: {},
    encoding: "utf8",
    timeout: 8_000,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined, `URL preprocessing child failed: ${result.error?.message}`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "checked five bounded URL fixtures");
});
