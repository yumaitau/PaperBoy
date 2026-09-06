import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import {
  RateLimitSettingsError,
} from "@/lib/rate-limit-core";
import type { RateLimitHttpServices } from "@/lib/rate-limit-http";
import {
  getRateLimitSettings,
  updateRateLimitSettings,
} from "@/lib/rate-limits";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new RateLimitSettingsError("MEMBERSHIP_REQUIRED");
  }
  requireKeyScope(principal.scopes, permission);
  return principal.actorUserId;
}

export const rateLimitApiServices: RateLimitHttpServices = {
  get: (principal) =>
    getRateLimitSettings({
      actorUserId: actorUserId(principal, "rateLimits.read"),
      orgId: principal.orgId,
    }),
  update: (principal, payload) =>
    updateRateLimitSettings({
      actorUserId: actorUserId(principal, "rateLimits.manage"),
      orgId: principal.orgId,
      payload,
    }),
};
