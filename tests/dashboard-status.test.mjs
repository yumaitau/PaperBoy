import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardEmailStatus } from "../src/lib/dashboard-status.ts";

test("failed message status beats a leftover queued event", () => {
  assert.equal(
    resolveDashboardEmailStatus("failed", ["queued"]),
    "failed",
  );
});

test("delivery events still upgrade a sent message", () => {
  assert.equal(
    resolveDashboardEmailStatus("sent", ["queued", "delivered", "opened"]),
    "opened",
  );
  assert.equal(
    resolveDashboardEmailStatus("sent", ["queued", "delivered", "opened", "clicked"]),
    "clicked",
  );
  assert.equal(
    resolveDashboardEmailStatus("failed", ["queued", "opened", "clicked"]),
    "failed",
  );
  assert.equal(
    resolveDashboardEmailStatus("sent", ["queued", "clicked", "bounced"]),
    "bounced",
  );
  assert.equal(
    resolveDashboardEmailStatus("sent", ["queued", "clicked", "complained"]),
    "complained",
  );
});

test("message status is used when events are only queued", () => {
  assert.equal(resolveDashboardEmailStatus("queued", ["queued"]), "queued");
  assert.equal(resolveDashboardEmailStatus("sending", ["queued"]), "sending");
  assert.equal(resolveDashboardEmailStatus("sent", ["queued"]), "sent");
});
