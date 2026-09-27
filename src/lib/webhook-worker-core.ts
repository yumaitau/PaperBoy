import { lookup } from "node:dns/promises";
import {
  configuredWebhookEncryptionKey,
  decryptWebhookSigningSecret,
  isNonPublicAddress,
  signWebhook,
  webhookPrivateNetworksAllowed,
  WebhookError,
} from "@/lib/webhook-core";
import {
  DELIVERY_LEASE_MS,
  MAX_DELIVERY_ATTEMPTS,
  nextRetryAt,
} from "@/lib/worker-core";

export const WEBHOOK_HTTP_TIMEOUT_MS = 10_000;

export type WebhookClaim = {
  attemptCount: number;
  body: string;
  encryptedSecret: string;
  endpointId: string;
  eventId: string;
  id: string;
  orgId: string;
  url: string;
};

export type WebhookStore = {
  claim: (input: {
    deliveryId?: string;
    leaseExpiresAt: Date;
    now: Date;
    workerId: string;
  }) => Promise<WebhookClaim | null>;
  markDelivered: (input: {
    attemptCount: number;
    deliveryId: string;
    now: Date;
    responseStatus: number;
    workerId: string;
  }) => Promise<boolean>;
  markFailed: (input: {
    attemptCount: number;
    code: string;
    deliveryId: string;
    now: Date;
    reason: string;
    responseStatus: number | null;
    workerId: string;
  }) => Promise<boolean>;
  markRetry: (input: {
    attemptCount: number;
    code: string;
    deliveryId: string;
    nextAttemptAt: Date;
    now: Date;
    reason: string;
    responseStatus: number | null;
    workerId: string;
  }) => Promise<boolean>;
};

export type WebhookWorkerResult =
  | { state: "idle" }
  | {
      deliveryId: string;
      state: "delivered" | "failed" | "lease-lost" | "retry";
    };

type WebhookFailure = {
  code: string;
  reason: string;
  responseStatus: number | null;
  retryable: boolean;
};

export class WebhookDeliveryError extends Error {
  constructor(readonly failure: WebhookFailure) {
    super(failure.code);
    this.name = "WebhookDeliveryError";
  }
}

function httpFailure(status: number): WebhookDeliveryError {
  return new WebhookDeliveryError({
    code: `webhook_http_${status}`,
    reason: `Webhook endpoint returned ${status}.`,
    responseStatus: status,
    retryable: status >= 500,
  });
}

function deliveryFailure(error: unknown): WebhookFailure {
  if (error instanceof WebhookDeliveryError) {
    return error.failure;
  }

  if (error instanceof WebhookError) {
    return {
      code: "webhook_secret_unavailable",
      reason: "Webhook signing secret is unavailable.",
      responseStatus: null,
      retryable: true,
    };
  }

  return {
    code: "webhook_network_error",
    reason: "Webhook endpoint could not be reached.",
    responseStatus: null,
    retryable: true,
  };
}

async function resolveHost(hostname: string): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return [host];
  return (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
}

/**
 * Re-check the destination right before each delivery: the stored URL may
 * name a DNS host that resolves inward, or predate the save-time check.
 * (DNS can still change between this lookup and the connection; operators
 * should also restrict worker egress.)
 */
async function assertDeliverableDestination(
  url: string,
  resolve: (hostname: string) => Promise<string[]>,
): Promise<void> {
  if (webhookPrivateNetworksAllowed()) return;
  const { hostname } = new URL(url);
  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch {
    throw new WebhookDeliveryError({
      code: "webhook_network_error",
      reason: "Webhook endpoint could not be reached.",
      responseStatus: null,
      retryable: true,
    });
  }
  const devLoopbackOnly =
    process.env.NODE_ENV !== "production" &&
    addresses.every((address) => address === "::1" || address.startsWith("127."));
  if (!devLoopbackOnly && addresses.some(isNonPublicAddress)) {
    throw new WebhookDeliveryError({
      code: "webhook_destination_blocked",
      reason: "Webhook endpoint resolves to a private or reserved network address.",
      responseStatus: null,
      retryable: false,
    });
  }
}

