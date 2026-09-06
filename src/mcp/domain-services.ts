import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import {
  DomainError,
  createDomain,
  deleteDomain,
  domainDnsRecords,
  getDomain,
  listDomains,
  verifyDomain,
} from "@/lib/domains";
import {
  finalizeDomainDkimRotation,
  rotateDomainDkim,
  setupDomainDkim,
} from "@/lib/dkim";
import type { PaperBoyMcpDomainServices } from "@/mcp/domain-tools";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new DomainError("MEMBERSHIP_REQUIRED");
  }

  requireKeyScope(principal.scopes, permission);

  return principal.actorUserId;
}

export const paperBoyMcpDomainServices: PaperBoyMcpDomainServices = {
  create: (principal, name) =>
    createDomain({
      actorUserId: actorUserId(principal, "domains.create"),
      name,
      orgId: principal.orgId,
    }),
  delete: (principal, domainId) =>
    deleteDomain({
      actorUserId: actorUserId(principal, "domains.delete"),
      domainId,
      orgId: principal.orgId,
    }),
  finalizeDkimRotation: async (principal, domainId) => {
    const access = {
      actorUserId: actorUserId(principal, "domains.manageDkim"),
      domainId,
      orgId: principal.orgId,
    };
    await finalizeDomainDkimRotation(access);
    return getDomain(access);
  },
  list: (principal) =>
    listDomains({
      actorUserId: actorUserId(principal, "domains.read"),
      orgId: principal.orgId,
    }),
  records: domainDnsRecords,
  rotateDkim: async (principal, domainId) => {
    const access = {
      actorUserId: actorUserId(principal, "domains.manageDkim"),
      domainId,
      orgId: principal.orgId,
    };
    await rotateDomainDkim(access);
    return getDomain(access);
  },
  setupDkim: async (principal, domainId) => {
    const access = {
      actorUserId: actorUserId(principal, "domains.manageDkim"),
      domainId,
      orgId: principal.orgId,
    };
    await setupDomainDkim(access);
    return getDomain(access);
  },
  verify: async (principal, domainId) => {
    const result = await verifyDomain({
      actorUserId: actorUserId(principal, "domains.verify"),
      domainId,
      orgId: principal.orgId,
    });
    return result.domain;
  },
};
