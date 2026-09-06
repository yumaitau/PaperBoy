import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "pbshare_v1";
const TOKEN_CONTEXT = "paperboy:share:v1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_SHARE_TTL_SECONDS = 48 * 60 * 60;

export class ShareConfigurationError extends Error {
  constructor() {
    super("PaperBoy share signing is unavailable.");
    this.name = "ShareConfigurationError";
  }
}

export function parseShareSigningKey(
  raw = process.env.PAPERBOY_SHARE_SIGNING_KEY,
): Buffer {
  if (!raw) throw new ShareConfigurationError();
  const key = Buffer.from(raw, "base64");
  if (
    key.length !== 32 ||
    (key.toString("base64") !== raw && key.toString("base64url") !== raw)
  ) {
    throw new ShareConfigurationError();
  }
  return key;
}

function signature(payload: string, key: Buffer): Buffer {
  return createHmac("sha256", key)
    .update(`${TOKEN_CONTEXT}.${payload}`, "utf8")
    .digest();
}

export type ShareTokenSubject =
  | { attachmentId: string; messageId: string }
  | { attachmentId: string; receivedEmailId: string }
  | { messageId: string };

export function createShareToken(input: {
  expiresInSeconds?: number;
  key?: Buffer;
  now?: Date;
  subject: ShareTokenSubject;
}): string {
  const key = input.key ?? parseShareSigningKey();
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const ttl = Math.max(
    60,
    Math.min(input.expiresInSeconds ?? MAX_SHARE_TTL_SECONDS, MAX_SHARE_TTL_SECONDS),
  );

  const subject = input.subject;

  if (
    "messageId" in subject &&
    !UUID_PATTERN.test(subject.messageId)
  ) {
    throw new TypeError("A valid message UUID is required.");
  }

  if (
    "receivedEmailId" in subject &&
    !UUID_PATTERN.test(subject.receivedEmailId)
  ) {
    throw new TypeError("A valid received email UUID is required.");
  }

  if (
    "attachmentId" in subject &&
    !UUID_PATTERN.test(subject.attachmentId)
  ) {
    throw new TypeError("A valid attachment UUID is required.");
  }

  if (!("messageId" in subject || "receivedEmailId" in subject)) {
    throw new TypeError("A valid message UUID is required.");
  }

  const payload = Buffer.from(
    JSON.stringify({ exp: now + ttl, sub: input.subject, v: 1 }),
    "utf8",
  ).toString("base64url");
  return `${TOKEN_PREFIX}.${payload}.${signature(payload, key).toString("base64url")}`;
}

export function verifyShareToken(input: {
  key?: Buffer;
  now?: Date;
  token: string;
}): (ShareTokenSubject & { expiresAt: Date }) | null {
  if (input.token.length > 1024) return null;
  const [prefix, payload, encodedSignature, extra] = input.token.split(".");
  if (prefix !== TOKEN_PREFIX || !payload || !encodedSignature || extra) {
    return null;
  }

  let actual: Buffer;
  try {
    actual = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  if (actual.toString("base64url") !== encodedSignature) return null;

  let key: Buffer;
  try {
    key = input.key ?? parseShareSigningKey();
  } catch {
    return null;
  }

  const expected = signature(payload, key);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor((input.now ?? new Date()).getTime() / 1000);

    if (
      decoded?.v !== 1 ||
      typeof decoded?.exp !== "number" ||
      decoded.exp <= now ||
      !decoded?.sub
    ) {
      return null;
    }

    const sub = decoded.sub as {
      attachmentId?: unknown;
      messageId?: unknown;
      receivedEmailId?: unknown;
    };

    if (
      sub.attachmentId !== undefined &&
      (typeof sub.attachmentId !== "string" ||
        !UUID_PATTERN.test(sub.attachmentId))
    ) {
      return null;
    }

    if (typeof sub.messageId === "string" && UUID_PATTERN.test(sub.messageId)) {
      return {
        ...(sub.attachmentId
          ? {
              attachmentId: sub.attachmentId as string,
              messageId: sub.messageId,
            }
          : { messageId: sub.messageId }),
        expiresAt: new Date(decoded.exp * 1000),
      };
    }

    if (
      typeof sub.receivedEmailId === "string" &&
      UUID_PATTERN.test(sub.receivedEmailId) &&
      typeof sub.attachmentId === "string"
    ) {
      return {
        attachmentId: sub.attachmentId,
        expiresAt: new Date(decoded.exp * 1000),
        receivedEmailId: sub.receivedEmailId,
      };
    }

    return null;
  } catch {
    return null;
  }
}

const DURATION_PATTERN =
  /^\s*(\d+)\s*(m(?:in(?:ute)?s?)?|h(?:our)?s?|d(?:ay)?s?)\s*$/i;

export function parseShareExpiry(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return MAX_SHARE_TTL_SECONDS;
  }

  if (typeof value !== "string") return null;
  const match = DURATION_PATTERN.exec(value);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase()[0];
  const seconds = amount * (unit === "m" ? 60 : unit === "h" ? 3600 : 86400);

  if (!Number.isSafeInteger(seconds) || seconds < 60) return null;
  return Math.min(seconds, MAX_SHARE_TTL_SECONDS);
}
