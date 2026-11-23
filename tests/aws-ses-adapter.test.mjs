import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { simpleParser } from "mailparser";
import {
  GetAccountCommand,
  ListEmailIdentitiesCommand,
  SendBulkEmailCommand,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import {
  AWS_SES_MESSAGE_ID_TAG,
  createAwsSesAdapter,
  mapAwsSesEvent,
} from "../src/lib/aws-ses-adapter.ts";
import { AWS_SES_MAX_INLINE_DELAY_MS } from "../src/lib/aws-ses-quota.ts";
import { OutboundDeliveryError } from "../src/lib/worker-core.ts";

const messageId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const receivedAt = new Date("2026-08-24T01:06:00.000Z");
const configuration = {
  configurationSetName: "paperboy-events",
  credentials: {
    credentials: {
      accessKeyId: "TESTSESACCESSKEY01",
      secretAccessKey: "fixture-secret-access-key",
    },
    kind: "access-key",
  },
  region: "us-east-1",
  scope: "organization",
  snsTopicArn:
    "arn:aws:sns:us-east-1:123456789012:paperboy-ses-events",
};

async function fixture(name) {
  return JSON.parse(
    await readFile(
      new URL(`fixtures/providers/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
}

function message(overrides = {}) {
  return {
    attemptCount: 1,
    attachments: [
      {
        content: Buffer.from("fixture attachment"),
        contentType: "text/plain",
        filename: "fixture.txt",
      },
    ],
    deliveryMode: "live",
    environment: "live",
    from: "PaperBoy <news@example.com>",
    html: "<p>SES fixture</p>",
    id: messageId,
    orgId,
    provider: "aws-ses",
    subject: "Amazon SES fixture",
    text: "SES fixture",
    to: ["reader@example.net"],
    ...overrides,
  };
}

test("SES v2 SendEmail submits lossless raw MIME and stores the provider ID", async () => {
  const commands = [];
  const sendResponse = await fixture("aws-ses-send");
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return sendResponse;
      },
    },
    configuration,
    now: () => new Date("2026-08-24T01:00:00.000Z"),
  });

  const result = await adapter.send(
    message({
      bcc: ["Hidden copy <Hidden@Example.NET>", "audit@example.org"],
      cc: ["Copy <Copy@Example.NET>"],
    }),
  );
  assert.deepEqual(result, { providerMessageId: sendResponse.MessageId });
  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof SendEmailCommand);
  const input = commands[0].input;
  assert.equal(input.ConfigurationSetName, "paperboy-events");
  assert.equal(input.FromEmailAddress, "PaperBoy <news@example.com>");
  assert.deepEqual(input.Destination.ToAddresses, ["reader@example.net"]);
  assert.deepEqual(input.Destination.CcAddresses, ["copy@example.net"]);
  assert.deepEqual(input.Destination.BccAddresses, [
    "hidden@example.net", "audit@example.org",
  ]);
  assert.deepEqual(input.EmailTags, [
    { Name: AWS_SES_MESSAGE_ID_TAG, Value: messageId },
  ]);
  const raw = Buffer.from(input.Content.Raw.Data).toString("utf8");
  assert.match(
    raw,
    /X-PaperBoy-Message-ID: 11111111-1111-4111-8111-111111111111/i,
  );
  assert.match(raw, /filename=fixture\.txt/);
  assert.match(raw, /Amazon SES fixture/);
  const parsed = await simpleParser(input.Content.Raw.Data);
  assert.deepEqual(parsed.to.value.map(({ address }) => address), [
    "reader@example.net",
  ]);
  assert.deepEqual(parsed.cc.value.map(({ address }) => address.toLowerCase()), [
    "copy@example.net",
  ]);
  assert.equal(parsed.headers.has("bcc"), false);
  assert.doesNotMatch(raw, /^Bcc:/im);
  assert.doesNotMatch(raw, /hidden@example\.net|audit@example\.org/i);
});

test("SES v2 SendBulkEmail preserves input order and per-message tags", async () => {
  const commands = [];
  const bulkResponse = await fixture("aws-ses-bulk-send");
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return bulkResponse;
      },
    },
    configuration,
  });
  const secondId = "33333333-3333-4333-8333-333333333333";
  const results = await adapter.sendBatch([
    message(),
    message({
      id: secondId,
      subject: "Second subject with {{literal braces}}",
      text: "Second recipient body",
      to: ["second@example.net"],
    }),
  ]);

  assert.deepEqual(
    results.map((result) => result.providerMessageId),
    ["010001-ses-bulk-001", "010001-ses-bulk-002"],
  );
  assert.ok(commands[0] instanceof SendBulkEmailCommand);
  const input = commands[0].input;
  assert.equal(input.BulkEmailEntries.length, 2);
  assert.deepEqual(input.BulkEmailEntries[1].ReplacementTags, [
    { Name: AWS_SES_MESSAGE_ID_TAG, Value: secondId },
  ]);
  assert.deepEqual(input.BulkEmailEntries[1].Destination.ToAddresses, [
    "second@example.net",
  ]);
  const replacements = JSON.parse(
    input.BulkEmailEntries[1].ReplacementEmailContent.ReplacementTemplate
      .ReplacementTemplateData,
  );
  assert.equal(replacements.pb_subject, "Second subject with {{literal braces}}");
  assert.equal(input.DefaultContent.Template.Attachments[0].FileName, "fixture.txt");
});

test("SES connection tests surface regional sandbox state without credentials", async () => {
  const commands = [];
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return command instanceof GetAccountCommand
          ? {
              ProductionAccessEnabled: false,
              SendingEnabled: true,
            }
          : {
              EmailIdentities: [
                {
                  IdentityName: "YUMAIT.AU.",
                  IdentityType: "DOMAIN",
                  SendingEnabled: true,
                  VerificationStatus: "SUCCESS",
                },
                {
                  IdentityName: "rangeros.com.au",
                  IdentityType: "DOMAIN",
                  SendingEnabled: true,
                  VerificationStatus: "SUCCESS",
                },
                {
                  IdentityName: "pending.example",
                  IdentityType: "DOMAIN",
                  SendingEnabled: true,
                  VerificationStatus: "PENDING",
                },
                {
                  IdentityName: "sender@example.com",
                  IdentityType: "EMAIL_ADDRESS",
                  SendingEnabled: true,
                  VerificationStatus: "SUCCESS",
                },
              ],
            };
      },
    },
    configuration,
  });
  assert.deepEqual(await adapter.testConnection(), {
    accountMode: "sandbox",
    region: "us-east-1",
    sendingEnabled: true,
    verifiedDomains: ["rangeros.com.au", "yumait.au"],
  });
  assert.ok(commands[0] instanceof GetAccountCommand);
  assert.ok(commands[1] instanceof ListEmailIdentitiesCommand);
  assert.equal(JSON.stringify(await adapter.testConnection()).includes("secret"), false);
});

test("SES connection tests paginate every verified sending domain", async () => {
  const commands = [];
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        if (command instanceof GetAccountCommand) {
          return {
            ProductionAccessEnabled: true,
            SendingEnabled: true,
          };
        }
        return command.input.NextToken
          ? {
              EmailIdentities: [
                {
                  IdentityName: "yumait.au",
                  IdentityType: "DOMAIN",
                  SendingEnabled: true,
                  VerificationStatus: "SUCCESS",
                },
              ],
            }
          : {
              EmailIdentities: [
                {
                  IdentityName: "rangeros.com.au",
                  IdentityType: "DOMAIN",
                  SendingEnabled: true,
                  VerificationStatus: "SUCCESS",
                },
              ],
              NextToken: "page-2",
            };
      },
    },
    configuration,
  });

  assert.deepEqual(await adapter.testConnection(), {
    accountMode: "production",
    region: "us-east-1",
    sendingEnabled: true,
    verifiedDomains: ["rangeros.com.au", "yumait.au"],
  });
  const identityCommands = commands.filter(
    (command) => command instanceof ListEmailIdentitiesCommand,
  );
  assert.equal(identityCommands.length, 2);
  assert.equal(identityCommands[0].input.PageSize, 1_000);
  assert.equal(identityCommands[1].input.NextToken, "page-2");
});

test("SES delivery reserves recipient quota before sending and honors its distributed delay", async () => {
  const commands = [];
  const reservations = [];
  const sleeps = [];
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return command instanceof GetAccountCommand
          ? {
              ProductionAccessEnabled: true,
              SendQuota: {
                Max24HourSend: 50_000,
                MaxSendRate: 14,
                SentLast24Hours: 120,
              },
              SendingEnabled: true,
            }
          : { MessageId: "010001-quota-safe-send" };
      },
    },
    configuration,
    now: () => new Date("2026-08-24T01:00:00.000Z"),
    quotaGuard: {
      async reserve(input) {
        reservations.push(input);
        return {
          delayMs: 125,
          scheduledAt: new Date("2026-08-24T01:00:00.125Z"),
        };
      },
    },
    async sleep(delayMs) {
      sleeps.push(delayMs);
    },
  });

  await adapter.send(message());
  assert.equal(commands.length, 2);
  assert.ok(commands[0] instanceof GetAccountCommand);
  assert.ok(commands[1] instanceof SendEmailCommand);
  assert.equal(reservations[0].recipientCount, 1);
  assert.equal(reservations[0].snapshot.maxSendRate, 14);
  assert.equal(reservations[0].snapshot.max24HourSend, 50_000);
  assert.deepEqual(sleeps, [125]);
});

test("SES bulk delivery chunks at the safe recipient rate and preserves result order", async () => {
  const commands = [];
  const reservations = [];
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        if (command instanceof GetAccountCommand) {
          return {
            ProductionAccessEnabled: true,
            SendQuota: {
              Max24HourSend: 1_000,
              MaxSendRate: 2.5,
              SentLast24Hours: 0,
            },
            SendingEnabled: true,
          };
        }
        return {
          BulkEmailEntryResults: command.input.BulkEmailEntries.map(
            (entry, index) => ({
              MessageId: `ses-${entry.ReplacementTags[0].Value}-${index}`,
              Status: "SUCCESS",
            }),
          ),
        };
      },
    },
    configuration,
    quotaGuard: {
      async reserve(input) {
        reservations.push(input.recipientCount);
        return { delayMs: 0, scheduledAt: input.now };
      },
    },
  });
  const messages = Array.from({ length: 5 }, (_, index) =>
    message({
      id: `11111111-1111-4111-8111-11111111111${index}`,
      to: [`reader-${index}@example.net`],
    }),
  );

  const results = await adapter.sendBatch(messages);
  assert.deepEqual(reservations, [2, 2, 1]);
  assert.equal(
    commands.filter((command) => command instanceof SendBulkEmailCommand).length,
    3,
  );
  assert.equal(results.length, 5);
  assert.equal(results[0].providerMessageId.includes(messages[0].id), true);
  assert.equal(results[4].providerMessageId.includes(messages[4].id), true);
});

test("SES rolling quota defers without consuming delivery attempts", async () => {
  const commands = [];
  const retryAt = new Date("2026-08-24T01:01:00.000Z");
  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return {
          ProductionAccessEnabled: true,
          SendQuota: {
            Max24HourSend: 200,
            MaxSendRate: 1,
            SentLast24Hours: 200,
          },
          SendingEnabled: true,
        };
      },
    },
    configuration,
    quotaGuard: {
      async reserve() {
        return { retryAt };
      },
    },
  });

  await assert.rejects(
    adapter.send(message({ attemptCount: 5 })),
    (error) =>
      error instanceof OutboundDeliveryError &&
      error.code === "aws_ses_daily_quota_deferred" &&
      error.consumeAttempt === false &&
      error.retryAt?.getTime() === retryAt.getTime(),
  );
  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof GetAccountCommand);
});

test("SES HTTP and bulk quota throttles defer without consuming attempts", async () => {
  const retryBase = new Date("2026-08-24T01:00:00.000Z");
  const httpAdapter = createAwsSesAdapter({
    client: {
      async send() {
        const error = new Error("provider detail must not escape");
        error.$metadata = { httpStatusCode: 429 };
        throw error;
      },
    },
    configuration,
    now: () => retryBase,
  });
  await assert.rejects(
    httpAdapter.send(message()),
    (error) =>
      error instanceof OutboundDeliveryError &&
      error.code === "aws_ses_quota_throttled" &&
      error.consumeAttempt === false &&
      error.retryAt?.getTime() === retryBase.getTime() + 60_000,
  );

  const bulkAdapter = createAwsSesAdapter({
    client: {
      async send() {
        return {
          BulkEmailEntryResults: [
            { Status: "ACCOUNT_DAILY_QUOTA_EXCEEDED" },
          ],
        };
      },
    },
    configuration,
    now: () => retryBase,
  });
  await assert.rejects(
    bulkAdapter.sendBatch([message()]),
    (error) =>
      error instanceof OutboundDeliveryError &&
      error.code === "aws_ses_quota_throttled" &&
      error.consumeAttempt === false &&
      error.retryAt?.getTime() === retryBase.getTime() + 60_000,
  );
});

test("recorded SNS and EventBridge fixtures map to stable events and safe suppressions", async () => {
  const bounce = mapAwsSesEvent({
    payload: await fixture("aws-ses-sns-bounce"),
    receivedAt,
  });
  const complaint = mapAwsSesEvent({
    payload: await fixture("aws-ses-sns-complaint"),
    receivedAt,
  });
  const delivery = mapAwsSesEvent({
    payload: await fixture("aws-ses-sns-delivery"),
    receivedAt,
  });
  const delay = mapAwsSesEvent({
    payload: await fixture("aws-ses-eventbridge-delay"),
    receivedAt,
  });

  assert.equal(bounce[0].type, "bounced");
  assert.equal(bounce[0].messageId, messageId);
  assert.equal(bounce[0].providerMessageId, "010001-ses-message-fixture");
  assert.deepEqual(bounce[0].suppressions, [
    { email: "reader@example.net", reason: "bounced" },
  ]);
  assert.deepEqual(complaint[0].suppressions, [
    { email: "reader@example.net", reason: "complained" },
  ]);
  assert.equal(delivery[0].type, "delivered");
  assert.equal(delay[0].type, "deferred");
  assert.equal(delay[0].data.delay_type, "MailboxFull");
  assert.equal(JSON.stringify(bounce[0].data).includes("reader@example.net"), false);
  assert.equal(JSON.stringify(bounce[0].data).includes("smtp"), false);
});

test("SES validates envelope before reserving quota and never retries post-accept missing MessageId", async () => {
  let reserved = false;
  const invalidFromAdapter = createAwsSesAdapter({
    client: {
      async send() {
        throw new Error("should not call SES");
      },
    },
    configuration,
    quotaGuard: {
      async reserve() {
        reserved = true;
        return { delayMs: 0, scheduledAt: new Date() };
      },
    },
  });
  await assert.rejects(
    invalidFromAdapter.send(message({ from: "not-an-email" })),
    (error) =>
      error instanceof OutboundDeliveryError &&
      error.code === "invalid_envelope" &&
      error.retryable === false,
  );
  assert.equal(reserved, false);

  const missingIdAdapter = createAwsSesAdapter({
    client: {
      async send() {
        return {};
      },
    },
    configuration,
  });
  await assert.rejects(
    missingIdAdapter.send(message()),
    (error) =>
      error instanceof OutboundDeliveryError &&
      error.code === "aws_ses_invalid_response" &&
      error.retryable === false,
  );
});

test("SES quota reservations use a fresh nonce on retry and defer inline delays above the cap", async () => {
  const reservations = [];
  const sleeps = [];
  const commands = [];
  const scheduledAt = new Date("2026-08-24T01:00:10.000Z");
  let callIndex = 0;

  const adapter = createAwsSesAdapter({
    client: {
      async send(command) {
        commands.push(command);
        return command instanceof GetAccountCommand
          ? {
              ProductionAccessEnabled: true,
              SendQuota: {
                Max24HourSend: 50_000,
                MaxSendRate: 14,
                SentLast24Hours: 0,
              },
              SendingEnabled: true,
            }
          : { MessageId: "010001-nonce-send" };
      },
    },
    configuration,
    now: () => new Date("2026-08-24T01:00:00.000Z"),
    quotaGuard: {
      async reserve(input) {
        reservations.push(input);
        callIndex += 1;
        if (callIndex === 1) {
          return {
            delayMs: AWS_SES_MAX_INLINE_DELAY_MS + 1,
            scheduledAt,
          };
        }
        return {
          delayMs: 0,
          scheduledAt: input.now,
        };
      },
    },
    async sleep(delayMs) {
      sleeps.push(delayMs);
    },
  });

  const payload = message({ attemptCount: 1 });
  await assert.rejects(
    adapter.send(payload),
    (error) =>
      error instanceof OutboundDeliveryError &&
      error.code === "aws_ses_rate_quota_deferred" &&
      error.consumeAttempt === false &&
      error.retryable === true &&
      error.retryAt?.getTime() === scheduledAt.getTime(),
  );
  assert.deepEqual(sleeps, []);
  assert.equal(
    commands.filter((command) => command instanceof SendEmailCommand).length,
    0,
  );

  const result = await adapter.send(payload);
  assert.deepEqual(result, { providerMessageId: "010001-nonce-send" });
  assert.equal(reservations.length, 2);
  assert.match(reservations[0].reservationKey, /^[0-9a-f]{64}$/);
  assert.match(reservations[1].reservationKey, /^[0-9a-f]{64}$/);
  assert.notEqual(
    reservations[0].reservationKey,
    reservations[1].reservationKey,
  );
});
