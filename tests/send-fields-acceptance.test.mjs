import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { simpleParser } from "mailparser";
import {
  AWS_SES_MESSAGE_ID_TAG,
  createAwsSesAdapter,
} from "../src/lib/aws-ses-adapter.ts";
import { parseSendEmailInput } from "../src/lib/email-core.ts";
import { prepareCloudflareEmailMessage } from "../src/lib/email-delivery.ts";
import { OutboundProviderConfigurationError } from "../src/lib/outbound-provider-configuration.ts";
import {
  createConfiguredOutboundProvider,
  createEnvironmentOutboundRouter,
} from "../src/lib/outbound-provider-runtime.ts";
import { createSmtpAdapter } from "../src/lib/smtp-adapter.ts";
import { processNextMessage } from "../src/lib/worker-core.ts";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const messageId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-27T01:00:00.000Z");

async function fixture() {
  const png = Buffer.from(
    (
      await readFile(
        new URL("./fixtures/sample.png.b64", import.meta.url),
        "utf8",
      )
    ).trim(),
    "base64",
  );
  const payload = {
    attachments: [
      {
        content: png.toString("base64"),
        content_id: "hero@example",
        content_type: "image/png",
        filename: "hero.png",
      },
    ],
    bcc: ["Hidden copy <Hidden@Example.NET>"],
    cc: ["Copy <Copy@Example.NET>"],
    from: "PaperBoy <news@example.com>",
    headers: { "X-Edition": "combined-fields" },
    html: '<p>Combined fields <img src="cid:hero@example" alt="Hero" /></p>',
    reply_to: ["Replies <reply@example.org>"],
    subject: "Combined send fields",
    tags: [{ name: "edition", value: "acceptance-fixture" }],
    text: "Combined fields with an inline image.",
    to: ["Reader <reader@example.net>"],
  };
  const parsed = parseSendEmailInput(payload);
  // User tags are application metadata, not MIME headers or worker fields.
  const {
    attachments,
    bcc,
    cc,
    from,
    headers,
    html,
    replyTo,
    subject,
    text,
    to,
  } = parsed;
  return {
    payload,
    parsed,
    png,
    delivery: {
      attachments,
      bcc,
      cc,
      from,
      headers,
      html,
      replyTo,
      subject,
      text,
      to,
    },
  };
}

async function assertMime(raw, data) {
  const parsed = await simpleParser(raw, { keepCidLinks: true });
  assert.deepEqual(parsed.to.value, [
    { address: "reader@example.net", name: "Reader" },
  ]);
  assert.deepEqual(
    parsed.cc.value.map(({ address }) => address.toLowerCase()),
    ["copy@example.net"],
  );
  assert.deepEqual(parsed.replyTo.value, [
    { address: "reply@example.org", name: "Replies" },
  ]);
  assert.equal(parsed.headers.get("x-edition"), "combined-fields");
  assert.equal(parsed.subject, data.delivery.subject);
  assert.equal(parsed.text.trim(), data.delivery.text);
  assert.equal(parsed.html, data.delivery.html);
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].filename, "hero.png");
  assert.equal(parsed.attachments[0].contentType, "image/png");
  assert.equal(parsed.attachments[0].contentDisposition, "inline");
  assert.equal(parsed.attachments[0].contentId, "<hero@example>");
  assert.deepEqual(parsed.attachments[0].content, data.png);
  assert.equal(parsed.bcc, undefined);
  assert.equal(parsed.headers.has("bcc"), false);
  assert.doesNotMatch(
    Buffer.from(raw).toString(),
    /hidden@example\.net|^Bcc:/im,
  );
}

async function deliverThroughWorker(adapter, provider, data) {
  let sent;
  const { attachments, ...fields } = data.delivery;
  const result = await processNextMessage({
    adapter,
    deliveryModes: ["live"],
    now: () => now,
    store: {
      async claim() {
        return {
          ...fields,
          attemptCount: 1,
          deliveryMode: "live",
          environment: "live",
          id: messageId,
          orgId,
          provider,
        };
      },
      async loadAttachments(id) {
        assert.equal(id, messageId);
        return attachments;
      },
      async markSent(input) {
        sent = input;
        return true;
      },
      async markFailed(input) {
        assert.fail(JSON.stringify(input));
      },
      async markRetry(input) {
        assert.fail(JSON.stringify(input));
      },
    },
    workerId: "combined-fields",
  });
  assert.deepEqual(result, { messageId, state: "sent" });
  assert.equal(sent.messageId, messageId);
  return sent;
}

