import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import { OpenTrackingSettingsError } from "@/lib/open-tracking-core";
import type { OpenTrackingHttpServices } from "@/lib/open-tracking-http";
import {
  getOpenTrackingSettings,
  updateOpenTrackingSettings,
} from "@/lib/open-tracking";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new OpenTrackingSettingsError("MEMBERSHIP_REQUIRED");
  }
  requireKeyScope(principal.scopes, permission);
  return principal.actorUserId;
}

export const openTrackingApiServices: OpenTrackingHttpServices = {
  get: (principal) =>
    getOpenTrackingSettings({
      actorUserId: actorUserId(principal, "openTracking.read"),
      orgId: principal.orgId,
    }),
  update: (principal, payload) =>
    updateOpenTrackingSettings({
      actorUserId: actorUserId(principal, "openTracking.manage"),
      orgId: principal.orgId,
      payload,
    }),
};
