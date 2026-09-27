import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { mock } from "bun:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test(
  "audit fixes: key minting, creator checks, suppression moves, pause races, invites",
  { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured" },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    mock.module("server-only", () => ({}));
    const [
      { eq },
      { db },
      schema,
      { AuthorizationError },
      apiKeysLib,
      { queueEmail },
      organizations,
      suppressions,
      broadcastsLib,
      { RateLimitError },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("../src/db/index.ts"),
      import("../src/db/schema.ts"),
      import("../src/lib/authorization.ts"),
      import("../src/lib/api-keys.ts"),
      import("../src/lib/messages.ts"),
      import("../src/lib/organizations.ts"),
      import("../src/lib/suppressions.ts"),
      import("../src/lib/broadcasts.ts"),
      import("../src/lib/rate-limit-core.ts"),
    ]);
    const { apiKeys, broadcastRecipients, broadcasts, orgInvites, orgMembers, orgs, users } = schema;
    const orgId = randomUUID();
    const [ownerId, adminId, agencyId, memberId, inviteeId] = Array.from({ length: 5 }, () => randomUUID());
    const inviteEmail = `${randomUUID()}@example.test`;
    try {
      await db.insert(orgs).values({ id: orgId, name: "Audit fixes" });
      await db.insert(users).values(
        [ownerId, adminId, agencyId, memberId].map((id) => ({ id, email: `${id}@example.test`, name: "Tester" })),
      );
      await db.insert(users).values({ id: inviteeId, email: inviteEmail, name: "Invitee" });
      await db.insert(orgMembers).values([
        { orgId, role: "owner", userId: ownerId },
        { orgId, role: "admin", userId: adminId },
        { orgId, role: "agency", userId: agencyId },
        { orgId, role: "member", userId: memberId },
      ]);

      // A scoped test key cannot mint a live key or widen beyond its own scopes.
      const scopedKey = { environment: "test", scopes: ["apiKeys.create", "templates.read"] };
      await assert.rejects(
        apiKeysLib.createApiKey({ actorUserId: adminId, callingKey: scopedKey, environment: "live", name: "x", orgId }),
        { code: "INVALID_ENVIRONMENT" },
      );
      await assert.rejects(
        apiKeysLib.createApiKey({ actorUserId: adminId, callingKey: scopedKey, environment: "test", name: "x", orgId, scopes: ["messages.send"] }),
        { code: "INVALID_SCOPES" },
      );
      const inherited = await apiKeysLib.createApiKey({ actorUserId: adminId, callingKey: scopedKey, environment: "test", name: "x", orgId });
      assert.deepEqual(inherited.scopes, scopedKey.scopes);

      // Agency cannot rescope (or disable) an owner's key.
      const ownerKey = await apiKeysLib.createApiKey({ actorUserId: ownerId, environment: "test", name: "owner", orgId, scopes: ["messages.send"] });
      for (const scopes of [null, []]) {
        await assert.rejects(
          apiKeysLib.updateApiKey({ actorUserId: agencyId, apiKeyId: ownerKey.id, orgId, scopes }),
          { code: "INVALID_SCOPES" },
        );
      }

      // Sending through a key requires the creator's current messages.send role.
      const memberKey = { actorUserId: memberId, apiKeyId: randomUUID(), environment: "test", orgId, scopes: null };
      await assert.rejects(
        queueEmail({ payload: { from: "a@example.test", subject: "x", text: "x", to: "b@example.test" }, principal: memberKey }),
        AuthorizationError,
      );

      // Removing a member revokes their keys.
      const adminKey = await apiKeysLib.createApiKey({ actorUserId: adminId, environment: "test", name: "admin", orgId });
      const [adminMembership] = await db.select({ id: orgMembers.id }).from(orgMembers).where(eq(orgMembers.userId, adminId));
      await organizations.removeOrganizationMember({ actorUserId: ownerId, membershipId: adminMembership.id });
      const [revoked] = await db.select({ revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, adminKey.id));
      assert.ok(revoked.revokedAt);

      // Moving a suppression to another address needs delete authority.
      const suppression = await suppressions.createSuppression({
        actorUserId: ownerId,
        orgId,
        payload: { email: "victim@example.test", reason: "complained" },
      });
      await assert.rejects(
        suppressions.updateSuppression({ actorUserId: agencyId, orgId, payload: { email: "other@example.test" }, suppressionId: suppression.id }),
        AuthorizationError,
      );
      await suppressions.updateSuppression({ actorUserId: agencyId, orgId, payload: { reason: "manual" }, suppressionId: suppression.id });

      // A pause during a rate-limited send is never overwritten.
      const [broadcast] = await db.insert(broadcasts).values({
        orgId, createdByUserId: ownerId, name: "Race", from: "news@example.test",
        templateName: "T", templateSubject: "S", templateText: "T", environment: "test", status: "running",
      }).returning({ id: broadcasts.id });
      await db.insert(broadcastRecipients).values(
        [0, 1, 2].map((position) => ({ broadcastId: broadcast.id, email: `r${position}@example.test`, position })),
      );
      await broadcastsLib.processBroadcast(
        { broadcastId: broadcast.id, orgId },
        {
          queue: async () => {
            await broadcastsLib.pauseBroadcast({ actorUserId: ownerId, broadcastId: broadcast.id, orgId });
            throw new RateLimitError("test", 1, 60);
          },
        },
      );
      const [afterRace] = await db.select({ status: broadcasts.status }).from(broadcasts).where(eq(broadcasts.id, broadcast.id));
      assert.equal(afterRace.status, "paused");

      // Invites: address alone is not proof of ownership.
      const [invite] = await db.insert(orgInvites).values({ orgId, email: inviteEmail, role: "admin", invitedByUserId: ownerId }).returning({ id: orgInvites.id });
      process.env.PAPERBOY_PUBLIC_SIGNUP_ENABLED = "false";
      assert.equal(await organizations.canCreateAccountForEmail(inviteEmail), false);
      assert.equal(await organizations.canCreateAccountForEmail(inviteEmail, randomUUID()), false);
      assert.equal(await organizations.canCreateAccountForEmail(inviteEmail, invite.id), true);
      await assert.rejects(
        organizations.acceptOrganizationInvitation({ email: inviteEmail, invitationId: invite.id, proof: "verified-session", userId: inviteeId }),
        { code: "INVITATION_REQUIRES_LINK" },
      );
      await organizations.acceptOrganizationInvitation({ email: inviteEmail, invitationId: invite.id, proof: "invite-link", userId: inviteeId });
      const [invitee] = await db.select({ emailVerified: users.emailVerified }).from(users).where(eq(users.id, inviteeId));
      assert.equal(invitee.emailVerified, true);
    } finally {
      delete process.env.PAPERBOY_PUBLIC_SIGNUP_ENABLED;
      await db.delete(orgs).where(eq(orgs.id, orgId));
      for (const id of [ownerId, adminId, agencyId, memberId, inviteeId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }
  },
);
