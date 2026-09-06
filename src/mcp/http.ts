import "server-only";

import {
  createMcpHandler,
  type AuthInfo,
  type McpRequestContext,
} from "@modelcontextprotocol/server";
import { isApiKeyEnvironment } from "@/lib/api-key-crypto";
import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { findOrganizationById } from "@/lib/organization-reader";
import { paperBoyMcpAudienceServices } from "@/mcp/audience-services";
import { paperBoyMcpBroadcastServices } from "@/mcp/broadcast-services";
import { paperBoyMcpDomainServices } from "@/mcp/domain-services";
import { paperBoyMcpDeliveryServices } from "@/mcp/delivery-services";
import { paperBoyMcpEmailServices } from "@/mcp/email-services";
import { paperBoyMcpFeedbackServices } from "@/mcp/feedback-services";
import { paperBoyMcpInvitationServices } from "@/mcp/invitation-services";
import { paperBoyMcpOpenTrackingServices } from "@/mcp/open-tracking-services";
import { paperBoyMcpOutboundProviderServices } from "@/mcp/outbound-provider-services";
import { paperBoyMcpRateLimitServices } from "@/mcp/rate-limit-services";
import { paperBoyMcpSuppressionServices } from "@/mcp/suppression-services";
import { paperBoyMcpApiKeyServices } from "@/mcp/api-key-services";
import { paperBoyMcpSegmentServices } from "@/mcp/segment-services";
import { paperBoyMcpEventServices } from "@/mcp/event-services";
import { paperBoyMcpAutomationServices } from "@/mcp/automation-services";
import { paperBoyMcpLogServices } from "@/mcp/log-services";
import { paperBoyMcpTemplateServices } from "@/mcp/template-services";
import { paperBoyMcpWebhookServices } from "@/mcp/webhook-services";
import { createPaperBoyMcpServer } from "@/mcp/server";

const principalKey = "paperboyPrincipal";

function principalFromRequestContext(
  context: McpRequestContext,
): ApiKeyPrincipal | null {
  const value = context.authInfo?.extra?.[principalKey];

  if (!value || typeof value !== "object") {
    return null;
  }

  const principal = value as Partial<ApiKeyPrincipal>;

  if (
    (principal.actorUserId !== null &&
      typeof principal.actorUserId !== "string") ||
    typeof principal.apiKeyId !== "string" ||
    typeof principal.orgId !== "string" ||
    !isApiKeyEnvironment(principal.environment) ||
    !(
      principal.scopes === null ||
      principal.scopes === undefined ||
      (Array.isArray(principal.scopes) &&
        principal.scopes.every((scope) => typeof scope === "string"))
    )
  ) {
    return null;
  }

  return {
    actorUserId: principal.actorUserId,
    apiKeyId: principal.apiKeyId,
    environment: principal.environment,
    orgId: principal.orgId,
    scopes: (principal.scopes ?? null) as ApiKeyPrincipal["scopes"],
  };
}

export function mcpAuthInfo(principal: ApiKeyPrincipal): AuthInfo {
  return {
    clientId: principal.apiKeyId,
    extra: { [principalKey]: principal },
    scopes: ["mcp", `organization:${principal.orgId}`],
    token: `verified:${principal.apiKeyId}`,
  };
}

export const paperBoyMcpHttpHandler = createMcpHandler(
  (context) =>
    createPaperBoyMcpServer({
      authorize: async () => principalFromRequestContext(context),
      audiences: paperBoyMcpAudienceServices,
      broadcasts: paperBoyMcpBroadcastServices,
      deliveries: paperBoyMcpDeliveryServices,
      domains: paperBoyMcpDomainServices,
      emails: paperBoyMcpEmailServices,
      feedback: paperBoyMcpFeedbackServices,
      findOrganization: findOrganizationById,
      invitations: paperBoyMcpInvitationServices,
      openTracking: paperBoyMcpOpenTrackingServices,
      outboundProviders: paperBoyMcpOutboundProviderServices,
      rateLimits: paperBoyMcpRateLimitServices,
      suppressions: paperBoyMcpSuppressionServices,
      templates: paperBoyMcpTemplateServices,
      webhooks: paperBoyMcpWebhookServices,
      apiKeys: paperBoyMcpApiKeyServices,
      segments: paperBoyMcpSegmentServices,
      events: paperBoyMcpEventServices,
      automations: paperBoyMcpAutomationServices,
      logs: paperBoyMcpLogServices,
    }),
  {
    onerror: () =>
      console.error("PaperBoy MCP encountered a protocol error."),
  },
);
