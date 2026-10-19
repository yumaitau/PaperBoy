import assert from "node:assert/strict";
import test from "node:test";
import {
  API_KEY_TTL_OPTIONS,
  apiKeyExpiryForTtl,
  isApiKeyTtl,
} from "../src/lib/api-key-ttl.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

test("API key TTL defaults to no expiry and maps presets to expiry times", () => {
  const now = new Date("2026-10-19T00:00:00.000Z");

  assert.equal(API_KEY_TTL_OPTIONS[0].value, "never");
  assert.equal(apiKeyExpiryForTtl("never", now), null);
  assert.equal(apiKeyExpiryForTtl("7d", now).toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(apiKeyExpiryForTtl("30d", now).getTime() - now.getTime(), 30 * DAY_MS);
  assert.equal(apiKeyExpiryForTtl("90d", now).getTime() - now.getTime(), 90 * DAY_MS);
  assert.equal(apiKeyExpiryForTtl("365d", now).getTime() - now.getTime(), 365 * DAY_MS);
});

test("API key TTL accepts only listed presets", () => {
  for (const option of API_KEY_TTL_OPTIONS) {
    assert.equal(isApiKeyTtl(option.value), true);
  }

  for (const value of [undefined, null, "", "forever", "0d", "30", 30, ["30d"]]) {
    assert.equal(isApiKeyTtl(value), false, String(value));
  }
});
