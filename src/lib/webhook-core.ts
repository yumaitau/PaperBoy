import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { parseEmailAddressField } from "@/lib/email-core";
import type { MessageEventType } from "@/lib/message-event-core";

function webhookAddress(value: string): string {
  return parseEmailAddressField(value)?.address ?? value;
}

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_AAD_PREFIX = "paperboy:webhook-secret:v1";

export const WEBHOOK_DELIVERY_STATUSES = [
  "queued",
  "sending",
  "delivered",
  "failed",
] as const;
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
export const WEBHOOK_URL_MAX_LENGTH = 2_048;

export type WebhookDeliveryStatus =
  (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export type WebhookErrorCode =
  | "CONFIGURATION_INVALID"
  | "ENDPOINT_DISABLED"
  | "EVENT_NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_URL"
  | "MEMBERSHIP_REQUIRED"
  | "SECRET_UNAVAILABLE"
  | "WEBHOOK_NOT_FOUND";

export class WebhookError extends Error {
  constructor(readonly code: WebhookErrorCode) {
    super(code);
    this.name = "WebhookError";
  }
}

type WebhookSecretContext = {
  endpointId: string;
  orgId: string;
};

function encryptionAad(context: WebhookSecretContext): Buffer {
  return Buffer.from(
    `${ENCRYPTION_AAD_PREFIX}:${context.orgId}:${context.endpointId}`,
    "utf8",
  );
}

function decodeSigningSecret(secret: string): Buffer {
  if (!secret.startsWith("whsec_")) {
    throw new WebhookError("SECRET_UNAVAILABLE");
  }

  const encoded = secret.slice("whsec_".length);

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new WebhookError("SECRET_UNAVAILABLE");
  }

  const decoded = Buffer.from(encoded, "base64");

  if (decoded.length < 16 || decoded.length > 64) {
    throw new WebhookError("SECRET_UNAVAILABLE");
  }

  return decoded;
}

export function createWebhookSigningSecret(): string {
  return `whsec_${randomBytes(32).toString("base64")}`;
}

export function parseWebhookEncryptionKey(value: unknown): Buffer {
  if (typeof value !== "string") {
    throw new WebhookError("CONFIGURATION_INVALID");
  }

  const encoded = value.trim();

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded)) {
    throw new WebhookError("CONFIGURATION_INVALID");
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new WebhookError("CONFIGURATION_INVALID");
  }

  return key;
}

export function configuredWebhookEncryptionKey(): Buffer {
  return parseWebhookEncryptionKey(
    process.env.PAPERBOY_WEBHOOK_ENCRYPTION_KEY,
  );
}

export function encryptWebhookSigningSecret(input: {
  context: WebhookSecretContext;
  encryptionKey: Buffer;
  secret: string;
}): string {
  decodeSigningSecret(input.secret);

  if (input.encryptionKey.length !== 32) {
    throw new WebhookError("CONFIGURATION_INVALID");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(
    ENCRYPTION_ALGORITHM,
    input.encryptionKey,
    iv,
  );
  cipher.setAAD(encryptionAad(input.context));
  const ciphertext = Buffer.concat([
    cipher.update(input.secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptWebhookSigningSecret(input: {
  context: WebhookSecretContext;
  encryptedSecret: string;
  encryptionKey: Buffer;
}): string {
  if (input.encryptionKey.length !== 32) {
    throw new WebhookError("CONFIGURATION_INVALID");
  }

  const parts = input.encryptedSecret.split(".");
  const [version, encodedIv, encodedTag, encodedCiphertext] = parts;

  if (
    parts.length !== 4 ||
    version !== ENCRYPTION_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new WebhookError("SECRET_UNAVAILABLE");
  }

  try {
    const iv = Buffer.from(encodedIv, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    const ciphertext = Buffer.from(encodedCiphertext, "base64url");

    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error("Invalid envelope");
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      input.encryptionKey,
      iv,
    );
    decipher.setAAD(encryptionAad(input.context));
    decipher.setAuthTag(tag);
    const secret = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    decodeSigningSecret(secret);
    return secret;
  } catch {
    throw new WebhookError("SECRET_UNAVAILABLE");
  }
}

/**
 * Webhook deliveries run from the worker's network position, so by default
 * they may not target loopback, private, link-local, CGNAT, multicast or
 * reserved addresses (including IPv4-mapped and NAT64 forms). Self-hosters
 * who deliberately post to internal services opt in with
 * PAPERBOY_WEBHOOK_ALLOW_PRIVATE_NETWORKS=true.
 */
export function webhookPrivateNetworksAllowed(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.PAPERBOY_WEBHOOK_ALLOW_PRIVATE_NETWORKS === "true";
}

function ipv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isNonPublicIpv4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Groups(address: string): number[] | null {
  let value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(":")) return null;
  const tail: number[] = [];
  const lastColon = value.lastIndexOf(":");
  const dotted = ipv4Octets(value.slice(lastColon + 1));
  if (dotted) {
    tail.push((dotted[0] << 8) | dotted[1], (dotted[2] << 8) | dotted[3]);
    const prefix = value.slice(0, lastColon + 1);
    value = prefix.endsWith("::") ? prefix : prefix.slice(0, -1);
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) =>
    part === ""
      ? []
      : part.split(":").map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - rest.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 0) return null;
  const groups = [...head, ...new Array<number>(fill).fill(0), ...rest, ...tail];
  return groups.length === 8 && groups.every((group) => Number.isInteger(group)) ? groups : null;
}

/** True for any address a tenant webhook must not reach by default. */
export function isNonPublicAddress(address: string): boolean {
  const v4 = ipv4Octets(address);
  if (v4) return isNonPublicIpv4(v4);
  const g = ipv6Groups(address);
  if (!g) return false;
  const embedded = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff];
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    // ::ffff:a.b.c.d, ::a.b.c.d, ::1 and ::
    return g[5] === 0 && g[6] === 0 && g[7] <= 1 ? true : isNonPublicIpv4(embedded);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) return isNonPublicIpv4(embedded);
  return (
    (g[0] & 0xfe00) === 0xfc00 ||
    (g[0] & 0xffc0) === 0xfe80 ||
    (g[0] & 0xff00) === 0xff00 ||
    (g[0] === 0x2001 && g[1] === 0x0db8)
  );
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    (ipv4Octets(host)?.[0] ?? -1) === 127
  );
}

