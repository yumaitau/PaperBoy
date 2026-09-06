import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { API_GUIDES, allGuideTags, guideCurl } from "../src/lib/api-guides.ts";
import { parseOpenApiDocument } from "../src/lib/openapi-document.ts";

async function document() {
  const source = await readFile(
    new URL("../openapi.yaml", import.meta.url),
    "utf8",
  );
  return parseOpenApiDocument(source);
}

test("every API tag has a product guide", async () => {
  const { operations } = await document();
  const tags = [...new Set(operations.map((operation) => operation.tag))];
  const covered = new Set(allGuideTags());

  assert.ok(tags.length > 10);
  for (const tag of tags) {
    assert.ok(
      covered.has(tag),
      `OpenAPI tag without a product guide: ${tag}`,
    );
  }
});

test("every guide example matches a real operation", async () => {
  const { operations } = await document();
  const byId = new Map(
    operations.map((operation) => [operation.operationId, operation]),
  );
  const slugs = new Set();

  assert.ok(API_GUIDES.length >= 8);
  for (const guide of API_GUIDES) {
    assert.ok(guide.slug.length > 0);
    assert.ok(!slugs.has(guide.slug), `duplicate guide slug: ${guide.slug}`);
    slugs.add(guide.slug);
    assert.ok(guide.title.length > 0);
    assert.ok(guide.body.length > 50);
    assert.ok(guide.tags.length > 0);
    assert.ok(guide.examples.length > 0);

    for (const example of guide.examples) {
      const operation = byId.get(example.operationId);
      assert.ok(operation, `unknown operationId: ${example.operationId}`);
      assert.equal(example.method, operation.method);
      const specPath = operation.path.replace(/\{[^}]+\}/g, "{}");
      const examplePath = example.path
        .split("?")[0]
        .replace(/\{[^}]+\}/g, "{}");
      assert.equal(examplePath, specPath);

      if (example.body !== undefined) {
        assert.doesNotThrow(
          () => JSON.parse(example.body),
          `invalid example JSON: ${example.operationId}`,
        );
      }
      if (example.response !== undefined) {
        assert.doesNotThrow(
          () => JSON.parse(example.response),
          `invalid response JSON: ${example.operationId}`,
        );
      }

      const snippet = guideCurl(example);
      assert.match(snippet, new RegExp(`^curl -X ${example.method} `));
      assert.match(snippet, /Authorization: Bearer/);
      assert.ok(snippet.includes(example.path));
    }
  }
});

test("guides render from the docs page", async () => {
  const [page, component] = await Promise.all([
    readFile(new URL("../src/app/app/docs/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/components/docs/api-guides.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /ApiGuides/);
  assert.match(page, /OpenApiReference/);
  assert.match(component, /API_GUIDES/);
  assert.match(component, /guideCurl/);
});
