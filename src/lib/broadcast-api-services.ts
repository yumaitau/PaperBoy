import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import { BroadcastError } from "@/lib/broadcast-core";
import type { BroadcastHttpServices } from "@/lib/broadcast-http";
import {
  cancelBroadcast,
  createBroadcast,
  deleteBroadcast,
  getBroadcast,
  listBroadcastClickedLinks,
  listBroadcastRecipients,
  listBroadcasts,
  pauseBroadcast,
  resumeBroadcast,
  sendBroadcast,
  updateScheduledBroadcast,
} from "@/lib/broadcasts";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new BroadcastError("MEMBERSHIP_REQUIRED");
  }

  requireKeyScope(principal.scopes, permission);

  return principal.actorUserId;
}

function context(principal: ApiKeyPrincipal, broadcastId: string) {
  return {
    actorUserId: actorUserId(principal, "broadcasts.read"),
    broadcastId,
    orgId: principal.orgId,
  };
}

function controlContext(principal: ApiKeyPrincipal, broadcastId: string) {
  return {
    actorUserId: actorUserId(principal, "broadcasts.control"),
    broadcastId,
    orgId: principal.orgId,
  };
}

export const broadcastApiServices: BroadcastHttpServices = {
  cancel: (principal, broadcastId) =>
    cancelBroadcast(controlContext(principal, broadcastId)),
  create: (principal, payload) => {
    requireKeyScope(principal.scopes, "broadcasts.create");
    return createBroadcast({ payload, principal });
  },
  delete: (principal, broadcastId) =>
    deleteBroadcast(controlContext(principal, broadcastId)),
  get: (principal, broadcastId) =>
    getBroadcast(context(principal, broadcastId)),
  list: (principal) =>
    listBroadcasts({
      actorUserId: actorUserId(principal, "broadcasts.read"),
      orgId: principal.orgId,
    }),
  listClickedLinks: (principal, broadcastId) =>
    listBroadcastClickedLinks({
      actorUserId: actorUserId(principal, "broadcasts.read"),
      broadcastId,
      orgId: principal.orgId,
    }),
  listRecipients: (principal, broadcastId, filter) =>
    listBroadcastRecipients({
      actorUserId: actorUserId(principal, "broadcasts.read"),
      broadcastId,
      bounceType: filter.bounceType,
      email: filter.email,
      limit: filter.limit,
      orgId: principal.orgId,
      type: filter.type,
    }),
  send: (principal, broadcastId, payload) =>
    sendBroadcast({
      ...controlContext(principal, broadcastId),
      payload,
    }),
  pause: (principal, broadcastId) =>
    pauseBroadcast(controlContext(principal, broadcastId)),
  resume: (principal, broadcastId) =>
    resumeBroadcast(controlContext(principal, broadcastId)),
  update: (principal, broadcastId, payload) =>
    updateScheduledBroadcast({
      ...controlContext(principal, broadcastId),
      payload,
    }),
};
