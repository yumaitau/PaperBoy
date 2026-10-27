import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
test("received email deduplication and retrieval stay inside each environment", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { domainDkimKeys, domains, orgs, receivedEmails }, { getReceivedEmail, receiveInboundEmail }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/inbound.ts"),
  ]);
  const orgId = randomUUID();
  const domainId = randomUUID();
  const name = `${orgId}.example.net`;
  const principal = (environment) => ({ environment, orgId });
  const receive = (environment, payload) => receiveInboundEmail({ principal: principal(environment), payload });
  try {
    await db.insert(orgs).values({ id: orgId, name: "Inbound environment regression" });
    await db.insert(domains).values({ id: domainId, orgId, name, status: "verified" });
    await db.insert(domainDkimKeys).values({ domainId, encryptedPrivateKey: "integration-only", publicKey: "integration-only", selector: "test", status: "active" });
    for (const withId of [true, false]) {
      const payload = { from: "sender@example.org", to: [`reader@${name}`], subject: `Isolation ${withId}`, text: "same content", ...(withId ? { message_id: `<${randomUUID()}@example.org>` } : {}) };
      const testEmail = await receive("test", payload);
      const liveEmail = await receive("live", payload);
      assert.notEqual(liveEmail.id, testEmail.id);
      assert.equal(liveEmail.environment, "live");
      assert.equal(liveEmail.replayed, false);
      for (const [environment, stored] of [["test", testEmail], ["live", liveEmail]]) {
        const replays = await Promise.all([receive(environment, payload), receive(environment, payload)]);
        assert.ok(replays.every((replay) => replay.id === stored.id && replay.replayed));
        if (withId) {
          const changed = await receive(environment, { ...payload, text: "different hash, same message id" });
          assert.equal(changed.id, stored.id);
          assert.equal(changed.replayed, true);
        }
        assert.equal((await getReceivedEmail({ orgId, environment, receivedEmailId: stored.id })).id, stored.id);
        await assert.rejects(getReceivedEmail({ orgId, environment: environment === "live" ? "test" : "live", receivedEmailId: stored.id }), { code: "MESSAGE_NOT_FOUND" });
      }
    }
    assert.equal((await db.select().from(receivedEmails).where(eq(receivedEmails.orgId, orgId))).length, 4);
  } finally { await db.delete(orgs).where(eq(orgs.id, orgId)); }
});
