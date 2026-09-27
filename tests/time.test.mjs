import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalTimeZone,
  formatDateTime,
  timeZoneLabel,
  formatLocalDateTime,
  parseLocalDateTime,
  protocolTimestamp,
  startOfCalendarDate,
  startOfNextCalendarDate,
} from "../src/lib/time.ts";

test("IANA timezones are canonicalized and invalid input is rejected", () => {
  assert.equal(canonicalTimeZone("Australia/Sydney"), "Australia/Sydney");
  assert.equal(canonicalTimeZone("../../etc/passwd"), null);
});

test("renamed and UTC zone spellings resolve to the runtime's listed zone", () => {
  const listed = new Set(Intl.supportedValuesOf("timeZone"));
  for (const pair of [
    ["Asia/Kolkata", "Asia/Calcutta"],
    ["Asia/Kathmandu", "Asia/Katmandu"],
    ["Europe/Kyiv", "Europe/Kiev"],
    ["Asia/Ho_Chi_Minh", "Asia/Saigon"],
  ]) {
    const current = canonicalTimeZone(pair[0]);
    assert.ok(current, `${pair[0]} must resolve`);
    assert.equal(canonicalTimeZone(pair[1]), current);
    assert.ok(listed.has(current), `${current} must be a listed zone`);
  }
  assert.equal(canonicalTimeZone("Etc/UTC"), "UTC");
  assert.equal(canonicalTimeZone("GMT"), "UTC");
  assert.equal(canonicalTimeZone("US/Nowhere"), null);
  assert.equal(timeZoneLabel("Asia/Calcutta"), "Asia/Kolkata (Asia/Calcutta)");
  assert.equal(timeZoneLabel("Australia/Sydney"), "Australia/Sydney");
});

test("display uses the user timezone while protocol output stays UTC", () => {
  assert.match(
    formatDateTime("2026-01-01T00:00:00Z", "Australia/Sydney"),
    /11:00/,
  );
  assert.equal(
    protocolTimestamp("2026-01-01T11:00:00+11:00"),
    "2026-01-01T00:00:00.000Z",
  );
});

test("calendar date filters use the user's IANA timezone across DST", () => {
  assert.equal(
    startOfCalendarDate("2026-08-24", "Australia/Sydney")?.toISOString(),
    "2026-08-23T14:00:00.000Z",
  );
  assert.equal(
    startOfCalendarDate("2026-10-04", "Australia/Sydney")?.toISOString(),
    "2026-10-03T14:00:00.000Z",
  );
  assert.equal(
    startOfNextCalendarDate("2026-10-04", "Australia/Sydney")?.toISOString(),
    "2026-10-04T13:00:00.000Z",
  );
  assert.equal(startOfCalendarDate("2026-02-30", "Australia/Sydney"), null);
  assert.equal(startOfCalendarDate("2026-08-24", "Not/A_Zone"), null);
});

test("local schedule values round-trip through Australia/Sydney", () => {
  const instant = parseLocalDateTime(
    "2026-08-24T19:30",
    "Australia/Sydney",
  );

  assert.equal(instant?.toISOString(), "2026-08-24T09:30:00.000Z");
  assert.equal(
    formatLocalDateTime(instant, "Australia/Sydney"),
    "2026-08-24T19:30",
  );
});

test("local schedule values reject missing and repeated DST minutes", () => {
  assert.equal(
    parseLocalDateTime("2026-10-04T02:30", "Australia/Sydney"),
    null,
  );
  assert.equal(
    parseLocalDateTime("2026-04-05T02:30", "Australia/Sydney"),
    null,
  );
});
