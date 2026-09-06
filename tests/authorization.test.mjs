import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationError,
  ORG_PERMISSIONS,
  can,
  isKeyScopeGranted,
  isOrgRole,
  requireKeyScope,
  requirePermission,
} from "../src/lib/authorization.ts";

const matrix = {
  owner: new Set(ORG_PERMISSIONS),
  admin: new Set([
    "audiences.manage",
    "audiences.read",
    "apiKeys.create",
    "apiKeys.read",
    "apiKeys.revoke",
    "apiKeys.update",
    "automations.manage",
    "automations.read",
    "broadcasts.control",
    "broadcasts.create",
    "broadcasts.read",
    "contactProperties.manage",
    "contactProperties.read",
    "domains.create",
    "domains.delete",
    "domains.manageDkim",
    "domains.read",
    "domains.verify",
    "emails.metrics",
    "emails.share",
    "events.manage",
    "events.read",
    "feedback.ingest",
    "logs.read",
    "members.invite",
    "members.read",
    "messages.read",
    "messages.send",
    "openTracking.manage",
    "openTracking.read",
    "outboundProviders.manage",
    "outboundProviders.read",
    "rateLimits.manage",
    "rateLimits.read",
    "segments.manage",
    "segments.read",
    "suppressions.manage",
    "suppressions.read",
    "templates.create",
    "templates.delete",
    "templates.read",
    "templates.update",
    "topics.manage",
    "topics.read",
    "webhooks.manage",
    "webhooks.read",
  ]),
  member: new Set([
    "audiences.read",
    "automations.read",
    "broadcasts.read",
    "contactProperties.read",
    "domains.read",
    "events.read",
    "logs.read",
    "members.read",
    "messages.read",
    "openTracking.read",
    "outboundProviders.read",
    "rateLimits.read",
    "segments.read",
    "suppressions.read",
    "templates.read",
    "topics.read",
  ]),
};

for (const [role, allowed] of Object.entries(matrix)) {
  test(`${role} permission matrix`, () => {
    for (const permission of ORG_PERMISSIONS) {
      assert.equal(can(role, permission), allowed.has(permission), permission);
    }
  });
}

test("members cannot mint API keys or delete domains", () => {
  assert.equal(can("member", "apiKeys.create"), false);
  assert.equal(can("member", "domains.delete"), false);
  assert.equal(can("member", "templates.read"), true);
  assert.equal(can("member", "templates.update"), false);
  assert.equal(can("member", "broadcasts.read"), true);
  assert.equal(can("member", "messages.read"), true);
  assert.equal(can("admin", "messages.downloadMime"), false);
  assert.equal(can("member", "messages.downloadMime"), false);
  assert.equal(can("member", "messages.send"), false);
  assert.equal(can("member", "broadcasts.control"), false);
  assert.equal(can("member", "webhooks.manage"), false);
  assert.equal(can("member", "feedback.ingest"), false);
  assert.equal(can("member", "suppressions.read"), true);
  assert.equal(can("member", "suppressions.manage"), false);
  assert.equal(can("member", "audiences.read"), true);
  assert.equal(can("member", "audiences.manage"), false);
  assert.equal(can("member", "rateLimits.read"), true);
  assert.equal(can("member", "rateLimits.manage"), false);
  assert.equal(can("member", "openTracking.read"), true);
  assert.equal(can("member", "openTracking.manage"), false);
  assert.equal(can("member", "outboundProviders.read"), true);
  assert.equal(can("member", "outboundProviders.manage"), false);
  assert.equal(can("owner", "organizations.rename"), true);
  assert.equal(can("admin", "organizations.rename"), false);
  assert.equal(can("member", "organizations.rename"), false);
  assert.throws(
    () => requirePermission("member", "apiKeys.create"),
    AuthorizationError,
  );
});

test("only declared roles are accepted", () => {
  assert.equal(isOrgRole("owner"), true);
  assert.equal(isOrgRole("admin"), true);
  assert.equal(isOrgRole("member"), true);
  assert.equal(isOrgRole("super-admin"), false);
});

test("key scopes are role-capped and null means full role access", () => {
  assert.equal(isKeyScopeGranted(null, "messages.send"), true);
  assert.equal(isKeyScopeGranted(undefined, "messages.send"), true);
  assert.equal(
    isKeyScopeGranted(["messages.send"], "messages.send"),
    true,
  );
  assert.equal(isKeyScopeGranted([], "messages.send"), false);
  assert.equal(
    isKeyScopeGranted(["templates.read"], "templates.update"),
    false,
  );

  requireKeyScope(null, "messages.send");
  requireKeyScope(["messages.send"], "messages.send");
  assert.throws(
    () => requireKeyScope([], "messages.send"),
    AuthorizationError,
  );
  assert.throws(
    () => requireKeyScope(["templates.read"], "templates.update"),
    AuthorizationError,
  );
});
