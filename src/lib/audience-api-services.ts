import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import { AudienceError } from "@/lib/audience-core";
import type { AudienceHttpServices } from "@/lib/audience-http";
import {
  createAudience,
  createContact,
  deleteAudience,
  deleteContact,
  deleteUnsubscribedContacts,
  getAudience,
  getContact,
  importContacts,
  listAudiences,
  listContacts,
  updateAudience,
  updateContact,
} from "@/lib/audiences";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) throw new AudienceError("MEMBERSHIP_REQUIRED");
  requireKeyScope(principal.scopes, permission);
  return principal.actorUserId;
}

function base(principal: ApiKeyPrincipal, permission: OrgPermission) {
  return {
    actorUserId: actorUserId(principal, permission),
    orgId: principal.orgId,
  };
}

export const audienceApiServices = {
  createAudience: (principal, payload) => createAudience({ ...base(principal, "audiences.manage"), payload }),
  createContact: (principal, audienceId, payload) => createContact({ ...base(principal, "audiences.manage"), audienceId, payload }),
  deleteAudience: (principal, audienceId) => deleteAudience({ ...base(principal, "audiences.manage"), audienceId }),
  deleteContact: (principal, audienceId, contactId) => deleteContact({ ...base(principal, "audiences.manage"), audienceId, contactId }),
  deleteUnsubscribedContacts: (principal, audienceId) => deleteUnsubscribedContacts({ ...base(principal, "audiences.manage"), audienceId }),
  getAudience: (principal, audienceId) => getAudience({ ...base(principal, "audiences.read"), audienceId }),
  getContact: (principal, audienceId, contactId) => getContact({ ...base(principal, "audiences.read"), audienceId, contactId }),
  importContacts: (principal, audienceId, csv) => importContacts({ ...base(principal, "audiences.manage"), audienceId, csv }),
  listAudiences: (principal) => listAudiences(base(principal, "audiences.read")),
  listContacts: (principal, audienceId) => listContacts({ ...base(principal, "audiences.read"), audienceId }),
  updateAudience: (principal, audienceId, payload) => updateAudience({ ...base(principal, "audiences.manage"), audienceId, payload }),
  updateContact: (principal, audienceId, contactId, payload) => updateContact({ ...base(principal, "audiences.manage"), audienceId, contactId, payload }),
} satisfies AudienceHttpServices & {
  deleteUnsubscribedContacts: (
    principal: ApiKeyPrincipal,
    audienceId: string,
  ) => Promise<{ deleted: number }>;
};
