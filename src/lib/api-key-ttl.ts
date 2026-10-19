// Shared by the console form (client) and its server action, so it must stay
// free of server-only imports.
export const API_KEY_TTL_OPTIONS = [
  { label: "No expiry", value: "never" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "1 year", value: "365d" },
] as const;

export type ApiKeyTtl = (typeof API_KEY_TTL_OPTIONS)[number]["value"];

const DAY_MS = 24 * 60 * 60 * 1000;

const TTL_MS: Record<Exclude<ApiKeyTtl, "never">, number> = {
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "90d": 90 * DAY_MS,
  "365d": 365 * DAY_MS,
};

export function isApiKeyTtl(value: unknown): value is ApiKeyTtl {
  return API_KEY_TTL_OPTIONS.some((option) => option.value === value);
}

export function apiKeyExpiryForTtl(ttl: ApiKeyTtl, now: Date): Date | null {
  if (ttl === "never") {
    return null;
  }

  return new Date(now.getTime() + TTL_MS[ttl]);
}
