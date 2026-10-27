import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { setSystemTime } from "bun:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const cutoffVariable = "PAPERBOY_LEGACY_IDEMPOTENCY_BEFORE";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const payload = {
  from: "News <news@example.com>",
  to: ["reader@example.net"],
  cc: ["copy@example.net"],
  bcc: ["blind@example.net"],
  reply_to: ["replies@example.com"],
  headers: { "X-Campaign": "legacy" },
  subject: "Legacy replay regression",
  html: "<p>Original content</p>",
  text: "Original content",
  tags: [{ name: "campaign", value: "legacy" }],
};

// Independent, frozen v1 wire format for these already-normalized fixtures.
// Do not use the production parser or either production hash/matching helper:
// doing so would silently turn old records into whatever the new writer emits.
function canonicalFixture(body, scheduledAt) {
  return JSON.stringify({
    from: body.from,
    html: body.html ?? null,
    replyTo: body.reply_to ?? [],
    cc: body.cc ?? [],
    bcc: body.bcc ?? [],
    headers: body.headers ?? {},
    scheduledAt,
    subject: body.subject,
    tags: body.tags ?? [],
    text: body.text ?? null,
    to: typeof body.to === "string" ? [body.to] : body.to,
    ...(body.attachments?.length ? {
      attachments: body.attachments.map((attachment) => {
        const bytes = Buffer.from(attachment.content, "base64");
        return {
          contentId: attachment.content_id ?? null,
          contentSha256: sha256(bytes),
          contentType: attachment.content_type,
          filename: attachment.filename,
          size: bytes.length,
        };
      }),
    } : {}),
  });
}

function legacyIdentity(body, createdAt) {
  const requested = body.scheduled_at ? new Date(body.scheduled_at) : null;
  const scheduledAt = requested && requested.getTime() > createdAt.getTime() + 60_000
    ? requested.toISOString()
    : null;
  return {
    requestHash: sha256(canonicalFixture(body, scheduledAt)),
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  };
}

function expectedV2Hash(body) {
  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;
  return sha256(`paperboy:email-request:v2\0${canonicalFixture(body, scheduledAt)}`);
}