async function loopbackSmtp() {
  const transactions = [];
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffered = "";
    let recipients = [];
    let data = null;
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffered += chunk;
      let end;
      while ((end = buffered.indexOf("\r\n")) !== -1) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        if (data !== null) {
          if (line === ".") {
            transactions.push({ recipients, raw: data.join("\r\n") });
            data = null;
            socket.write("250 queued\r\n");
          } else data.push(line.replace(/^\.\./, "."));
        } else if (line.startsWith("MAIL FROM:")) {
          recipients = [];
          socket.write("250 OK\r\n");
        } else if (line.startsWith("RCPT TO:")) {
          recipients.push(line.match(/<([^>]+)>/)[1]);
          socket.write("250 OK\r\n");
        } else if (line === "DATA") {
          data = [];
          socket.write("354 Send message\r\n");
        } else if (line === "QUIT") socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    transactions,
    url: `smtp://127.0.0.1:${server.address().port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

for (const provider of ["smtp", "cloudflare-email"]) {
  test(`${provider} sends combined fields through the worker and real loopback SMTP transport`, async () => {
    const data = await fixture();
    const smtp = await loopbackSmtp();
    // Inject only the local transport configuration; Cloudflare endpoint readiness
    // is tested separately. No Cloudflare credentials or API are used here.
    const adapter = createSmtpAdapter({
      environment: { SMTP_TLS_MODE: "disabled", SMTP_URL: smtp.url },
      now: () => now,
      provider,
    });
    try {
      const sent = await deliverThroughWorker(adapter, provider, data);
      assert.equal(typeof sent.providerMessageId, "string");
      assert.equal(smtp.transactions.length, 1);
      assert.deepEqual(smtp.transactions[0].recipients, [
        "reader@example.net",
        "copy@example.net",
        "hidden@example.net",
      ]);
      await assertMime(smtp.transactions[0].raw, data);
    } finally {
      adapter.close();
      await smtp.close();
    }
  });
}

test("SES sends the combined fields as raw MIME with envelope BCC and provider correlation tags", async () => {
  const data = await fixture();
  const commands = [];
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return { MessageId: "ses-fixture-receipt" };
      },
    },
    configuration: {
      configurationSetName: "paperboy-events",
      credentials: {
        kind: "access-key",
        credentials: {
          accessKeyId: "FIXTURE",
          secretAccessKey: "fixture-only",
        },
      },
      region: "us-east-1",
      scope: "organization",
      snsTopicArn: null,
    },
    now: () => now,
  });
  try {
    const sent = await deliverThroughWorker(adapter, "aws-ses", data);
    assert.equal(sent.providerMessageId, "ses-fixture-receipt");
    assert.equal(commands.length, 1);
    assert.ok(commands[0] instanceof SendEmailCommand);
    const input = commands[0].input;
    assert.equal(input.ConfigurationSetName, "paperboy-events");
    assert.deepEqual(input.Destination, {
      ToAddresses: ["reader@example.net"],
      CcAddresses: ["copy@example.net"],
      BccAddresses: ["hidden@example.net"],
    });
    // SES tags correlate provider events; caller tags stay in PaperBoy's log.
    assert.deepEqual(input.EmailTags, [
      { Name: AWS_SES_MESSAGE_ID_TAG, Value: messageId },
    ]);
    await assertMime(input.Content.Raw.Data, data);
  } finally {
    adapter.close();
  }
});

test("Cloudflare structured conversion preserves the same combined semantic fields", async () => {
  const data = await fixture();
  const payload = prepareCloudflareEmailMessage(data.delivery);
  assert.deepEqual(payload, {
    attachments: [
      {
        content: data.png.toString("base64"),
        content_id: "hero@example",
        disposition: "inline",
        filename: "hero.png",
        type: "image/png",
      },
    ],
    bcc: data.parsed.bcc,
    cc: data.parsed.cc,
    from: data.parsed.from,
    headers: { "X-Edition": "combined-fields" },
    html: data.parsed.html,
    reply_to: data.parsed.replyTo,
    subject: data.parsed.subject,
    text: data.parsed.text,
    to: data.parsed.to,
  });
  assert.equal("date" in payload, false);
  assert.equal("dkim" in payload, false);
});

test("Azure remains explicitly unavailable and never falls back to a configured SMTP adapter", async () => {
  const environment = {
    SMTP_URL: "smtp://127.0.0.1:1",
    SMTP_TLS_MODE: "disabled",
  };
  assert.throws(
    () =>
      createConfiguredOutboundProvider({
        environment,
        orgId,
        provider: "azure-email",
      }),
    (error) =>
      error instanceof OutboundProviderConfigurationError &&
      error.code === "ADAPTER_UNAVAILABLE",
  );
  const router = createEnvironmentOutboundRouter({ environment });
  try {
    const data = await fixture();
    await assert.rejects(
      router.send({
        ...data.delivery,
        attemptCount: 1,
        deliveryMode: "live",
        environment: "live",
        id: messageId,
        orgId,
        provider: "azure-email",
      }),
      (error) =>
        error.code === "provider_configuration_error" &&
        error.retryable === false,
    );
  } finally {
    router.close();
  }
});

test(
  "queue, detail, log search, and worker attachment delivery preserve the combined fields and metadata",
  {
    skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
  },
  async (t) => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    t.after(() => {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    });
    process.env.DATABASE_URL = databaseUrl;
    const [
      { eq },
      { db },
      { messages, orgMembers, orgs, users },
      { queueEmail },
      { getMessageDetail },
      { getMessageDeliveryOverview },
      { postgresWorkerStore },
      { attachmentStore: configuredAttachmentStore, createLocalAttachmentStore },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("../src/db/index.ts"),
      import("../src/db/schema.ts"),
      import("../src/lib/messages.ts"),
      import("../src/lib/message-events.ts"),
      import("../src/lib/message-statuses.ts"),
      import("../src/lib/postgres-worker-store.ts"),
      import("../src/lib/attachment-storage.ts"),
    ]);
    const tenantId = randomUUID();
    const actorUserId = `combined-fields-${randomUUID()}`;
    const storageRoot = await mkdtemp(join(tmpdir(), "paperboy-worker-attachments-"));
    t.after(() => rm(storageRoot, { recursive: true, force: true }));
    const attachmentStore = createLocalAttachmentStore(storageRoot);
    const data = await fixture();
    try {
      await db
        .insert(orgs)
        .values({
          id: tenantId,
          name: "Combined fields fixture",
          openTrackingEnabled: false,
        });
      await db
        .insert(users)
        .values({
          id: actorUserId,
          email: `${randomUUID()}@example.net`,
          name: "Fixture owner",
        });
      await db
        .insert(orgMembers)
        .values({ orgId: tenantId, userId: actorUserId, role: "owner" });
      const queued = await queueEmail({
        attachmentStore,
        payload: data.payload,
        principal: {
          actorUserId,
          apiKeyId: null,
          environment: "test",
          orgId: tenantId,
        },
        providerEnvironment: {},
      });
      assert.equal(queued.provider, "test-sink");
      const [stored] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, queued.id));
      for (const field of [
        "bcc",
        "cc",
        "from",
        "headers",
        "html",
        "replyTo",
        "subject",
        "tags",
        "to",
      ])
        assert.deepEqual(stored[field], data.parsed[field], field);
      assert.equal(stored.textBody, data.parsed.text);
      const detail = await getMessageDetail({
        actorUserId,
        environment: "test",
        messageId: queued.id,
        orgId: tenantId,
      });
      assert.deepEqual(detail.tags, data.parsed.tags);
      assert.deepEqual(detail.bcc, data.parsed.bcc);
      assert.deepEqual(detail.cc, data.parsed.cc);
      assert.deepEqual(detail.headers, data.parsed.headers);
      assert.equal(detail.attachments[0].contentId, "hero@example");
      const found = await getMessageDeliveryOverview({
        actorUserId,
        environment: "test",
        orgId: tenantId,
        query: "acceptance-fixture",
      });
      assert.deepEqual(
        found.messages.map(({ id }) => id),
        [queued.id],
      );
      const claimedAt = new Date(Date.now() + 1000);
      const claim = await postgresWorkerStore.claim({
        deliveryModes: ["test-sink"],
        messageId: queued.id,
        now: claimedAt,
        leaseExpiresAt: new Date(claimedAt.getTime() + 300_000),
        workerId: "combined-fields",
      });
      assert.ok(claim);
      for (const field of [
        "bcc",
        "cc",
        "from",
        "headers",
        "html",
        "replyTo",
        "subject",
        "text",
        "to",
      ])
        assert.deepEqual(claim[field], data.parsed[field], field);
      // Inject only the blob reader: exercise the real database loader and the
      // worker's attachment projection, without changing shared storage config.
      const previousRead = configuredAttachmentStore.read;
      let attachments;
      try {
        configuredAttachmentStore.read = attachmentStore.read;
        attachments = await postgresWorkerStore.loadAttachments(queued.id);
      } finally {
        configuredAttachmentStore.read = previousRead;
      }
      assert.equal(attachments.length, 1);
      assert.equal(attachments[0].contentId, "hero@example");
      assert.deepEqual(attachments[0].content, data.png);
      assert.equal(attachments[0].filename, "hero.png");
      assert.equal(attachments[0].contentType, "image/png");

      const smtp = await loopbackSmtp();
      let adapter;
      try {
        adapter = createSmtpAdapter({
          environment: { SMTP_TLS_MODE: "disabled", SMTP_URL: smtp.url },
          now: () => now,
        });
        // The queued test-sink claim supplies every message field; override only
        // routing so its persisted attachment also reaches real loopback MIME.
        await adapter.send({
          ...claim,
          attachments,
          deliveryMode: "live",
          provider: "smtp",
        });
        assert.equal(smtp.transactions.length, 1);
        assert.deepEqual(smtp.transactions[0].recipients, [
          "reader@example.net",
          "copy@example.net",
          "hidden@example.net",
        ]);
        await assertMime(smtp.transactions[0].raw, data);
      } finally {
        adapter?.close();
        await smtp.close();
      }
    } finally {
      await db.delete(orgs).where(eq(orgs.id, tenantId));
      await db.delete(users).where(eq(users.id, actorUserId));
    }
  },
);
