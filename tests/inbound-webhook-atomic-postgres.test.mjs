import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
test("inbound email and its webhook outbox row commit atomically and replay once", {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, { orgs, receivedEmails, webhookDeliveries, webhookEndpoints }, { receiveInboundEmail }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/inbound.ts"),
  ]);
  const orgId = randomUUID();
  const payload = { from: "sender@example.org", to: ["reader@example.net"], subject: "Atomic inbound", text: "Hello", message_id: `<${randomUUID()}@example.org>` };
  const input = { payload, principal: { environment: "test", orgId } };
  const rows = () => db.select().from(receivedEmails).where(eq(receivedEmails.orgId, orgId));
  const deliveries = () => db.select().from(webhookDeliveries).where(eq(webhookDeliveries.orgId, orgId));
  try {
    await db.insert(orgs).values({ id: orgId, name: "Inbound transaction regression" });
    await db.insert(webhookEndpoints).values([1].map((i) => ({ orgId, url: `https://example.org/hook${i}`, encryptedSecret: "integration-only-secret-placeholder-32" })));
    // A real PostgreSQL failure aborts the transaction, unlike an in-memory stub.
    await db.$client.unsafe(`CREATE FUNCTION paperboy_inbound_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.org_id = '${orgId}'::uuid THEN RAISE EXCEPTION 'injected webhook failure'; END IF; RETURN NEW; END $$`);
    await db.$client.unsafe("CREATE TRIGGER paperboy_inbound_failure BEFORE INSERT ON webhook_deliveries FOR EACH ROW EXECUTE FUNCTION paperboy_inbound_failure()");
    await assert.rejects(receiveInboundEmail(input));
    assert.equal((await rows()).length, 0, "email must roll back when outbox persistence fails");
    assert.equal((await deliveries()).length, 0);
    await db.$client.unsafe("DROP TRIGGER paperboy_inbound_failure ON webhook_deliveries");
    const stored = await receiveInboundEmail(input);
    assert.equal(stored.replayed, false);
    const replay = await receiveInboundEmail(input);
    assert.equal(replay.id, stored.id);
    assert.equal(replay.replayed, true);
    assert.equal((await rows()).length, 1);
    const hooks = await deliveries();
    assert.equal(hooks.length, 1);
    assert.ok(hooks.every((hook) => hook.receivedEmailId === stored.id && hook.status === "queued"));
  } finally {
    await db.$client.unsafe("DROP TRIGGER IF EXISTS paperboy_inbound_failure ON webhook_deliveries");
    await db.$client.unsafe("DROP FUNCTION IF EXISTS paperboy_inbound_failure()");
    await db.delete(orgs).where(eq(orgs.id, orgId));
  }
});
