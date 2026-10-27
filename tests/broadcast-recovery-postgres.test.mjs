import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const options = { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured" };
const start = new Date("2030-01-01T00:00:00Z");
const expired = new Date(start.getTime() + 6 * 60_000);

async function fixture(api, run) {
  process.env.DATABASE_URL = databaseUrl;
  const [{ eq }, { db }, schema, { processBroadcastJob }, { queueEmail }] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"), import("../src/lib/broadcasts.ts"), import("../src/lib/messages.ts"),
  ]);
  const { apiKeys, broadcasts, broadcastRecipients, messages, orgMembers, orgs, users } = schema;
  const orgId = randomUUID();
  const actorUserId = randomUUID();
  const apiKeyId = api ? randomUUID() : null;
  const broadcastId = randomUUID();
  const recipientId = randomUUID();
  const principal = { actorUserId, apiKeyId, environment: "test", orgId, scopes: null };
  const payload = { from: "news@example.org", to: ["reader@example.net"], subject: "Recovery", text: "Hello", tags: [{ name: "broadcast_id", value: broadcastId }] };
  const processJob = (dependencies) => processBroadcastJob({ broadcastId, orgId }, dependencies);
  const read = async () => (await db.select().from(broadcastRecipients).where(eq(broadcastRecipients.id, recipientId)))[0];
  const queued = () => db.select().from(messages).where(eq(messages.orgId, orgId));
  const assertComplete = async () => {
    assert.equal((await read()).status, "queued");
    assert.equal((await queued()).length, 1);
    assert.equal((await read()).messageId, (await queued())[0].id);
    assert.equal((await db.select().from(broadcasts).where(eq(broadcasts.id, broadcastId)))[0].status, "completed");
  };
  try {
    await db.insert(orgs).values({ id: orgId, name: "Broadcast recovery" });
    await db.insert(users).values({ id: actorUserId, name: "Operator", email: `${actorUserId}@example.org` });
    await db.insert(orgMembers).values({ orgId, userId: actorUserId, role: "admin" });
    if (api) await db.insert(apiKeys).values({ id: apiKeyId, orgId, createdByUserId: actorUserId, name: "test", keyHash: randomUUID(), keyId: randomUUID(), environment: "test" });
    await db.insert(broadcasts).values({ id: broadcastId, orgId, apiKeyId, createdByUserId: actorUserId, name: "Recovery", from: payload.from, templateName: "Recovery", templateSubject: payload.subject, templateText: payload.text, environment: "test", status: "running" });
    await db.insert(broadcastRecipients).values({ id: recipientId, broadcastId, email: payload.to[0], position: 0 });
    await run({ ...schema, assertComplete, broadcastId, db, eq, orgId, payload, principal, process: processJob, queueEmail, queued, read, recipientId });
  } finally {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await db.delete(users).where(eq(users.id, actorUserId));
  }
}

