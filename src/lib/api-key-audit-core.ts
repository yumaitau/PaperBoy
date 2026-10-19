export type ApiKeyAuditAction = "created" | "updated" | "revoked" | "deleted";

export type ApiKeyAuditDetails = {
  changes?: {
    name?: { from: string; to: string };
    scopes?: { from: string[] | null; to: string[] | null };
  };
  // Set when a key was revoked because its creator left the organization.
  reason?: "member_removed";
};
