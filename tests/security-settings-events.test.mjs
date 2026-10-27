import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise the actual handlers with React's event lifetime: currentTarget is
// cleared after dispatch, before an asynchronous auth request completes.
const source = ts.createSourceFile(
  "security-settings.tsx",
  readFileSync(new URL("../src/app/app/settings/security-settings.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function handler(name, bindings) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration, `Missing ${name} handler`);
  const { outputText } = ts.transpileModule(declaration.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  });
  return new Function(...Object.keys(bindings), `${outputText}; return ${name};`)(...Object.values(bindings));
}

for (const name of ["changePassword", "addPasskey"]) {
  test(`${name} completes after React clears currentTarget`, async () => {
    let finish;
    const request = new Promise((resolve) => { finish = resolve; });
    let pending = false;
    let resets = 0;
    let status;
    let passkeys = [];
    const form = { reset() { resets += 1; } };
    const fields = new Map([
      ["currentPassword", "old-password"],
      ["newPassword", "new-password"],
      ["confirmPassword", "new-password"],
      ["name", "Work laptop"],
    ]);
    const submit = handler(name, {
      authClient: { changePassword: () => request, passkey: { addPasskey: () => request } },
      begin() { pending = true; },
      setError(message) { assert.fail(message); },
      setIsPending(value) { pending = value; },
      setStatus(value) { status = value; },
      setPasskeys(update) { passkeys = update(passkeys); },
      FormData: class {
        constructor(element) { assert.equal(element, form); }
        get(key) { return fields.get(key); }
      },
    });
    const event = { preventDefault() {}, currentTarget: form };
    const completed = submit(event);
    assert.equal(pending, true);
    event.currentTarget = null;
    const passkey = { id: "new-passkey", name: "Work laptop" };
    finish({ error: null, data: passkey });
    await completed;
    assert.equal(resets, 1);
    assert.equal(pending, false);
    assert.match(status, name === "changePassword" ? /Password changed/ : /Passkey added/);
    if (name === "addPasskey") assert.deepEqual(passkeys, [passkey]);
  });
}
