import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { mock } from "bun:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test(
  "revoked API key deletion enforces permissions, waits for broadcasts, and removes the key",
  { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured" },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    mock.module("server-only", () => ({}));
    const [
      { eq },
      { db },
      { apiKeyAuditEvents, apiKeys, broadcasts, orgMembers, orgs, users },
      { authenticateApiKey, createApiKey, deleteApiKey, listApiKeyAuditEvents, listApiKeys, revokeApiKey },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("../src/db/index.ts"),
      import("../src/db/schema.ts"),
      import("../src/lib/api-keys.ts"),
    ]);
    const orgId = randomUUID();
    const otherOrgId = randomUUID();
    const adminId = randomUUID();
    const memberId = randomUUID();
    const outsiderId = randomUUID();
    try {
      await db.insert(orgs).values([
        { id: orgId, name: "Key deletion" },
        { id: otherOrgId, name: "Other tenant" },
      ]);
      await db.insert(users).values([adminId, memberId, outsiderId].map((id) => ({
        id, email: `${id}@example.com`, name: "Key deletion tester",
      })));
      await db.insert(orgMembers).values([
        { orgId, userId: adminId, role: "admin" },
        { orgId: otherOrgId, userId: adminId, role: "admin" },
        { orgId, userId: memberId, role: "member" },
      ]);
      const key = await createApiKey({ actorUserId: adminId, orgId, environment: "test", name: "Delete me" });
      const input = { actorUserId: adminId, orgId, apiKeyId: key.id };
      await assert.rejects(deleteApiKey(input), { code: "KEY_NOT_REVOKED" });
      assert.ok(await authenticateApiKey(key.rawKey));
      await revokeApiKey(input);
      await assert.rejects(deleteApiKey({ ...input, actorUserId: memberId }));
      await assert.rejects(deleteApiKey({ ...input, actorUserId: outsiderId }), { code: "MEMBERSHIP_REQUIRED" });
      await assert.rejects(deleteApiKey({ ...input, orgId: otherOrgId }), { code: "KEY_NOT_FOUND" });
      await assert.rejects(deleteApiKey({ ...input, apiKeyId: randomUUID() }), { code: "KEY_NOT_FOUND" });
      assert.equal((await listApiKeys(input)).length, 1);
      await assert.rejects(listApiKeyAuditEvents({ actorUserId: memberId, orgId }));

      const [historical, scheduled] = await db.insert(broadcasts).values([
        {
          orgId, apiKeyId: key.id, createdByUserId: adminId,
          name: "Historical broadcast", from: "sender@example.com",
          templateName: "Example", templateSubject: "Example", templateText: "Example",
          environment: "test", status: "completed",
        },
        {
          orgId, apiKeyId: key.id, createdByUserId: adminId,
          name: "Queued broadcast", from: "sender@example.com",
          templateName: "Example", templateSubject: "Example", templateText: "Example",
          environment: "test", status: "scheduled",
          scheduledFor: new Date(Date.now() + 86_400_000),
        },
      ]).returning({ id: broadcasts.id });

      // A scheduled or running broadcast would fall back to its creator's
      // membership once the key reference is cleared, so deletion must wait.
      await assert.rejects(deleteApiKey(input), { code: "KEY_IN_USE" });
      await db.update(broadcasts).set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(broadcasts.id, scheduled.id));

      await deleteApiKey(input);
      await assert.rejects(deleteApiKey(input), { code: "KEY_NOT_FOUND" });
      assert.deepEqual(await listApiKeys(input), []);
      assert.equal(await authenticateApiKey(key.rawKey), null);
      assert.deepEqual(await db.select().from(apiKeys).where(eq(apiKeys.id, key.id)), []);

      const [history] = await db.select().from(broadcasts).where(eq(broadcasts.id, historical.id));
      assert.equal(history.apiKeyId, null);
      assert.equal(history.createdByUserId, adminId);
      assert.equal(history.status, "completed");

      const events = (await listApiKeyAuditEvents({ actorUserId: adminId, orgId }))
        .filter((event) => event.apiKeyId === key.id)
        .reverse();
      assert.deepEqual(events.map((event) => event.action), ["created", "revoked", "deleted"]);
      assert.equal(events[2].keyName, "Delete me");
      assert.equal(events[2].keyPublicId, key.keyId);
      assert.equal(events[2].actorName, "Key deletion tester");

      // Audit rows outlive the key they describe.
      const stored = await db.select().from(apiKeyAuditEvents).where(eq(apiKeyAuditEvents.apiKeyId, key.id));
      assert.equal(stored.length, 3);
    } finally {
      await db.delete(orgs).where(eq(orgs.id, orgId));
      await db.delete(orgs).where(eq(orgs.id, otherOrgId));
      for (const id of [adminId, memberId, outsiderId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }
  },
);
