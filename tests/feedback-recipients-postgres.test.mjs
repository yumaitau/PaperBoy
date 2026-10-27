import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

async function feedbackInput(provider, kind, messageId, recipient, providerMessageId) {
  if (provider === "smtp") {
    const fixtureName = kind === "bounce" ? "hard-bounce" : "complaint";
    const fixtureId = kind === "bounce"
      ? "11111111-1111-4111-8111-111111111111"
      : "33333333-3333-4333-8333-333333333333";
    const raw = await readFile(new URL(`fixtures/feedback/${fixtureName}.eml`, import.meta.url), "utf8");
    return { raw: Buffer.from(raw.replaceAll(fixtureId, messageId)
      .replaceAll(`${fixtureName}@example.net`, recipient)) };
  }
  const payload = JSON.parse(await readFile(
    new URL(`fixtures/providers/aws-ses-sns-${kind}.json`, import.meta.url), "utf8",
  ));
  const body = JSON.parse(payload.Message);
  payload.MessageId = randomUUID();
  body.mail.messageId = providerMessageId;
  body.mail.tags.paperboy_message_id = [messageId];
  const report = kind === "bounce" ? body.bounce : body.complaint;
  report.feedbackId = randomUUID();
  // Duplicates must not add suppressions, and an address outside the message
  // envelope must never acquire a suppression from this event.
  report[kind === "bounce" ? "bouncedRecipients" : "complainedRecipients"] = [
    recipient, recipient, "unrelated@example.net",
  ].map((emailAddress) => ({ emailAddress }));
  payload.Message = JSON.stringify(body);
  return { payload, provider };
}

for (const provider of ["smtp", "aws-ses"]) {
  test(`${provider} feedback suppresses only matching To, CC, and BCC recipients`, {
    skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
  }, async () => {
    process.env.DATABASE_URL = databaseUrl;
    const [
      { eq, inArray }, { db },
      { emailSuppressions, events, messages, orgMembers, orgs, users },
      { ingestFeedbackReport }, { ingestOutboundProviderEvent }, { queueEmail },
    ] = await Promise.all([
      import("drizzle-orm"), import("../src/db/index.ts"), import("../src/db/schema.ts"),
      import("../src/lib/feedback.ts"), import("../src/lib/outbound-provider-events.ts"),
      import("../src/lib/messages.ts"),
    ]);
    const orgId = randomUUID();
    const otherOrgId = randomUUID();
    const userId = `recipient-feedback-${randomUUID()}`;
    const ingest = provider === "smtp" ? ingestFeedbackReport : ingestOutboundProviderEvent;
    const expected = [];
    const messageIds = [];
    try {
      await db.insert(orgs).values([
        { id: orgId, name: "Recipient feedback" },
        { id: otherOrgId, name: "Other recipient feedback" },
      ]);
      await db.insert(users).values({
        id: userId, email: `${randomUUID()}@example.com`, name: "Feedback operator",
      });
      await db.insert(orgMembers).values([
        { orgId, userId, role: "admin" },
        { orgId: otherOrgId, userId, role: "admin" },
      ]);
      for (const field of ["to", "cc", "bcc"]) {
        for (const kind of ["bounce", "complaint"]) {
          const messageId = randomUUID();
          const providerMessageId = `provider-${randomUUID()}`;
          const recipient = `${kind}-${field}@example.net`;
          const recipients = {
            to: ["primary@example.net"], cc: [], bcc: [],
            [field]: [`Recipient <${recipient.toUpperCase()}>`],
          };
          await db.insert(messages).values({
            id: messageId, orgId, outboundProvider: provider, providerMessageId,
            deliveryMode: "live", environment: "live", status: "sent", sentAt: new Date(),
            from: "sender@example.com", subject: "Recipient feedback", textBody: "Body",
            ...recipients,
          });
          messageIds.push(messageId);
          const report = await feedbackInput(provider, kind, messageId, recipient, providerMessageId);
          const input = { actorUserId: userId, orgId, ...report };
          await assert.rejects(ingest({ ...input, orgId: otherOrgId }),
            (error) => error.code === "NO_MATCHING_MESSAGE");
          if (provider === "smtp") {
            await assert.rejects(ingest({
              ...input,
              raw: Buffer.from(report.raw.toString().replaceAll(recipient, "unrelated@example.net")),
            }), (error) => error.code === "NO_MATCHING_MESSAGE");
          }
          const [first] = await ingest(input);
          const [replay] = await ingest(input);
          assert.equal(first.messageId, messageId);
          assert.equal(first.replayed, false);
          assert.equal(replay.eventId, first.eventId);
          assert.equal(replay.replayed, true);
          if (provider === "smtp") {
            assert.equal(first.suppressed, true);
          } else {
            assert.equal(first.suppressionCount, 1);
            assert.equal(replay.suppressionCount, 1);
          }
          expected.push({ email: recipient, reason: kind === "bounce" ? "bounced" : "complained" });
          await assert.rejects(queueEmail({
            payload: { from: "sender@example.com", subject: "Blocked", text: "Body", ...recipients },
            principal: { actorUserId: userId, apiKeyId: null, environment: "test", orgId },
          }), (error) => error.code === "RECIPIENT_SUPPRESSED");
        }
      }
      const suppressions = await db.select({
        email: emailSuppressions.email, reason: emailSuppressions.reason,
      }).from(emailSuppressions).where(eq(emailSuppressions.orgId, orgId));
      const byEmail = (a, b) => a.email.localeCompare(b.email);
      assert.deepEqual(suppressions.sort(byEmail), expected.sort(byEmail));
      assert.deepEqual(await db.select().from(emailSuppressions)
        .where(eq(emailSuppressions.orgId, otherOrgId)), []);
      const timeline = await db.select({ type: events.type, data: events.data })
        .from(events).where(inArray(events.messageId, messageIds));
      assert.equal(timeline.length, 6);
      assert.deepEqual(timeline.map(({ type }) => type).sort(),
        ["bounced", "bounced", "bounced", "complained", "complained", "complained"]);
      assert.equal(JSON.stringify(timeline).includes("@example.net"), false);
    } finally {
      await db.delete(orgs).where(inArray(orgs.id, [orgId, otherOrgId]));
      await db.delete(users).where(eq(users.id, userId));
    }
  });
}
