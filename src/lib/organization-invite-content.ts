type TaggedMessage = { tags: readonly { name: string; value: string }[] };

export function isOrganizationInviteMessage(message: TaggedMessage): boolean {
  return message.tags.some((tag) => tag.name === "organization_invite" && tag.value === "1");
}

/** Invitation credentials belong only in delivery, never in message previews. */
export function publicMessageContent(message: TaggedMessage & {
  html: string | null;
  text: string | null;
}): { html: string | null; text: string | null } {
  if (!isOrganizationInviteMessage(message)) return { html: message.html, text: message.text };
  return { html: null, text: "Invitation links are only available in the recipient's email." };
}
