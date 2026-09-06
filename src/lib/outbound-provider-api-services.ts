import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import type { OutboundProviderHttpServices } from "@/lib/outbound-provider-http";
import { testConfiguredOutboundProvider } from "@/lib/outbound-provider-runtime";
import { ingestOutboundProviderEvent } from "@/lib/outbound-provider-events";
import {
  getOutboundProviderSettings,
  OutboundProviderSettingsError,
  testOutboundProviderConnection,
  updateOutboundProviderSettings,
} from "@/lib/outbound-providers";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new OutboundProviderSettingsError("MEMBERSHIP_REQUIRED");
  }
  requireKeyScope(principal.scopes, permission);
  return principal.actorUserId;
}

export const outboundProviderApiServices: OutboundProviderHttpServices = {
  get: (principal) =>
    getOutboundProviderSettings({
      actorUserId: actorUserId(principal, "outboundProviders.read"),
      orgId: principal.orgId,
    }),
  ingest: (principal, provider, payload) => {
    requireKeyScope(principal.scopes, "feedback.ingest");
    return ingestOutboundProviderEvent({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      payload,
      provider,
    });
  },
  test: (principal, payload) =>
    testOutboundProviderConnection({
      actorUserId: actorUserId(principal, "outboundProviders.manage"),
      orgId: principal.orgId,
      payload,
      testConnection: testConfiguredOutboundProvider,
    }),
  update: (principal, payload) =>
    updateOutboundProviderSettings({
      actorUserId: actorUserId(principal, "outboundProviders.manage"),
      orgId: principal.orgId,
      payload,
    }),
};
