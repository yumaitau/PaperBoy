import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test("contact imports infer canonical CSV headers when optional mapping is omitted", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ and, eq }, { db }, { contacts, orgMembers, orgs, users }, { createContactImport }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/segments.ts"),
  ]);
  const orgId = randomUUID();
  const actorUserId = randomUUID();
  try {
    await db.insert(orgs).values({ id: orgId, name: "Default import mapping" });
    await db.insert(users).values({ id: actorUserId, name: "Admin", email: `${actorUserId}@example.net` });
    await db.insert(orgMembers).values({ orgId, userId: actorUserId, role: "admin" });
    const minimal = await createContactImport({ actorUserId, orgId, payload: { csv: "email\nada@example.net\n" } });
    assert.equal(minimal.status, "completed");
    assert.equal(minimal.createdRows, 1);
    await createContactImport({ actorUserId, orgId, payload: {
      csv: " Email ,First_Name,last_name\nada@example.net,Ada,Lovelace\n",
      on_conflict: "upsert",
    } });
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.email, "ada@example.net")));
    assert.equal(contact.firstName, "Ada");
    assert.equal(contact.lastName, "Lovelace");
    await createContactImport({ actorUserId, orgId, payload: {
      csv: "email\nada@example.net\n", on_conflict: "upsert",
    } });
    const [preserved] = await db.select().from(contacts).where(eq(contacts.id, contact.id));
    assert.equal(preserved.firstName, "Ada");
    assert.equal(preserved.lastName, "Lovelace");
    const explicit = await createContactImport({ actorUserId, orgId, payload: {
      csv: "Address\ngrace@example.net\n", column_map: { email: "Address" },
    } });
    assert.equal(explicit.createdRows, 1);
    await assert.rejects(createContactImport({ actorUserId, orgId, payload: { csv: "name\nAda\n" } }), { code: "VALIDATION_ERROR" });
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await db.delete(users).where(eq(users.id, actorUserId));
  }
});
