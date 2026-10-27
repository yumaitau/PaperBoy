import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/app/api/v1/contacts/[contactId]/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);

test("contact routes preserve parameters already decoded by Next.js", async () => {
  const received = [];
  const handle = async (request, contactId) => {
    received.push({ method: request.method, contactId });
    return new Response(null, { status: 204 });
  };
  const modules = {
    "@/lib/api-key-request": { authenticateApiRequest: async () => null },
    "@/lib/request-logs": { withApiLog: (request, dependencies, run) => run(dependencies) },
    "@/lib/segment-http": {
      segmentApiServices: {},
      handleGetContactRequest: handle,
      handleUpdateContactRequest: handle,
      handleDeleteContactRequest: handle,
    },
  };
  const routes = {};
  new Function("require", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected import ${name}`);
    return modules[name];
  }, routes);

  for (const method of ["GET", "PATCH", "DELETE"]) {
    for (const contactId of ["reader%2btag@example.net", "reader+tag@example.net", "reader%tag@example.net"]) {
      const response = await routes[method](
        new Request(`https://paperboy.test/api/v1/contacts/${encodeURIComponent(contactId)}`, { method }),
        { params: Promise.resolve({ contactId }) },
      );
      assert.equal(response.status, 204);
      assert.deepEqual(received.at(-1), { method, contactId });
    }
  }
});
