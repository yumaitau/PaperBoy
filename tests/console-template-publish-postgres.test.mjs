import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test("console templates can be created, published, and scheduled for a broadcast", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { orgMembers, orgs, users }, templates, authorization, templateCore, audiences, { createBroadcast }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/templates.ts"),
    import("../src/lib/authorization.ts"), import("../src/lib/template-core.ts"), import("../src/lib/audiences.ts"), import("../src/lib/broadcasts.ts"),
  ]);
  const orgId = randomUUID();
  const actorUserId = randomUUID();
  class Redirect extends Error {}
  const modules = {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Redirect(path); } },
    "@/lib/authorization": authorization,
    "@/lib/session": { requireOrganization: async () => ({ organization: { id: orgId }, session: { user: { id: actorUserId } } }) },
    "@/lib/template-core": templateCore,
    "@/lib/templates": templates,
  };
  const { outputText } = ts.transpileModule(readFileSync(new URL("../src/app/app/templates/actions.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const actions = {};
  new Function("require", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected import ${name}`);
    return modules[name];
  }, actions);
  try {
    await db.insert(orgs).values({ id: orgId, name: "Console template publish" });
    await db.insert(users).values({ id: actorUserId, name: "Admin", email: `${actorUserId}@example.net` });
    await db.insert(orgMembers).values({ orgId, userId: actorUserId, role: "admin" });
    const form = new FormData();
    form.set("name", "Console newsletter");
    form.set("subject", "Hello readers");
    form.set("text", "Newsletter content");
    await assert.rejects(actions.createTemplateAction(form), { message: "/app/templates?saved=created" });
    const [template] = await templates.listTemplates({ actorUserId, orgId });
    assert.equal(template.status, "draft");
    const audience = await audiences.createAudience({ actorUserId, orgId, payload: { name: "Readers" } });
    await audiences.createContact({ actorUserId, orgId, audienceId: audience.id, payload: { email: "reader@example.net" } });
    const input = {
      principal: { actorUserId, apiKeyId: null, orgId, environment: "test", scopes: null },
      payload: { name: "Newsletter", audience_id: audience.id, template_id: template.id, from: "sender@example.net", scheduled_for: "2030-01-01T00:00:00.000Z" },
    };
    const dependencies = { unsubscribeUrl: (id) => `https://paperboy.test/unsubscribe?contact=${id}` };
    await assert.rejects(createBroadcast(input, dependencies), { code: "TEMPLATE_NOT_PUBLISHED" });
    const publishForm = new FormData();
    publishForm.set("templateId", template.id);
    await assert.rejects(actions.publishTemplateAction(publishForm), { message: "/app/templates?saved=published" });
    const published = await templates.getTemplate({ actorUserId, orgId, templateId: template.id });
    assert.equal(published.status, "published");
    const broadcast = await createBroadcast(input, dependencies);
    assert.equal(broadcast.status, "scheduled");
    assert.equal(broadcast.progress.total, 1);
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await db.delete(users).where(eq(users.id, actorUserId));
  }
});
