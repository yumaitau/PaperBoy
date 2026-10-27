import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test("repeated template duplication retries names without aborting its transaction", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { orgMembers, orgs, users }, { createTemplate, duplicateTemplate }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/templates.ts"),
  ]);
  const orgId = randomUUID();
  const actorUserId = randomUUID();
  try {
    await db.insert(orgs).values({ id: orgId, name: "Template copy regression" });
    await db.insert(users).values({ id: actorUserId, name: "Admin", email: `${actorUserId}@example.net` });
    await db.insert(orgMembers).values({ orgId, userId: actorUserId, role: "admin" });
    const source = await createTemplate({ actorUserId, orgId, payload: { name: "Welcome", subject: "Hello", text: "Welcome reader" } });
    for (let index = 1; index <= 10; index += 1) {
      const copy = await duplicateTemplate({ actorUserId, orgId, templateId: source.id });
      assert.equal(copy.name, index === 1 ? "Copy of Welcome" : `Copy ${index} of Welcome`);
      assert.equal(copy.text, source.text);
      assert.equal(copy.status, "draft");
    }
    await assert.rejects(duplicateTemplate({ actorUserId, orgId, templateId: source.id }), { code: "TEMPLATE_EXISTS" });
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await db.delete(users).where(eq(users.id, actorUserId));
  }
});