async function bounded(promise, label, milliseconds = 5_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test(
  "legacy PostgreSQL idempotency preserves old rows, bounds compatibility, and keeps v2 strict",
  { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured", timeout: 60_000 },
  async (t) => {
    process.env.DATABASE_URL = databaseUrl;
    const previousCutoff = process.env[cutoffVariable];
    const previousDispatch = process.env.PAPERBOY_INLINE_JOB_DISPATCH;
    const [
      { and, eq, sql },
      { drizzle },
      { db },
      schema,
      { generateApiKey },
      { handleSendEmailRequest },
      { queueEmail },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("drizzle-orm/bun-sql"),
      import("../src/db/index.ts"),
      import("../src/db/schema.ts"),
      import("../src/lib/api-key-crypto.ts"),
      import("../src/lib/email-http.ts"),
      import("../src/lib/messages.ts"),
    ]);
    const { apiKeys, emailSuppressions, events, messageAttachments, messages, orgMembers, orgs, users } = schema;
    const orgId = randomUUID();
    const userId = `legacy-idempotency-${randomUUID()}`;
    const credentials = [generateApiKey("test"), generateApiKey("test")];
    const principals = credentials.map(() => ({
      actorUserId: userId,
      apiKeyId: randomUUID(),
      environment: "test",
      orgId,
    }));
    const attachmentStore = {
      put: async () => assert.fail("A replay must not write attachment bytes"),
      get: async () => assert.fail("A replay must not read attachment bytes"),
      delete: async () => assert.fail("A replay must not delete attachment bytes"),
    };
    const queue = (body, key, principal = principals[0]) => queueEmail({
      attachmentStore,
      idempotencyKey: key,
      payload: body,
      principal,
    });
    const dependencies = {
      authenticate: async (request) => {
        const token = request.headers.get("authorization");
        const index = credentials.findIndex((entry) => token === `Bearer ${entry.rawKey}`);
        return principals[index] ?? null;
      },
      queue: (input) => queueEmail({ ...input, attachmentStore }),
    };
    async function send(body, key, keyIndex = 0, keyInBody = false) {
      const response = await handleSendEmailRequest(new Request("https://paperboy.test/api/v1/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials[keyIndex].rawKey}`,
          "Content-Type": "application/json",
          ...(keyInBody ? {} : { "Idempotency-Key": key }),
        },
        body: JSON.stringify(keyInBody ? { ...body, idempotency_key: key } : body),
      }), dependencies);
      return { status: response.status, body: await response.json() };
    }
    function expectHttp(result, status, idOrCode) {
      assert.equal(result.status, status, JSON.stringify(result.body));
      if (status === 200) assert.deepEqual(result.body, { id: idOrCode });
      else assert.equal(result.body.error.code, idOrCode);
    }

    // JSON is produced by PostgreSQL so full timestamp precision and every
    // column survive the comparison, including fields outside the queue API.
    async function snapshot(executor = db) {
      const rows = await executor.execute(sql`
        SELECT to_jsonb(m) AS value FROM messages m
        WHERE m.org_id = ${orgId} ORDER BY m.id
      `);
      const history = await executor.execute(sql`
        SELECT to_jsonb(e) AS value FROM events e
        JOIN messages m ON m.id = e.message_id
        WHERE m.org_id = ${orgId} ORDER BY e.sequence
      `);
      const attachments = await executor.execute(sql`
        SELECT to_jsonb(a) AS value FROM message_attachments a
        JOIN messages m ON m.id = a.message_id
        WHERE m.org_id = ${orgId} ORDER BY a.message_id, a.position
      `);
      return {
        rows: rows.map((row) => row.value),
        events: history.map((row) => row.value),
        attachments: attachments.map((row) => row.value),
      };
    }

    let base;
    const at = (offset) => new Date(base.getTime() + offset);
    const withSchedule = (offset) => ({ ...payload, scheduled_at: at(offset).toISOString() });
    async function seedLegacy(body, { executor = db, createdAt = base, key = `legacy-${randomUUID()}` } = {}) {
      const id = randomUUID();
      const identity = legacyIdentity(body, createdAt);
      await executor.insert(messages).values({
        id,
        orgId,
        apiKeyId: principals[0].apiKeyId,
        from: body.from,
        to: typeof body.to === "string" ? [body.to] : body.to,
        cc: body.cc ?? [],
        bcc: body.bcc ?? [],
        replyTo: body.reply_to ?? [],
        headers: body.headers ?? {},
        subject: body.subject,
        html: body.html ?? null,
        textBody: body.text ?? null,
        tags: body.tags ?? [],
        environment: "test",
        deliveryMode: "test-sink",
        outboundProvider: "test-sink",
        idempotencyKey: key,
        ...identity,
        nextAttemptAt: identity.scheduledAt ?? createdAt,
        createdAt,
        updatedAt: createdAt,
      });
      await executor.insert(events).values([
        { messageId: id, type: "queued", data: {}, createdAt },
        ...(identity.scheduledAt ? [{
          messageId: id,
          type: "scheduled",
          data: { scheduled_at: identity.scheduledAt.toISOString() },
          createdAt,
        }] : []),
      ]);
      for (const [position, attachment] of (body.attachments ?? []).entries()) {
        const bytes = Buffer.from(attachment.content, "base64");
        await executor.insert(messageAttachments).values({
          messageId: id,
          position,
          filename: attachment.filename,
          contentType: attachment.content_type,
          contentId: attachment.content_id ?? null,
          byteSize: bytes.length,
          contentSha256: sha256(bytes),
          storageKey: `legacy-test/${id}/${position}`,
          createdAt,
        });
      }
      return { id, key, ...identity };
    }

    // An uncommitted INSERT is invisible to the initial replay SELECT. Observe
    // the contender waiting on its transaction-id lock at INSERT, then COMMIT:
    // PostgreSQL must raise 23505 and queueEmail must take its recovery path.
    async function raceLegacy(original, retry, status, options = {}) {
      const writer = await db.$client.reserve();
      const writerDb = drizzle(writer, { schema });
      let pending;
      let contenderPid;
      let committed = false;
      try {
        await writer`BEGIN`;
        await writer`SET LOCAL idle_in_transaction_session_timeout = '15s'`;
        const [{ pid }] = await writer`SELECT pg_backend_pid() AS pid`;
        const seeded = await seedLegacy(original, { ...options, executor: writerDb });
        const before = await snapshot(writerDb);
        assert.equal((await db.select({ id: messages.id }).from(messages).where(eq(messages.id, seeded.id))).length, 0);
        let settled = false;
        pending = send(retry, seeded.key).then(
          (value) => { settled = true; return { value }; },
          (error) => { settled = true; return { error }; },
        );
        const deadline = performance.now() + 5_000;
        while (performance.now() < deadline) {
          const blocked = await db.$client`
            SELECT a.pid FROM pg_stat_activity a
            WHERE a.datname = current_database()
              AND ${pid} = ANY(pg_blocking_pids(a.pid))
              AND a.wait_event_type = 'Lock'
              AND a.query LIKE 'insert into "messages"%'
              AND EXISTS (
                SELECT 1 FROM pg_locks l
                WHERE l.pid = a.pid AND l.locktype = 'transactionid' AND NOT l.granted
              )
          `;
          if (blocked.length) {
            assert.equal(blocked.length, 1);
            contenderPid = blocked[0].pid;
            break;
          }
          assert.equal(settled, false, "Contender finished without reaching the unique-index wait");
          await delay(10);
        }
        assert.ok(contenderPid, "Contender did not block on the legacy INSERT within 5 seconds");
        await writer`COMMIT`;
        committed = true;
        const outcome = await bounded(pending, "Unique-violation recovery");
        if (outcome.error) throw outcome.error;
        expectHttp(outcome.value, status, status === 200 ? seeded.id : "idempotency_conflict");
        assert.deepEqual(await snapshot(), before, "Race recovery changed the legacy row/events or queued a duplicate");
      } finally {
        try {
          if (!committed) await writer`ROLLBACK`;
        } finally {
          writer.release();
        }
        if (pending) {
          try {
            await bounded(pending, "Contender cleanup");
          } catch (error) {
            if (contenderPid) await db.$client`SELECT pg_cancel_backend(${contenderPid})`;
            throw error;
          }
        }
      }
    }

    const integrationLock = await db.$client.reserve();
    await integrationLock`SELECT pg_advisory_lock(${190029})`;
    try {
      process.env.PAPERBOY_INLINE_JOB_DISPATCH = "false";
      const [{ now }] = await db.$client`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
      base = new Date(now);
      setSystemTime(base);
      process.env[cutoffVariable] = at(1_000).toISOString();
      await db.insert(orgs).values({ id: orgId, name: "Legacy idempotency regression", testRateLimitPerMinute: 100_000 });
      await db.insert(users).values({ id: userId, email: `${randomUUID()}@example.com`, name: "Legacy operator", timezone: "UTC" });
      await db.insert(orgMembers).values({ orgId, userId, role: "admin" });
      await db.insert(apiKeys).values(credentials.map((credential, index) => ({
        id: principals[index].apiKeyId,
        orgId,
        createdByUserId: userId,
        environment: "test",
        name: `Legacy test key ${index}`,
        keyHash: credential.keyHash,
        keyId: credential.keyId,
      })));

      await t.test("real v1 omitted, near, past, and future hashes replay through queue and HTTP without any mutations", async () => {
        for (const body of [payload, withSchedule(30_000), withSchedule(-30_000), withSchedule(3_600_000)]) {
          const seeded = await seedLegacy(body);
          assert.match(seeded.requestHash, /^[a-f0-9]{64}$/);
          assert.notEqual(seeded.requestHash, expectedV2Hash(body));
          const before = await snapshot();
          const queued = await queue(body, seeded.key);
          assert.equal(queued.id, seeded.id);
          assert.equal(queued.replayed, true);
          assert.equal(queued.createdAt.toISOString(), base.toISOString());
          expectHttp(await send(body, seeded.key, 0, true), 200, seeded.id);
          assert.deepEqual(await snapshot(), before);
        }
      });

      await t.test("legacy null schedule equivalence ends at creation + 60 seconds and waiting cannot widen it", async () => {
        const seeded = await seedLegacy(withSchedule(30_000));
        const before = await snapshot();
        try {
          for (const elapsed of [0, 3_600_000]) {
            setSystemTime(at(elapsed));
            for (const body of [payload, withSchedule(-30_000), withSchedule(30_000), withSchedule(59_999), withSchedule(60_000)]) {
              expectHttp(await send(body, seeded.key), 200, seeded.id);
            }
            for (const offset of [60_001, 120_000]) {
              expectHttp(await send(withSchedule(offset), seeded.key), 409, "idempotency_conflict");
            }
          }
          assert.deepEqual(await snapshot(), before);
        } finally {
          setSystemTime(base);
        }
      });

      await t.test("legacy future schedules require exact identity even after delivery time passes", async () => {
        const original = withSchedule(120_000);
        const seeded = await seedLegacy(original);
        const before = await snapshot();
        try {
          for (const elapsed of [0, 180_000]) {
            setSystemTime(at(elapsed));
            expectHttp(await send(original, seeded.key), 200, seeded.id);
            for (const changed of [payload, withSchedule(30_000), withSchedule(120_001)]) {
              expectHttp(await send(changed, seeded.key), 409, "idempotency_conflict");
            }
          }
          assert.deepEqual(await snapshot(), before);
        } finally {
          setSystemTime(base);
        }
      });

      await t.test("every canonical field and attachment identity still conflicts for legacy replays", async () => {
        const attachment = {
          content: Buffer.from("original bytes").toString("base64"),
          filename: "original.txt",
          content_type: "text/plain",
          content_id: "original-cid",
        };
        const original = { ...withSchedule(30_000), attachments: [attachment] };
        const seeded = await seedLegacy(original);
        const before = await snapshot();
        expectHttp(await send(original, seeded.key), 200, seeded.id);
        const changes = [
          ["from", { from: "Other <other@example.com>" }],
          ["html", { html: "<p>Changed</p>" }],
          ["replyTo", { reply_to: ["other@example.com"] }],
          ["cc", { cc: ["other-copy@example.net"] }],
          ["bcc", { bcc: ["other-blind@example.net"] }],
          ["headers", { headers: { "X-Campaign": "changed" } }],
          ["scheduledAt", { scheduled_at: at(60_001).toISOString() }],
          ["subject", { subject: "Changed" }],
          ["tags.name", { tags: [{ name: "changed", value: "legacy" }] }],
          ["tags.value", { tags: [{ name: "campaign", value: "changed" }] }],
          ["text", { text: "Changed" }],
          ["to", { to: ["other-reader@example.net"] }],
          ["attachments removed", { attachments: [] }],
          ["attachments added", { attachments: [attachment, { ...attachment, filename: "second.txt" }] }],
          ...[
            ["contentId", { content_id: "changed-cid" }],
            ["contentSha256", { content: Buffer.from("different byte").toString("base64") }],
            ["size", { content: Buffer.from("more bytes than before").toString("base64") }],
            ["contentType", { content_type: "application/octet-stream" }],
            ["filename", { filename: "changed.txt" }],
          ].map(([name, change]) => [`attachments.${name}`, { attachments: [{ ...attachment, ...change }] }]),
        ];
        for (const [field, change] of changes) {
          const result = await send({ ...original, ...change }, seeded.key);
          assert.equal(result.status, 409, `${field}: ${JSON.stringify(result.body)}`);
          assert.equal(result.body.error.code, "idempotency_conflict", field);
          assert.deepEqual(await snapshot(), before, `${field} mutated stored data`);
        }
      });

      await t.test("all new writes use v2 and omitted/near/past schedules conflict in every direction", async () => {
        const bodies = [payload, withSchedule(30_000), withSchedule(-30_000)];
        for (const [index, original] of bodies.entries()) {
          const key = `strict-${randomUUID()}`;
          const queued = await queue(original, key);
          assert.equal(queued.replayed, false);
          const [stored] = await db.select().from(messages).where(eq(messages.id, queued.id));
          assert.equal(stored.requestHash, expectedV2Hash(original));
          assert.equal(stored.scheduledAt, null);
          const before = await snapshot();
          try {
            for (const elapsed of [0, 180_000]) {
              setSystemTime(at(elapsed));
              expectHttp(await send(original, key), 200, queued.id);
              for (const [otherIndex, changed] of bodies.entries()) {
                if (index !== otherIndex) expectHttp(await send(changed, key), 409, "idempotency_conflict");
              }
              if (original.scheduled_at) {
                const changed = { ...original, scheduled_at: new Date(new Date(original.scheduled_at).getTime() + 1).toISOString() };
                expectHttp(await send(changed, key), 409, "idempotency_conflict");
              }
            }
            assert.deepEqual(await snapshot(), before);
          } finally {
            setSystemTime(base);
          }
        }
      });

      await t.test("missing or invalid cutoffs fail closed for fallback but allow exact legacy matches", async () => {
        const omitted = await seedLegacy(payload);
        const futureBody = withSchedule(120_000);
        const future = await seedLegacy(futureBody);
        const before = await snapshot();
        try {
          const eligibleCutoff = at(1_000).toISOString();
          for (const cutoff of [undefined, "", "not-a-date", eligibleCutoff.replace(/\.\d{3}Z$/, "Z"), eligibleCutoff.replace(/Z$/, "+00:00")]) {
            if (cutoff === undefined) delete process.env[cutoffVariable];
            else process.env[cutoffVariable] = cutoff;
            expectHttp(await send(payload, omitted.key), 200, omitted.id);
            expectHttp(await send(futureBody, future.key), 200, future.id);
            expectHttp(await send(withSchedule(30_000), omitted.key), 409, "idempotency_conflict");
            expectHttp(await send(withSchedule(-30_000), omitted.key), 409, "idempotency_conflict");
          }
          assert.deepEqual(await snapshot(), before);
        } finally {
          process.env[cutoffVariable] = at(1_000).toISOString();
        }
      });

      await t.test("the cutoff excludes #72 unversioned unscheduled rows at and after its exact instant", async () => {
        process.env[cutoffVariable] = base.toISOString();
        try {
          for (const offset of [-1, 0, 1]) {
            const seeded = await seedLegacy(payload, { createdAt: at(offset) });
            const before = await snapshot();
            expectHttp(await send(payload, seeded.key), 200, seeded.id);
            for (const body of [withSchedule(30_000), withSchedule(-30_000)]) {
              expectHttp(await send(body, seeded.key), offset < 0 ? 200 : 409, offset < 0 ? seeded.id : "idempotency_conflict");
            }
            assert.deepEqual(await snapshot(), before);
          }
        } finally {
          process.env[cutoffVariable] = at(1_000).toISOString();
        }
      });

      await t.test("legacy replay is API-key scoped and preserves suppression and creator authorization", async () => {
        const seeded = await seedLegacy(withSchedule(30_000));
        const otherBody = { ...payload, subject: "Independent key" };
        const other = await send(otherBody, seeded.key, 1);
        assert.equal(other.status, 200);
        assert.notEqual(other.body.id, seeded.id);
        expectHttp(await send(withSchedule(30_000), seeded.key), 200, seeded.id);
        expectHttp(await send(otherBody, seeded.key, 1), 200, other.body.id);
        const before = await snapshot();
        for (const email of [payload.to[0], payload.cc[0], payload.bcc[0]]) {
          const [suppression] = await db.insert(emailSuppressions).values({ orgId, email, reason: "manual" }).returning();
          try {
            expectHttp(await send(withSchedule(30_000), seeded.key), 422, "recipient_suppressed");
          } finally {
            await db.delete(emailSuppressions).where(eq(emailSuppressions.id, suppression.id));
          }
        }
        try {
          await db.update(orgMembers).set({ role: "member" }).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
          expectHttp(await send(withSchedule(30_000), seeded.key), 403, "forbidden");
          await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
          expectHttp(await send(withSchedule(30_000), seeded.key), 403, "forbidden");
        } finally {
          await db.insert(orgMembers).values({ orgId, userId, role: "admin" }).onConflictDoUpdate({ target: [orgMembers.orgId, orgMembers.userId], set: { role: "admin" } });
        }
        expectHttp(await send(withSchedule(30_000), seeded.key), 200, seeded.id);
        assert.deepEqual(await snapshot(), before);
      });

      await t.test("legacy TTL expires according to PostgreSQL time without renewing it on replay", async () => {
        const seeded = await seedLegacy(payload);
        await db.update(messages).set({ createdAt: sql`now() - interval '24 hours' + interval '1 minute'` }).where(eq(messages.id, seeded.id));
        const active = await snapshot();
        expectHttp(await send(payload, seeded.key), 200, seeded.id);
        assert.deepEqual(await snapshot(), active);
        // Set exactly 24h old at this SQL statement's clock. The later HTTP
        // lookup is necessarily at or beyond the boundary, not a frozen PG now.
        await db.update(messages).set({ createdAt: sql`now() - interval '24 hours'` }).where(eq(messages.id, seeded.id));
        const beforeExpiry = await snapshot();
        const changed = { ...payload, subject: "Reuse expired legacy key" };
        const replacement = await send(changed, seeded.key);
        assert.equal(replacement.status, 200);
        assert.notEqual(replacement.body.id, seeded.id);
        const afterExpiry = await snapshot();
        assert.deepEqual(afterExpiry.rows.find((row) => row.id === seeded.id), {
          ...beforeExpiry.rows.find((row) => row.id === seeded.id),
          idempotency_key: null,
          request_hash: null,
        });
        assert.deepEqual(afterExpiry.events.filter((event) => event.message_id === seeded.id), beforeExpiry.events.filter((event) => event.message_id === seeded.id));
        assert.equal(afterExpiry.rows.filter((row) => row.api_key_id === principals[0].apiKeyId && row.idempotency_key === seeded.key).length, 1);
        assert.equal(afterExpiry.rows.find((row) => row.id === replacement.body.id).request_hash, expectedV2Hash(changed));
        expectHttp(await send(changed, seeded.key), 200, replacement.body.id);
      });

      await t.test("PostgreSQL unique-violation recovery applies the same legacy and cutoff rules", async () => {
        for (const body of [payload, withSchedule(30_000), withSchedule(-30_000), withSchedule(120_000)]) {
          await raceLegacy(body, body, 200);
        }
        await raceLegacy(payload, withSchedule(60_000), 200);
        await raceLegacy(payload, withSchedule(60_001), 409);
        await raceLegacy(payload, { ...withSchedule(30_000), subject: "Conflicting race" }, 409);
        try {
          setSystemTime(at(180_000));
          await raceLegacy(payload, withSchedule(60_001), 409);
        } finally {
          setSystemTime(base);
        }
        try {
          delete process.env[cutoffVariable];
          await raceLegacy(payload, payload, 200);
          await raceLegacy(payload, withSchedule(30_000), 409);
          process.env[cutoffVariable] = "invalid";
          await raceLegacy(payload, withSchedule(-30_000), 409);
          process.env[cutoffVariable] = base.toISOString();
          await raceLegacy(payload, withSchedule(30_000), 409);
          await raceLegacy(payload, withSchedule(-30_000), 409, { createdAt: at(1) });
        } finally {
          process.env[cutoffVariable] = at(1_000).toISOString();
        }
      });
    } finally {
      setSystemTime();
      if (previousCutoff === undefined) delete process.env[cutoffVariable];
      else process.env[cutoffVariable] = previousCutoff;
      if (previousDispatch === undefined) delete process.env.PAPERBOY_INLINE_JOB_DISPATCH;
      else process.env.PAPERBOY_INLINE_JOB_DISPATCH = previousDispatch;
      try {
        await db.delete(orgs).where(eq(orgs.id, orgId));
        await db.delete(users).where(eq(users.id, userId));
      } finally {
        await integrationLock`SELECT pg_advisory_unlock(${190029})`;
        integrationLock.release();
      }
    }
  },
);
