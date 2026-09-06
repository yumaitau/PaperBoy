import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import {
  createSuppression,
  deleteSuppression,
  getSuppression,
  importSuppressions,
  listSuppressions,
  updateSuppression,
} from "@/lib/suppressions";
import { SuppressionError } from "@/lib/suppression-core";
import type { SuppressionHttpServices } from "@/lib/suppression-http";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new SuppressionError("MEMBERSHIP_REQUIRED");
  }

  requireKeyScope(principal.scopes, permission);

  return principal.actorUserId;
}

export const suppressionApiServices: SuppressionHttpServices = {
  create: (principal, payload) =>
    createSuppression({
      actorUserId: actorUserId(principal, "suppressions.manage"),
      orgId: principal.orgId,
      payload,
    }),
  delete: (principal, suppressionId) =>
    deleteSuppression({
      actorUserId: actorUserId(principal, "suppressions.manage"),
      orgId: principal.orgId,
      suppressionId,
    }),
  get: (principal, suppressionId) =>
    getSuppression({
      actorUserId: actorUserId(principal, "suppressions.read"),
      orgId: principal.orgId,
      suppressionId,
    }),
  import: (principal, csv) =>
    importSuppressions({
      actorUserId: actorUserId(principal, "suppressions.manage"),
      csv,
      orgId: principal.orgId,
    }),
  list: (principal, filter) =>
    listSuppressions({
      actorUserId: actorUserId(principal, "suppressions.read"),
      filter,
      orgId: principal.orgId,
    }),
  update: (principal, suppressionId, payload) =>
    updateSuppression({
      actorUserId: actorUserId(principal, "suppressions.manage"),
      orgId: principal.orgId,
      payload,
      suppressionId,
    }),
};
