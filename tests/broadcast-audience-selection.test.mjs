import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

function sourceAt(path) {
  return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(source, predicate) {
  let found;
  function visit(node) { if (predicate(node)) found = node; ts.forEachChild(node, visit); }
  visit(source);
  assert.ok(found);
  return found;
}
function load(code, bindings) {
  const { outputText } = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  new Function("exports", "require", ...Object.keys(bindings), outputText)(exports, (name) => {
    assert.equal(name, "react/jsx-runtime");
    return jsxRuntime;
  }, ...Object.values(bindings));
  return exports;
}

test("deleted broadcast audiences keep an explicit selected snapshot option", () => {
  const source = sourceAt("../src/components/broadcasts/broadcast-preview-workspace.tsx");
  const select = find(source, (node) => ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "select" && node.openingElement.attributes.getText(source).includes('id="broadcast-edit-audience"'));
  const { Selection } = load(`export function Selection() { return (${select.getText(source)}); }`, {
    sourceAudienceId: null,
    audiences: [{ id: "unrelated-audience", name: "Other readers", activeContactCount: 3 }],
  });
  const markup = renderToStaticMarkup(jsxRuntime.jsx(Selection, {}));
  assert.match(markup, /<option value="" selected="">Keep current recipients<\/option>/);
  assert.doesNotMatch(markup, /<select[^>]*required/);
});

test("broadcast edits omit an unselected audience but preserve explicit replacements", async () => {
  const source = sourceAt("../src/app/app/broadcasts/actions.ts");
  const action = find(source, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "updateBroadcastAction");
  const updates = [];
  class Redirect extends Error {}
  const { updateBroadcastAction } = load(action.getText(source), {
    requireOrganization: async () => ({ organization: { id: "org" }, session: { user: { id: "user", timezone: "UTC" } } }),
    parseNaturalLanguageSchedule: () => ({ date: new Date("2030-01-01T00:00:00Z") }),
    updateScheduledBroadcast: async (input) => { updates.push(input); },
    revalidatePath() {},
    redirect() { throw new Redirect(); },
    errorCode(error) { throw error; },
  });
  for (const selected of ["", "replacement-audience"]) {
    const form = new FormData();
    form.set("broadcastId", "broadcast");
    form.set("audienceId", selected);
    form.set("subject", "Updated subject");
    await assert.rejects(updateBroadcastAction(form), Redirect);
    const payload = updates.at(-1).payload;
    assert.equal(Object.hasOwn(payload, "audience_id"), Boolean(selected));
    if (selected) assert.equal(payload.audience_id, selected);
  }
});