export function parseWebhookUrl(
  value: unknown,
  options: { allowInsecureLoopback?: boolean; allowPrivateNetwork?: boolean } = {},
): string {
  if (typeof value !== "string") {
    throw new WebhookError("INVALID_URL");
  }

  const raw = value.trim();

  if (!raw || raw.length > WEBHOOK_URL_MAX_LENGTH) {
    throw new WebhookError("INVALID_URL");
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new WebhookError("INVALID_URL");
  }

  const hostname = url.hostname.toLowerCase();
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const insecureLoopback =
    url.protocol === "http:" &&
    loopback &&
    options.allowInsecureLoopback === true;

  if (
    (url.protocol !== "https:" && !insecureLoopback) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new WebhookError("INVALID_URL");
  }

  const allowPrivate = options.allowPrivateNetwork ?? webhookPrivateNetworksAllowed();
  const devLoopback = options.allowInsecureLoopback === true && isLoopbackHost(hostname);
  if (
    !allowPrivate &&
    !devLoopback &&
    (hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      isNonPublicAddress(hostname))
  ) {
    throw new WebhookError("INVALID_URL");
  }

  return url.toString();
}

export function parseWebhookConfigurationInput(
  value: unknown,
  options?: { allowInsecureLoopback?: boolean },
): { url: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WebhookError("INVALID_INPUT");
  }

  const input = value as Record<string, unknown>;

  if (Object.keys(input).some((key) => key !== "url")) {
    throw new WebhookError("INVALID_INPUT");
  }

  return { url: parseWebhookUrl(input.url, options) };
}

export function webhookEventBody(input: {
  createdAt: Date;
  environment: "live" | "test";
  messageId: string;
  type: MessageEventType;
}): string {
  return JSON.stringify({
    created_at: input.createdAt.toISOString(),
    data: {
      email_id: input.messageId,
      environment: input.environment,
    },
    type: `email.${input.type}`,
  });
}

export function receivedEmailWebhookBody(input: {
  createdAt: Date;
  environment: "live" | "test";
  from: string;
  messageId: string | null;
  receivedEmailId: string;
  subject: string;
  to: string[];
}): string {
  return JSON.stringify({
    created_at: input.createdAt.toISOString(),
    data: {
      email_id: input.receivedEmailId,
      environment: input.environment,
      from: webhookAddress(input.from),
      message_id: input.messageId,
      subject: input.subject,
      to: input.to.map(webhookAddress),
    },
    type: "email.received",
  });
}

export function signWebhook(input: {
  body: string;
  id: string;
  secret: string;
  timestamp: number;
}): string {
  if (!Number.isSafeInteger(input.timestamp) || input.timestamp < 0) {
    throw new WebhookError("INVALID_INPUT");
  }

  const signature = createHmac("sha256", decodeSigningSecret(input.secret))
    .update(`${input.id}.${input.timestamp}.${input.body}`, "utf8")
    .digest("base64");
  return `v1,${signature}`;
}

type WebhookHeaders = Headers | Record<string, string | undefined>;

function headerValue(headers: WebhookHeaders, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name,
  );
  return entry?.[1] ?? null;
}

export function verifyWebhookSignature(input: {
  body: string;
  headers: WebhookHeaders;
  now?: Date;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  try {
    const id = headerValue(input.headers, "webhook-id");
    const timestampText = headerValue(input.headers, "webhook-timestamp");
    const signatures = headerValue(input.headers, "webhook-signature");

    if (!id || !timestampText || !signatures || !/^\d{1,12}$/.test(timestampText)) {
      return false;
    }

    const timestamp = Number(timestampText);
    const tolerance =
      input.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);

    if (
      !Number.isSafeInteger(timestamp) ||
      !Number.isFinite(tolerance) ||
      tolerance < 0 ||
      Math.abs(nowSeconds - timestamp) > tolerance
    ) {
      return false;
    }

    const expected = Buffer.from(
      signWebhook({ body: input.body, id, secret: input.secret, timestamp }).slice(
        "v1,".length,
      ),
      "base64",
    );

    return signatures.split(/\s+/).some((candidate) => {
      const [version, encoded, extra] = candidate.split(",");

      if (version !== "v1" || !encoded || extra !== undefined) {
        return false;
      }

      const actual = Buffer.from(encoded, "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
  } catch {
    return false;
  }
}
