import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const options = {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
};

async function withEndpoints(run) {
  process.env.DATABASE_URL = databaseUrl;
  const [
    { eq }, { db }, schema, { createWebhook }, { receiveInboundEmail },
    { queueEmail }, { postgresWebhookStore }, { processNextWebhook },
    { verifyWebhookSignature },
  ] = await Promise.all([
    import("drizzle-orm"), import("../src/db/index.ts"),
    import("../src/db/schema.ts"), import("../src/lib/webhooks.ts"),
    import("../src/lib/inbound.ts"), import("../src/lib/messages.ts"),
    import("../src/lib/postgres-webhook-store.ts"),
    import("../src/lib/webhook-worker-core.ts"), import("../src/lib/webhook-core.ts"),
  ]);
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const actorUserId = randomUUID();
  const apiKeyId = randomUUID();
  const encryptionKey = Buffer.alloc(32, 17);
  const calls = [];
  const secrets = new Map();
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      calls.push({
        path: request.url,
        eventId: request.headers["webhook-id"],
        body: JSON.parse(body),
        verified: verifyWebhookSignature({
          body,
          headers: request.headers,
          now: new Date(),
          secret: secrets.get(request.url),
        }),
      });
      response.writeHead(204).end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await db.insert(schema.orgs).values([
      { id: orgId, name: "Webhook fanout" },
      { id: otherOrgId, name: "Other webhook tenant" },
    ]);
    await db.insert(schema.users).values({
      id: actorUserId, name: "Webhook operator", email: `${actorUserId}@example.org`,
    });
    await db.insert(schema.orgMembers).values([orgId, otherOrgId].map((id) => ({
      orgId: id, userId: actorUserId, role: "admin",
    })));
    await db.insert(schema.apiKeys).values({
      id: apiKeyId, orgId, createdByUserId: actorUserId, name: "Fanout test",
      environment: "test", keyHash: randomUUID(), keyId: randomUUID(),
    });
    const endpoints = [];
    for (const [path, tenant, enabled] of [
      ["/first", orgId, true], ["/second", orgId, true],
      ["/disabled", orgId, false], ["/other-tenant", otherOrgId, true],
    ]) {
      const result = await createWebhook({
        actorUserId, encryptionKey, orgId: tenant,
        payload: { url: `${baseUrl}${path}`, enabled },
      });
      secrets.set(path, result.signingSecret);
      if (tenant === orgId && enabled) endpoints.push(result.endpoint);
    }
    const deliveries = () => db.select().from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.orgId, orgId));
    const deliverOnce = async (rows) => {
      // Duplicate queue jobs race over the actual PostgreSQL claim lock.
      const results = await Promise.all(rows.flatMap((row) => [0, 1].map((i) =>
        processNextWebhook({
          deliveryId: row.id, encryptionKey, store: postgresWebhookStore,
          workerId: `fanout-${row.id}-${i}`,
        }),
      )));
      assert.equal(results.filter((result) => result.state === "delivered").length, rows.length);
      assert.equal(results.filter((result) => result.state === "idle").length, rows.length);
      assert.equal(calls.length, rows.length);
      assert.deepEqual(calls.map((call) => call.path).sort(), ["/first", "/second"]);
      assert.ok(calls.every((call) => call.verified));
      assert.equal(new Set(calls.map((call) => call.eventId)).size, 1);
      assert.ok((await deliveries()).every((row) => row.status === "delivered" && row.attemptCount === 1));
      assert.equal((await db.select().from(schema.webhookDeliveries)
        .where(eq(schema.webhookDeliveries.orgId, otherOrgId))).length, 0);
    };
    await run({
      db, eq, schema, endpoints, orgId, deliveries, deliverOnce, calls,
      receiveInboundEmail, queueEmail,
      principal: { actorUserId, apiKeyId, orgId, environment: "test", scopes: null },
    });
  } finally {
    await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
    await db.delete(schema.orgs).where(eq(schema.orgs.id, otherOrgId));
    await db.delete(schema.users).where(eq(schema.users.id, actorUserId));
    await new Promise((resolve) => server.close(resolve));
  }
}

test("PostgreSQL delivers received email to every enabled endpoint once despite concurrent replay", options, () => withEndpoints(async (f) => {
  const input = {
    principal: f.principal,
    payload: { from: "sender@example.org", to: ["reader@example.net"], subject: "Fanout", text: "hello", message_id: `<${randomUUID()}@example.org>` },
  };
  const results = await Promise.all([0, 1, 2].map(() => f.receiveInboundEmail(input)));
  assert.equal(new Set(results.map((row) => row.id)).size, 1);
  assert.equal(results.filter((row) => !row.replayed).length, 1);
  const rows = await f.deliveries();
  assert.equal(rows.length, 2, "each enabled endpoint needs its own inbound delivery");
  assert.deepEqual(rows.map((row) => row.endpointId).sort(), f.endpoints.map((endpoint) => endpoint.id).sort());
  assert.ok(rows.every((row) => row.receivedEmailId === results[0].id && row.eventId === null));
  await f.deliverOnce(rows);
  assert.ok(f.calls.every((call) => call.body.type === "email.received"));
  assert.equal((await f.receiveInboundEmail(input)).replayed, true);
  assert.equal((await f.deliveries()).length, 2);
  // A repeated source/endpoint pair is still rejected by PostgreSQL itself.
  const duplicate = { ...rows[0], id: randomUUID() };
  assert.equal((await f.db.insert(f.schema.webhookDeliveries).values(duplicate)
    .onConflictDoNothing().returning()).length, 0);
  assert.ok((await f.deliveries()).every((row) => row.status === "delivered" && row.attemptCount === 1));
}));

test("PostgreSQL fans outbound events to every enabled endpoint without aborting the send", options, () => withEndpoints(async (f) => {
  const input = {
    principal: f.principal, idempotencyKey: randomUUID(),
    payload: { from: "sender@example.org", to: ["reader@example.net"], subject: "Outbound fanout", text: "hello" },
  };
  const queued = await f.queueEmail(input);
  const rows = await f.deliveries();
  assert.equal(rows.length, 2, "each enabled endpoint needs its own event delivery");
  assert.deepEqual(rows.map((row) => row.endpointId).sort(), f.endpoints.map((endpoint) => endpoint.id).sort());
  assert.ok(rows.every((row) => row.eventId !== null && row.receivedEmailId === null));
  assert.equal(new Set(rows.map((row) => row.eventId)).size, 1);
  await f.deliverOnce(rows);
  assert.ok(f.calls.every((call) => call.body.type === "email.queued"));
  const replay = await f.queueEmail(input);
  assert.equal(replay.id, queued.id);
  assert.equal(replay.replayed, true);
  assert.equal((await f.deliveries()).length, 2);
  const duplicate = { ...rows[0], id: randomUUID() };
  assert.equal((await f.db.insert(f.schema.webhookDeliveries).values(duplicate)
    .onConflictDoNothing().returning()).length, 0);
}));