export async function postWebhook(input: {
  claim: WebhookClaim;
  encryptionKey?: Buffer;
  fetch?: typeof fetch;
  now?: Date;
  resolve?: (hostname: string) => Promise<string[]>;
  timeoutMs?: number;
}): Promise<number> {
  await assertDeliverableDestination(input.claim.url, input.resolve ?? resolveHost);
  const now = input.now ?? new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const secret = decryptWebhookSigningSecret({
    context: {
      endpointId: input.claim.endpointId,
      orgId: input.claim.orgId,
    },
    encryptedSecret: input.claim.encryptedSecret,
    encryptionKey:
      input.encryptionKey ?? configuredWebhookEncryptionKey(),
  });
  const request = input.fetch ?? fetch;
  const response = await request(input.claim.url, {
    body: input.claim.body,
    headers: {
      "content-type": "application/json",
      "user-agent": "PaperBoy-Webhooks/1.0",
      "webhook-id": input.claim.eventId,
      "webhook-signature": signWebhook({
        body: input.claim.body,
        id: input.claim.eventId,
        secret,
        timestamp,
      }),
      "webhook-timestamp": String(timestamp),
    },
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(input.timeoutMs ?? WEBHOOK_HTTP_TIMEOUT_MS),
  });
  await response.body?.cancel();

  if (response.status >= 200 && response.status < 300) {
    return response.status;
  }

  throw httpFailure(response.status);
}

export async function processNextWebhook(input: {
  deliveryId?: string;
  encryptionKey?: Buffer;
  fetch?: typeof fetch;
  now?: () => Date;
  resolve?: (hostname: string) => Promise<string[]>;
  store: WebhookStore;
  workerId: string;
}): Promise<WebhookWorkerResult> {
  const now = input.now ?? (() => new Date());
  const claimedAt = now();
  const claim = await input.store.claim({
    ...(input.deliveryId ? { deliveryId: input.deliveryId } : {}),
    leaseExpiresAt: new Date(claimedAt.getTime() + DELIVERY_LEASE_MS),
    now: claimedAt,
    workerId: input.workerId,
  });

  if (!claim) {
    return { state: "idle" };
  }

  try {
    const responseStatus = await postWebhook({
      claim,
      encryptionKey: input.encryptionKey,
      fetch: input.fetch,
      now: claimedAt,
      resolve: input.resolve,
    });
    const updated = await input.store.markDelivered({
      attemptCount: claim.attemptCount,
      deliveryId: claim.id,
      now: now(),
      responseStatus,
      workerId: input.workerId,
    });
    return {
      deliveryId: claim.id,
      state: updated ? "delivered" : "lease-lost",
    };
  } catch (error) {
    const failure = deliveryFailure(error);
    const failedAt = now();

    if (failure.retryable && claim.attemptCount < MAX_DELIVERY_ATTEMPTS) {
      const updated = await input.store.markRetry({
        attemptCount: claim.attemptCount,
        code: failure.code,
        deliveryId: claim.id,
        nextAttemptAt: nextRetryAt(claim.attemptCount, failedAt),
        now: failedAt,
        reason: failure.reason,
        responseStatus: failure.responseStatus,
        workerId: input.workerId,
      });
      return {
        deliveryId: claim.id,
        state: updated ? "retry" : "lease-lost",
      };
    }

    const reason =
      failure.retryable && claim.attemptCount >= MAX_DELIVERY_ATTEMPTS
        ? `Retry limit reached after ${claim.attemptCount} attempts. ${failure.reason}`
        : failure.reason;
    const updated = await input.store.markFailed({
      attemptCount: claim.attemptCount,
      code: failure.code,
      deliveryId: claim.id,
      now: failedAt,
      reason: reason.slice(0, 1000),
      responseStatus: failure.responseStatus,
      workerId: input.workerId,
    });
    return {
      deliveryId: claim.id,
      state: updated ? "failed" : "lease-lost",
    };
  }
}
