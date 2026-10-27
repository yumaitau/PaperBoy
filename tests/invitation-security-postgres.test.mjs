import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { mock } from "bun:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
test("invitation IDs are not inbox proof; emailed tokens and verified legacy recipients work", { skip: !databaseUrl }, async () => {
  process.env.DATABASE_URL = databaseUrl;
  mock.module("server-only", () => ({}));
  const [{ db }, schema, { eq }, organizations, invites, { paperBoyMcpInvitationServices: services }, { getMessageDetail }, sharing] = await Promise.all([
    import("../src/db/index.ts"), import("../src/db/schema.ts"), import("drizzle-orm"),
    import("../src/lib/organizations.ts"), import("../src/lib/organization-invites.ts"),
    import("../src/mcp/invitation-services.ts"), import("../src/lib/message-events.ts"), import("../src/lib/message-sharing.ts"),
  ]);
  const orgId = randomUUID();
  const domainId = randomUUID();
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const recipientId = randomUUID();
  const legacyId = randomUUID();
  const email = `${recipientId}@example.test`;
  const legacyEmail = `${legacyId}@example.test`;
  const domain = `${randomUUID()}.example.test`;
  const prior = Object.fromEntries(["PAPERBOY_PUBLIC_SIGNUP_ENABLED", "PAPERBOY_PUBLIC_URL", "PAPERBOY_SHARE_SIGNING_KEY"].map((name) => [name, process.env[name]]));
  process.env.PAPERBOY_PUBLIC_SIGNUP_ENABLED = "false";
  process.env.PAPERBOY_PUBLIC_URL = "https://paperboy.test";
  process.env.PAPERBOY_SHARE_SIGNING_KEY = Buffer.alloc(32, 8).toString("base64");
  const notFound = (error) => error.code === "INVITATION_NOT_FOUND";
  const noProof = (error) => ["INVITATION_NOT_FOUND", "INVITATION_REQUIRES_LINK"].includes(error.code);
  try {
    await db.insert(schema.orgs).values({ id: orgId, name: "Invitation security", openTrackingEnabled: true });
    await db.insert(schema.users).values([
      { id: ownerId, email: `${ownerId}@example.test`, name: "Owner", emailVerified: true },
      { id: memberId, email: `${memberId}@example.test`, name: "Reader" },
      { id: recipientId, email, name: "Unverified recipient" },
      { id: legacyId, email: legacyEmail, name: "Legacy recipient" },
    ]);
    await db.insert(schema.orgMembers).values([{ orgId, userId: ownerId, role: "owner" }, { orgId, userId: memberId, role: "member" }]);
    await db.insert(schema.domains).values({ id: domainId, orgId, name: domain, status: "verified", verifiedAt: new Date(), clickTrackingEnabled: true });
    await db.insert(schema.domainDkimKeys).values({ domainId, selector: "fixture", status: "active", dnsStatus: "matched", publicKey: "fixture", encryptedPrivateKey: "fixture", activatedAt: new Date() });

    // Existing IDs were already disclosed and must not verify an unverified account.
    const [legacy] = await db.insert(schema.orgInvites).values({ orgId, email: legacyEmail, role: "admin", invitedByUserId: ownerId }).returning();
    assert.equal(await organizations.canCreateAccountForEmail(legacyEmail, legacy.id), false);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email: legacyEmail, userId: legacyId, invitationToken: legacy.id, proof: "invite-link" }), noProof);
    await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, legacyId));
    assert.equal((await organizations.findOrganizationInvitationForLink(legacy.id)).requiresVerifiedEmail, true);
    await organizations.acceptOrganizationInvitation({ email: legacyEmail, userId: legacyId, invitationToken: legacy.id, proof: "invite-link" });

    // Exercise the real invitation queue and members.read-only MCP service.
    const result = await invites.inviteAndEmailOrganizationMember({ actorUserId: ownerId, orgId, email, role: "admin" });
    assert.equal(result.emailError, null);
    assert.ok(result.queuedId);
    const [queued] = await db.select().from(schema.messages).where(eq(schema.messages.id, result.queuedId));
    const token = /https:\/\/paperboy\.test\/invite\/([a-f0-9-]+)/.exec(queued.textBody)?.[1];
    assert.ok(token);
    assert.notEqual(token, result.invitation.id);
    assert.equal(queued.openTrackingEnabled, false);
    assert.equal(queued.clickTrackingEnabled, false);
    const [stored] = await db.select().from(schema.orgInvites).where(eq(schema.orgInvites.id, result.invitation.id));
    assert.equal(stored.tokenHash, createHash("sha256").update(token).digest("hex"));
    const listed = await services.list({ actorUserId: memberId, apiKeyId: randomUUID(), orgId, environment: "live", scopes: ["members.read"] });
    const pending = await organizations.listPendingInvitationsForUser(email);
    for (const data of [result, listed, pending]) {
      assert.equal(JSON.stringify(data).includes(token), false);
      assert.equal(JSON.stringify(data).includes(stored.tokenHash), false);
    }
    assert.equal(listed.find((row) => row.email === email).id, result.invitation.id);
    assert.equal(await organizations.canCreateAccountForEmail(email, result.invitation.id), false);
    assert.equal(await organizations.canCreateAccountForEmail(email, token), true);
    assert.equal(await organizations.canCreateAccountForEmail("wrong@example.test", token), false);
    assert.equal(await organizations.findOrganizationInvitationForLink(result.invitation.id), null);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email, userId: recipientId, invitationToken: result.invitation.id, proof: "invite-link" }), notFound);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email, userId: recipientId, invitationId: result.invitation.id, proof: "verified-session" }), noProof);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email, userId: memberId, invitationToken: token, proof: "invite-link" }), notFound);

    // Raw outbox content still delivers the credential, while every message view redacts it.
    const detail = await getMessageDetail({ actorUserId: memberId, environment: "live", messageId: queued.id, orgId });
    assert.equal(detail.html, null);
    assert.match(detail.text, /recipient's email/);
    assert.equal(JSON.stringify(detail).includes(token), false);
    const { buildOwnerMessageMime } = await import("../src/lib/message-mime.ts");
    const mime = await buildOwnerMessageMime({ actorUserId: ownerId, messageId: queued.id, orgId });
    const { simpleParser } = await import("mailparser");
    const parsedMime = await simpleParser(mime);
    assert.match(parsedMime.text, /recipient's email/);
    assert.equal(JSON.stringify([parsedMime.text, parsedMime.html]).includes(token), false);
    const shared = await sharing.shareEmail({ actorUserId: ownerId, environment: "live", messageId: queued.id, orgId, baseUrl: "https://paperboy.test" });
    assert.equal(JSON.stringify(await sharing.getSharedEmail({ token: new URL(shared.url).pathname.split("/").at(-1) })).includes(token), false);

    // Reissuing rotates the proof; neither the old token nor the public ID can redeem it.
    const renewed = await organizations.inviteOrganizationMember({ actorUserId: ownerId, orgId, email, role: "admin" });
    assert.equal(renewed.invitation.id, result.invitation.id);
    assert.notEqual(renewed.invitationToken, token);
    assert.equal(await organizations.canCreateAccountForEmail(email, token), false);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email, userId: recipientId, invitationToken: token, proof: "invite-link" }), notFound);
    await db.update(schema.orgInvites).set({ revokedAt: new Date() }).where(eq(schema.orgInvites.id, renewed.invitation.id));
    assert.equal(await organizations.canCreateAccountForEmail(email, renewed.invitationToken), false);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email, userId: recipientId, invitationToken: renewed.invitationToken, proof: "invite-link" }), notFound);
    await db.update(schema.orgInvites).set({ revokedAt: null }).where(eq(schema.orgInvites.id, renewed.invitation.id));
    await organizations.acceptOrganizationInvitation({ email, userId: recipientId, invitationToken: renewed.invitationToken, proof: "invite-link" });
    assert.equal(await organizations.canCreateAccountForEmail(email, renewed.invitationToken), false);
    await assert.rejects(() => organizations.acceptOrganizationInvitation({ email, userId: recipientId, invitationToken: renewed.invitationToken, proof: "invite-link" }), notFound);
    const [recipient] = await db.select().from(schema.users).where(eq(schema.users.id, recipientId));
    assert.equal(recipient.emailVerified, true);
    assert.equal(recipient.activeOrgId, orgId);
    const members = await db.select().from(schema.orgMembers).where(eq(schema.orgMembers.orgId, orgId));
    assert.equal(members.find((row) => row.userId === recipientId).role, "admin");
    assert.equal(members.find((row) => row.userId === memberId).role, "member");
  } finally {
    await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
    for (const id of [ownerId, memberId, recipientId, legacyId]) await db.delete(schema.users).where(eq(schema.users.id, id));
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
