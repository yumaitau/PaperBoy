import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
test("message reads, attachments, shares, and metrics respect key environment", { skip: !databaseUrl }, async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  const previousKey = process.env.PAPERBOY_SHARE_SIGNING_KEY;
  process.env.PAPERBOY_SHARE_SIGNING_KEY = Buffer.alloc(32, 7).toString("base64");
  const [{ db }, schema, { eq }, { messageApiServices: services }, { verifyShareToken }] = await Promise.all([
    import("../src/db/index.ts"), import("../src/db/schema.ts"), import("drizzle-orm"),
    import("../src/lib/message-api-services.ts"), import("../src/lib/share-links.ts"),
  ]);
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const userId = `environment-${randomUUID()}`;
  const records = Object.fromEntries(["live", "test", "foreign"].map((environment) => [environment, { id: randomUUID(), attachmentId: randomUUID() }]));
  const query = { start_date: "2026-08-23T00:00:00Z", end_date: "2026-08-24T00:00:00Z", metrics: "sent", dimensions: "email" };
  try {
    await db.insert(schema.orgs).values([{ id: orgId, name: "Environment test" }, { id: otherOrgId, name: "Other environment test" }]);
    await db.insert(schema.users).values({ id: userId, email: `${userId}@example.com`, name: "Environment tester" });
    await db.insert(schema.orgMembers).values({ orgId, userId, role: "admin" });
    for (const [environment, record] of Object.entries(records)) {
      const isTest = environment === "test";
      await db.insert(schema.messages).values({
        id: record.id,
        orgId: environment === "foreign" ? otherOrgId : orgId,
        environment: isTest ? "test" : "live",
        from: "sender@example.com", to: ["reader@example.com"],
        subject: environment, textBody: "fixture",
        deliveryMode: isTest ? "test-sink" : "live",
        outboundProvider: isTest ? "test-sink" : "smtp",
        status: "sent", sentAt: new Date("2026-08-23T12:00:00Z"),
        createdAt: new Date("2026-08-23T12:00:00Z"),
      });
      await db.insert(schema.messageAttachments).values({
        id: record.attachmentId, messageId: record.id, position: 0,
        filename: "report.txt", contentType: "text/plain", byteSize: 1,
        contentSha256: "0".repeat(64), storageKey: `environment-${randomUUID()}`,
      });
    }
    for (const environment of ["live", "test"]) {
      const principal = { actorUserId: userId, apiKeyId: randomUUID(), environment, orgId, scopes: ["messages.read", "emails.share", "emails.metrics"] };
      const allowed = records[environment];
      const calls = {
        detail: (row) => services.get(principal, row.id),
        events: (row) => services.listEvents(principal, row.id),
        attachments: (row) => services.listAttachments(principal, row.id),
        attachment: (row) => services.getAttachment(principal, row.id, row.attachmentId),
        download: (row) => services.attachmentDownloadUrl(principal, row.id, row.attachmentId, "https://paperboy.test"),
        share: (row) => services.share(principal, row.id, { origin: "https://paperboy.test" }),
      };
      for (const [name, call] of Object.entries(calls)) {
        await t.test(`${environment} key ${name} allows its environment only`, async () => {
          const result = await call(allowed);
          if (name === "download" || name === "share") {
            const url = new URL(result.url);
            const token = name === "download" ? url.searchParams.get("token") : url.pathname.split("/").at(-1);
            assert.equal(verifyShareToken({ token }).messageId, allowed.id);
          }
          for (const row of [records[environment === "live" ? "test" : "live"], records.foreign]) {
            await assert.rejects(() => call(row), (error) => error.code === "MESSAGE_NOT_FOUND");
          }
        });
      }
      await t.test(`${environment} key list and metrics exclude other environments`, async () => {
        assert.deepEqual((await services.list(principal, {})).messages.map((row) => row.id), [allowed.id]);
        const metrics = await services.metrics(principal, query);
        assert.deepEqual(metrics.data.map((row) => row.dimensions.email), [allowed.id]);
        assert.equal(metrics.totals.sent, 1);
        const totals = await services.metrics(principal, { ...query, dimensions: "" });
        assert.equal(totals.totals.sent, 1);
      });
    }
  } finally {
    await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
    await db.delete(schema.orgs).where(eq(schema.orgs.id, otherOrgId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    if (previousKey === undefined) delete process.env.PAPERBOY_SHARE_SIGNING_KEY;
    else process.env.PAPERBOY_SHARE_SIGNING_KEY = previousKey;
  }
});
