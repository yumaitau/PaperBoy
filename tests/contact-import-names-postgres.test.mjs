import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test("contact imports preserve unmapped names and apply explicitly mapped values", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { contacts, orgMembers, orgs, users }, { createContactImport }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/segments.ts"),
  ]);
  const orgId = randomUUID();
  const actorUserId = randomUUID();
  const contactId = randomUUID();
  try {
    await db.insert(orgs).values({ id: orgId, name: "Import name regression" });
    await db.insert(users).values({ id: actorUserId, name: "Admin", email: `${actorUserId}@example.net` });
    await db.insert(orgMembers).values({ orgId, userId: actorUserId, role: "admin" });
    await db.insert(contacts).values({ id: contactId, orgId, email: "ada@example.net", firstName: "Ada", lastName: "Lovelace" });
    const readNames = async () => (await db.select({ first: contacts.firstName, last: contacts.lastName }).from(contacts).where(eq(contacts.id, contactId)))[0];
    await createContactImport({ actorUserId, orgId, payload: {
      csv: "email\nada@example.net\n",
      column_map: { email: "email" },
      on_conflict: "upsert",
    } });
    assert.deepEqual(await readNames(), { first: "Ada", last: "Lovelace" });
    await createContactImport({ actorUserId, orgId, payload: {
      csv: "email,given\nada@example.net,Augusta\n",
      column_map: { email: "email", first_name: "given" },
      on_conflict: "upsert",
    } });
    assert.deepEqual(await readNames(), { first: "Augusta", last: "Lovelace" });
    await createContactImport({ actorUserId, orgId, payload: {
      csv: "email,surname\nada@example.net,\n",
      column_map: { email: "email", last_name: "surname" },
      on_conflict: "upsert",
    } });
    assert.deepEqual(await readNames(), { first: "Augusta", last: null });
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await db.delete(users).where(eq(users.id, actorUserId));
  }
});
