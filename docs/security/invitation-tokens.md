# Invitation token upgrade

Invitation record IDs are public metadata, not proof of inbox ownership. New invitations use an independent random token in `/invite/<token>`. The invitation row stores its SHA-256 hash; listing APIs, pending-invitation page data, and invitation-create responses expose neither the token nor its hash. Reissuing an invitation rotates the token. Acceptance binds the invitation address to the stored user account, consumes the invitation, and verifies the address only with the emailed token or an already verified session.

The private delivery outbox necessarily contains the email link. Message detail, console/MIME previews, and shared-email views redact invitation bodies for all readers. Invitation messages do not enable open or click tracking, so click events cannot expose the link. Delivery and status reporting still work. Operators with direct database or SMTP access remain trusted.

## Existing links and deployment

Migration `0040_invitation_tokens.sql` adds a nullable hash without changing existing IDs, memberships, or acceptance/revocation state. A null hash identifies a legacy invitation. Existing links continue to work for a signed-in recipient whose email is already verified; the same recipient can also accept from the organization page.

An unverified or new recipient must ask an owner/admin to resend the invitation. The legacy page explains this and provides sign-in for verified recipients. Reissuing stores a fresh hash and queues a new link. This also applies to legacy invitations still waiting in the email queue. Failed delivery can be retried by resending the invitation.

This restriction is necessary: old IDs were exposed through invitation listings and page data. Hashing those same IDs would preserve an attacker's already copied proof. We cannot distinguish a legitimately delivered old link from a copied public ID, so old IDs must no longer authorize signup or email verification. Existing memberships are not automatically revoked; operators should review any suspected prior unauthorized acceptances separately.

Apply the migration before starting the new application. Complete the web/MCP rollout before issuing invitations; older application instances still have the insecure acceptance behavior and must not remain active during the security cutover. No new secret or external service is required.
