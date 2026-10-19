import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { mock } from "bun:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test(
  "API key expiry defaults to none, is enforced at request time, and every change is audited",
  { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured" },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    mock.module("server-only", () => ({}));
    const [
      { eq },
      { db },
      { apiKeys, orgMembers, orgs, users },
      { generateApiKey },
      apiKeysLib,
      organizations,
    ] = await Promise.all([
      import("drizzle-orm"),
      import("../src/db/index.ts"),
      import("../src/db/schema.ts"),
      import("../src/lib/api-key-crypto.ts"),
      import("../src/lib/api-keys.ts"),
      import("../src/lib/organizations.ts"),
    ]);
    const {
      ApiKeyError,
      authenticateApiKey,
      createApiKey,
      listApiKeyAuditEvents,
      revokeApiKey,
      updateApiKey,
    } = apiKeysLib;
    const orgId = randomUUID();
    const adminId = randomUUID();
    const memberId = randomUUID();
    const ownerId = randomUUID();
    const oneDay = 86_400_000;
    try {
      await db.insert(orgs).values({ id: orgId, name: "Key expiry" });
      await db.insert(users).values([adminId, memberId, ownerId].map((id) => ({
        id, email: `${id}@example.com`, name: "Expiry tester",
      })));
      const memberships = await db.insert(orgMembers).values([
        { orgId, userId: adminId, role: "admin" },
        { orgId, userId: memberId, role: "member" },
        { orgId, userId: ownerId, role: "owner" },
      ]).returning({ id: orgMembers.id, userId: orgMembers.userId });
      const memberMembershipId = memberships.find((row) => row.userId === memberId).id;
      const actor = { actorUserId: adminId, orgId };

      const forever = await createApiKey({ ...actor, environment: "live", name: "Forever" });
      assert.equal(forever.expiresAt, null);
      assert.ok(await authenticateApiKey(forever.rawKey));

      await assert.rejects(
        createApiKey({ ...actor, environment: "live", name: "Past", expiresAt: new Date(Date.now() - oneDay).toISOString() }),
        { code: "INVALID_EXPIRY" },
      );
      await assert.rejects(
        createApiKey({ ...actor, environment: "live", name: "Junk", expiresAt: "next week" }),
        { code: "INVALID_EXPIRY" },
      );
      await assert.rejects(
        createApiKey({ ...actor, environment: "live", name: "Number", expiresAt: 123 }),
        { code: "INVALID_EXPIRY" },
      );

      // The console passes a Date computed from its TTL preset.
      const presetExpiry = new Date(Date.now() + 7 * oneDay);
      const preset = await createApiKey({ ...actor, environment: "live", name: "Preset", expiresAt: presetExpiry });
      assert.equal(preset.expiresAt.getTime(), presetExpiry.getTime());
      assert.ok(await authenticateApiKey(preset.rawKey));

      const expiresAt = new Date(Date.now() + oneDay);
      const temporary = await createApiKey({
        ...actor, environment: "live", name: "Temporary", expiresAt: expiresAt.toISOString(),
      });
      assert.equal(temporary.expiresAt.getTime(), expiresAt.getTime());
      assert.ok(await authenticateApiKey(temporary.rawKey));

      // Expiry is fixed at creation, so the key only stops working once its time passes.
      await db.update(apiKeys).set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(apiKeys.id, temporary.id));
      assert.equal(await authenticateApiKey(temporary.rawKey), null);
      const listed = (await apiKeysLib.listApiKeys(actor)).find((row) => row.id === temporary.id);
      assert.ok(listed.expiresAt.getTime() < Date.now());
      // An expired key can still be revoked.
      await revokeApiKey({ ...actor, apiKeyId: temporary.id });

      // Keys created by a member are revoked when that member is removed.
      const memberKey = generateApiKey("live");
      const [memberKeyRow] = await db.insert(apiKeys).values({
        createdByUserId: memberId,
        environment: "live",
        keyHash: memberKey.keyHash,
        keyId: memberKey.keyId,
        name: "Member key",
        orgId,
        scopes: null,
      }).returning({ id: apiKeys.id });
      assert.ok(await authenticateApiKey(memberKey.rawKey));
      // Only owners may remove members.
      await organizations.removeOrganizationMember({ actorUserId: ownerId, membershipId: memberMembershipId });
      assert.equal(await authenticateApiKey(memberKey.rawKey), null);

      // Renames and scope changes are audited with the previous values; no-op edits are not.
      await updateApiKey({ ...actor, apiKeyId: forever.id, name: "Forever renamed" });
      await updateApiKey({ ...actor, apiKeyId: forever.id, name: "Forever renamed" });
      await updateApiKey({ ...actor, apiKeyId: forever.id, scopes: ["apiKeys.read"] });
      // Re-revoking is a no-op and is not logged twice.
      await revokeApiKey({ ...actor, apiKeyId: temporary.id });

      const events = (await listApiKeyAuditEvents(actor)).reverse();
      const forEvents = events.filter((event) => event.apiKeyId === forever.id);
      assert.deepEqual(forEvents.map((event) => event.action), ["created", "updated", "updated"]);
      assert.deepEqual(forEvents[0].expiresAt, null);
      assert.deepEqual(forEvents[1].details, {
        changes: { name: { from: "Forever", to: "Forever renamed" } },
      });
      assert.deepEqual(forEvents[2].details, {
        changes: { scopes: { from: null, to: ["apiKeys.read"] } },
      });

      const tempEvents = events.filter((event) => event.apiKeyId === temporary.id);
      assert.deepEqual(tempEvents.map((event) => event.action), ["created", "revoked"]);
      assert.equal(tempEvents[0].expiresAt.getTime(), expiresAt.getTime());

      const memberEvent = events.find((event) => event.apiKeyId === memberKeyRow.id);
      assert.equal(memberEvent.action, "revoked");
      assert.deepEqual(memberEvent.details, { reason: "member_removed" });
      assert.equal(memberEvent.actorName, "Expiry tester");
      assert.equal(memberEvent.keyName, "Member key");

      // The removed member can no longer read the org's audit log.
      await assert.rejects(
        listApiKeyAuditEvents({ actorUserId: memberId, orgId }),
        { code: "MEMBERSHIP_REQUIRED" },
      );
      await assert.rejects(
        listApiKeyAuditEvents({ actorUserId: randomUUID(), orgId }),
        ApiKeyError,
      );
    } finally {
      await db.delete(orgs).where(eq(orgs.id, orgId));
      for (const id of [adminId, memberId, ownerId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }
  },
);
