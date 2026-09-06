export const ORG_ROLES = ["owner", "admin", "member"] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_PERMISSIONS = [
  "apiKeys.create",
  "apiKeys.read",
  "apiKeys.revoke",
  "apiKeys.update",
  "automations.manage",
  "automations.read",
  "broadcasts.control",
  "broadcasts.create",
  "broadcasts.read",
  "audiences.manage",
  "audiences.read",
  "contactProperties.manage",
  "contactProperties.read",
  "domains.create",
  "domains.delete",
  "domains.manageDkim",
  "domains.read",
  "domains.verify",
  "emails.metrics",
  "emails.share",
  "events.manage",
  "events.read",
  "feedback.ingest",
  "logs.read",
  "members.invite",
  "members.remove",
  "members.read",
  "messages.downloadMime",
  "messages.read",
  "messages.send",
  "openTracking.manage",
  "openTracking.read",
  "organizations.rename",
  "outboundProviders.manage",
  "outboundProviders.read",
  "rateLimits.manage",
  "rateLimits.read",
  "segments.manage",
  "segments.read",
  "suppressions.manage",
  "suppressions.read",
  "templates.create",
  "templates.delete",
  "templates.read",
  "templates.update",
  "topics.manage",
  "topics.read",
  "webhooks.manage",
  "webhooks.read",
] as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

const rolePermissions: Record<OrgRole, ReadonlySet<OrgPermission>> = {
  owner: new Set(ORG_PERMISSIONS),
  admin: new Set([
    "apiKeys.create",
    "apiKeys.read",
    "apiKeys.revoke",
    "apiKeys.update",
    "automations.manage",
    "automations.read",
    "broadcasts.control",
    "broadcasts.create",
    "broadcasts.read",
    "audiences.manage",
    "audiences.read",
    "contactProperties.manage",
    "contactProperties.read",
    "domains.create",
    "domains.delete",
    "domains.manageDkim",
    "domains.read",
    "domains.verify",
    "emails.metrics",
    "emails.share",
    "events.manage",
    "events.read",
    "feedback.ingest",
    "logs.read",
    "members.invite",
    "members.read",
    "messages.read",
    "messages.send",
    "openTracking.manage",
    "openTracking.read",
    "outboundProviders.manage",
    "outboundProviders.read",
    "rateLimits.manage",
    "rateLimits.read",
    "segments.manage",
    "segments.read",
    "suppressions.manage",
    "suppressions.read",
    "templates.create",
    "templates.delete",
    "templates.read",
    "templates.update",
    "topics.manage",
    "topics.read",
    "webhooks.manage",
    "webhooks.read",
  ]),
  member: new Set([
    "audiences.read",
    "automations.read",
    "broadcasts.read",
    "contactProperties.read",
    "domains.read",
    "emails.metrics",
    "events.read",
    "logs.read",
    "members.read",
    "messages.read",
    "openTracking.read",
    "outboundProviders.read",
    "rateLimits.read",
    "segments.read",
    "suppressions.read",
    "templates.read",
    "topics.read",
  ]),
};

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";

  constructor(permission: OrgPermission) {
    super(`Role does not grant ${permission}`);
    this.name = "AuthorizationError";
  }
}

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && ORG_ROLES.includes(value as OrgRole);
}

export function can(role: OrgRole, permission: OrgPermission): boolean {
  return rolePermissions[role].has(permission);
}

export function requirePermission(
  role: OrgRole,
  permission: OrgPermission,
): void {
  if (!can(role, permission)) {
    throw new AuthorizationError(permission);
  }
}

export type KeyScopes = readonly OrgPermission[] | null | undefined;

export function isKeyScopeGranted(
  scopes: KeyScopes,
  permission: OrgPermission,
): boolean {
  if (!scopes) {
    return true;
  }

  return scopes.includes(permission);
}

export function requireKeyScope(
  scopes: KeyScopes,
  permission: OrgPermission,
): void {
  if (!isKeyScopeGranted(scopes, permission)) {
    throw new AuthorizationError(permission);
  }
}

export function requirePrincipalPermission(
  role: OrgRole,
  scopes: KeyScopes,
  permission: OrgPermission,
): void {
  requirePermission(role, permission);
  requireKeyScope(scopes, permission);
}