for (const api of [false, true]) {
  const kind = api ? "API-key" : "console";
  test(`${kind}: suppression lookup failure recovers after its lease expires`, options, () => fixture(api, async (f) => {
    const select = f.db.select;
    let injected = false;
    f.db.select = function (...args) {
      const query = select.apply(this, args);
      const from = query.from;
      query.from = function (table) {
        if (!injected && table === f.emailSuppressions) { injected = true; throw new Error("injected lookup failure"); }
        return from.call(this, table);
      };
      return query;
    };
    try { await assert.rejects(f.process({ now: () => start }), /injected lookup failure/); }
    finally { f.db.select = select; }
    assert.equal((await f.read()).status, "processing");
    await f.process({ now: () => new Date(start.getTime() + 60_000) });
    assert.equal((await f.queued()).length, 0, "an active claim must not be stolen");
    await Promise.all([f.process({ now: () => expired }), f.process({ now: () => expired })]);
    await f.assertComplete();
  }));

  test(`${kind}: queue commit survives a lost result beyond the API idempotency window`, options, () => fixture(api, async (f) => {
    await assert.rejects(f.process({ now: () => start, queue: async (input) => {
      await f.queueEmail(input);
      throw new Error("lost result after commit");
    } }), /lost result after commit/);
    const recipient = await f.read();
    assert.equal(recipient.status, "queued");
    assert.ok(recipient.messageId, "queue commit must atomically link the recipient");
    await f.db.update(f.messages).set({ createdAt: new Date("2020-01-01T00:00:00Z") }).where(f.eq(f.messages.id, recipient.messageId));
    await f.process({ now: () => new Date(start.getTime() + 48 * 60 * 60_000) });
    await f.assertComplete();
  }));

  test(`${kind}: legacy unlinked queued recipients recover without sending again`, options, () => fixture(api, async (f) => {
    const message = await f.queueEmail({ payload: f.payload, principal: f.principal, ...(api ? { idempotencyKey: `broadcast:${f.broadcastId}:${f.recipientId}` } : {}) });
    await f.db.update(f.messages).set({ createdAt: new Date("2020-01-01T00:00:00Z") }).where(f.eq(f.messages.id, message.id));
    await f.db.update(f.broadcastRecipients).set({ status: "processing", updatedAt: start }).where(f.eq(f.broadcastRecipients.id, f.recipientId));
    await f.process({ now: () => expired, queue: async () => { throw new Error("must reuse the existing message"); } });
    await f.assertComplete();
    assert.equal((await f.read()).messageId, message.id);
  }));

  test(`${kind}: concurrent queue calls share one durable recipient message`, options, () => fixture(api, async (f) => {
    await f.process({ now: () => start, queue: async (input) => {
      const results = await Promise.all([f.queueEmail(input), f.queueEmail(input)]);
      assert.equal(results[0].id, results[1].id);
      assert.equal(results.filter((result) => result.replayed).length, 1);
      return results[0];
    } });
    await f.assertComplete();
  }));

  test(`${kind}: a stale rate-limit result cannot reschedule a completed reclaim`, options, () => fixture(api, async (f) => {
    const { RateLimitError } = await import("../src/lib/rate-limit-core.ts");
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let entered;
    const ready = new Promise((resolve) => { entered = resolve; });
    const first = f.process({ now: () => start, queue: async (input) => {
      await f.queueEmail(input);
      entered();
      await gate;
      throw new RateLimitError("test", 1, 60);
    } });
    await ready;
    try { await f.process({ now: () => expired }); }
    finally { release(); }
    await first;
    await f.assertComplete();
  }));

  test(`${kind}: a late worker cannot enqueue or overwrite a reclaimed recipient`, options, () => fixture(api, async (f) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let entered;
    const ready = new Promise((resolve) => { entered = resolve; });
    const first = f.process({ now: () => start, queue: async (input) => { entered(); await gate; return f.queueEmail(input); } });
    const rejected = assert.rejects(first, /lease is no longer current/);
    await ready;
    let releaseSecond;
    const secondGate = new Promise((resolve) => { releaseSecond = resolve; });
    let secondEntered;
    const secondReady = new Promise((resolve) => { secondEntered = resolve; });
    const second = f.process({ now: () => expired, queue: async (input) => { secondEntered(); await secondGate; return f.queueEmail(input); } });
    await secondReady;
    release();
    try { await rejected; }
    finally { releaseSecond(); }
    await second;
    await f.assertComplete();
  }));
}

test("broadcast message creation rolls back if its durable recipient link cannot commit", options, () => fixture(false, async (f) => {
  try {
    await f.db.$client.unsafe(`CREATE FUNCTION paperboy_broadcast_link_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${f.recipientId}'::uuid AND NEW.message_id IS NOT NULL THEN RAISE EXCEPTION 'injected link failure'; END IF; RETURN NEW; END $$`);
    await f.db.$client.unsafe("CREATE TRIGGER paperboy_broadcast_link_failure BEFORE UPDATE ON broadcast_recipients FOR EACH ROW EXECUTE FUNCTION paperboy_broadcast_link_failure()");
    await assert.rejects(f.process({ now: () => start }));
    assert.equal((await f.queued()).length, 0);
    assert.equal((await f.read()).messageId, null);
    assert.equal((await f.read()).status, "processing");
    await f.db.$client.unsafe("DROP TRIGGER paperboy_broadcast_link_failure ON broadcast_recipients");
    await f.process({ now: () => expired });
    await f.assertComplete();
  } finally {
    await f.db.$client.unsafe("DROP TRIGGER IF EXISTS paperboy_broadcast_link_failure ON broadcast_recipients");
    await f.db.$client.unsafe("DROP FUNCTION IF EXISTS paperboy_broadcast_link_failure()");
  }
}));
