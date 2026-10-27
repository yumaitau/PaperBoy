import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

// Render the production JSX without loading the drawer's authenticated server action.
const source = ts.createSourceFile(
  "message-log-table.tsx",
  readFileSync(
    new URL("../src/app/app/logs/message-log-table.tsx", import.meta.url),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let section;
let byteSize;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "byteSize") {
    byteSize = node;
  }
  if (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(source) === "section" &&
    node.children.some((child) => child.getText(source) === "<h3>Attachments</h3>")
  ) {
    section = node;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(section, "message drawer attachment section exists");
assert.ok(byteSize, "attachment size formatter exists");
const { outputText } = ts.transpileModule(
  `${byteSize.getText(source)}
   export function Attachments({ attachments }) {
     const result = { message: { attachments } };
     return (${section.getText(source)});
   }`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
);
const exports = {};
new Function("exports", "require", outputText)(exports, (name) => {
  assert.equal(name, "react/jsx-runtime");
  return jsxRuntime;
});
function renderAttachments(attachments) {
  return renderToStaticMarkup(jsxRuntime.jsx(exports.Attachments, { attachments }));
}

test("message details show inline CIDs and preserve ordinary attachment metadata", () => {
  const markup = renderAttachments([
    { id: "inline", filename: "logo.png", contentType: "image/png", size: 2048, contentId: "logo@example.test" },
    { id: "download", filename: "report.pdf", contentType: "application/pdf", size: 512, contentId: null },
  ]);

  assert.match(markup, /<h3>Attachments<\/h3>/);
  const rows = markup.match(/<li>.*?<\/li>/g);
  assert.equal(rows?.length, 2);
  assert.match(rows[0], /<span>logo\.png<\/span>/);
  assert.match(rows[0], /image\/png · 2\.0 KiB/);
  assert.match(rows[0], /CID: <code[^>]*>logo@example\.test<\/code>/);
  assert.equal(rows[1], "<li><span>report.pdf</span><small>application/pdf · 512 B</small></li>");
});

test("message details render CID values as escaped text", () => {
  const markup = renderAttachments([
    { id: "inline", filename: "logo.png", contentType: "image/png", size: 10, contentId: 'logo&"quote\'@example.test' },
  ]);

  assert.match(markup, /CID: <code[^>]*>logo&amp;&quot;quote&#x27;@example\.test<\/code>/);
  assert.doesNotMatch(markup, /href=|src=/);
});

test("message details keep the empty attachment state", () => {
  const markup = renderAttachments([]);

  assert.match(markup, /<h3>Attachments<\/h3><p>None\.<\/p>/);
  assert.doesNotMatch(markup, /<li>|CID:/);
});
