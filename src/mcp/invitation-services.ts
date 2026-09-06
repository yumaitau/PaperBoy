import { requireKeyScope } from "@/lib/authorization";
import {
  inviteAndEmailOrganizationMember,
  listOrganizationInvitationsForActor,
} from "@/lib/organization-invites";
import type { PaperBoyMcpInvitationServices } from "@/mcp/invitation-tools";

export const paperBoyMcpInvitationServices: PaperBoyMcpInvitationServices = {
  invite: (principal, input) => {
    requireKeyScope(principal.scopes, "members.invite");
    return inviteAndEmailOrganizationMember({
      actorUserId: principal.actorUserId,
      email: input.email,
      orgId: principal.orgId,
      role: input.role,
    });
  },
  list: (principal) => {
    requireKeyScope(principal.scopes, "members.read");
    return listOrganizationInvitationsForActor({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
    });
  },
};
