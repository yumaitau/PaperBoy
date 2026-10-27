"use server";

import { redirect } from "next/navigation";
import { isOrganizationInvitationId } from "@/lib/organization-invite-access";
import {
  acceptOrganizationInvitation,
  OrganizationError,
} from "@/lib/organizations";
import { requireSession } from "@/lib/session";

export async function acceptInvitationFromLinkAction(formData: FormData) {
  const invitationToken = String(formData.get("invitationToken"));
  if (!isOrganizationInvitationId(invitationToken)) {
    redirect("/sign-in");
  }

  const session = await requireSession();

  try {
    await acceptOrganizationInvitation({
      email: session.user.email,
      invitationToken,
      proof: "invite-link",
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof OrganizationError) {
      redirect(`/invite/${invitationToken}?error=unavailable`);
    }
    throw error;
  }

  redirect("/app/organization?saved=accepted");
}
