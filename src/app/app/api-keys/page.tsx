import { revokeApiKeyAction } from "./actions";
import { ApiKeyForm } from "./api-key-form";
import { DeleteApiKeyForm } from "./api-key-delete-button";
import { listApiKeyAuditEvents, listApiKeys } from "@/lib/api-keys";
import type { ApiKeyAuditDetails } from "@/lib/api-key-audit-core";
import {
  formatApiKeyDisplay,
  isApiKeyEnvironment,
} from "@/lib/api-key-crypto";
import { can } from "@/lib/authorization";
import { requireOrganization } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

type ApiKeysPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

const AUDIT_ACTION_LABELS = {
  created: "Created",
  deleted: "Deleted",
  revoked: "Revoked",
  updated: "Updated",
} as const;

function auditDetailText(
  action: string,
  details: ApiKeyAuditDetails | null,
  expiresAt: Date | null,
  timezone: string,
): string {
  if (action === "created") {
    return expiresAt
      ? `Expires ${formatDateTime(expiresAt, timezone)}`
      : "No expiry";
  }

  if (action === "revoked" && details?.reason === "member_removed") {
    return "Creator left the organization";
  }

  if (action === "updated" && details?.changes) {
    const parts: string[] = [];

    if (details.changes.name) {
      parts.push(`Renamed to "${details.changes.name.to}"`);
    }

    if (details.changes.scopes) {
      parts.push("Scopes changed");
    }

    return parts.join(", ");
  }

  return "";
}

export default async function ApiKeysPage({ searchParams }: ApiKeysPageProps) {
  const [{ organization, session }, status] = await Promise.all([
    requireOrganization(),
    searchParams,
  ]);
  const canCreate = can(organization.role, "apiKeys.create");
  const canRead = can(organization.role, "apiKeys.read");
  const canRevoke = can(organization.role, "apiKeys.revoke");
  const [keys, auditEvents] = canRead
    ? await Promise.all([
        listApiKeys({
          actorUserId: session.user.id,
          orgId: organization.id,
        }),
        listApiKeyAuditEvents({
          actorUserId: session.user.id,
          orgId: organization.id,
        }),
      ])
    : [[], []];
  const now = new Date();
  const columnCount = canRevoke ? 7 : 6;

  return (
    <section className="dashboard-wide">
      <h1 className="page-title">API keys</h1>
      <p className="page-sub">
        Bearer credentials for {organization.name}.
      </p>

      {status.saved === "revoked" ? (
        <p className="form-success" role="status">
          API key revoked. Requests using it now receive 401.
        </p>
      ) : null}
      {status.error ? (
        <p className="form-error" role="alert">
          {status.error}
        </p>
      ) : null}

      {status.saved === "deleted" ? (
        <p className="form-success" role="status">
          API key permanently deleted.
        </p>
      ) : null}

      <div className="card">
        <h2>Create key</h2>
        {canCreate ? (
          <>
            <p>
              Keys belong to this PaperBoy deployment. The raw key appears once
              and is never stored by PaperBoy. Keys never expire unless you set
              an expiry.
            </p>
            <ApiKeyForm />
          </>
        ) : (
          <p>Owners and admins create API keys.</p>
        )}
      </div>

      {canRead ? (
        <div className="card">
          <h2>Keys</h2>
          <div className="table-scroll">
            <table className="table api-key-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Last used</th>
                  <th>Status</th>
                  {canRevoke ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount}>No API keys yet.</td>
                  </tr>
                ) : (
                  keys.map((key) => {
                    const environment = isApiKeyEnvironment(key.environment)
                      ? key.environment
                      : "live";
                    const isRevoked = Boolean(key.revokedAt);
                    const isExpired =
                      !isRevoked &&
                      key.expiresAt !== null &&
                      key.expiresAt.getTime() <= now.getTime();

                    return (
                      <tr key={key.id}>
                        <td>
                          {key.name}
                        </td>
                        <td>
                          <code>
                            {formatApiKeyDisplay(environment, key.keyId)}
                          </code>
                        </td>
                        <td>
                          {formatDateTime(key.createdAt, session.user.timezone)}
                        </td>
                        <td>
                          {key.expiresAt
                            ? formatDateTime(
                                key.expiresAt,
                                session.user.timezone,
                              )
                            : "Never"}
                        </td>
                        <td>
                          {key.lastUsedAt
                            ? formatDateTime(
                                key.lastUsedAt,
                                session.user.timezone,
                              )
                            : "Never"}
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              isRevoked || isExpired
                                ? "pill-muted"
                                : "pill-accent"
                            }`}
                          >
                            {isRevoked
                              ? "Revoked"
                              : isExpired
                                ? "Expired"
                                : "Active"}
                          </span>
                        </td>
                        {canRevoke ? (
                          <td>
                            {!isRevoked ? (
                              <form action={revokeApiKeyAction}>
                                <input
                                  name="apiKeyId"
                                  type="hidden"
                                  value={key.id}
                                />
                                <button className="btn btn-compact" type="submit">
                                  Revoke
                                </button>
                              </form>
                            ) : (
                              <DeleteApiKeyForm
                                apiKeyId={key.id}
                                keyName={key.name}
                              />
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>Keys</h2>
          <p>Owners and admins can view API key metadata.</p>
        </div>
      )}

      {canRead ? (
        <div className="card">
          <h2>Audit log</h2>
          <p>
            Key creation, changes, revocation and deletion for this
            organization. Events are kept after a key is deleted.
          </p>
          <div className="table-scroll">
            <table className="table api-key-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Key</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No API key activity yet.</td>
                  </tr>
                ) : (
                  auditEvents.map((event) => {
                    const environment = isApiKeyEnvironment(event.environment)
                      ? event.environment
                      : "live";
                    const actor =
                      event.actorName || event.actorEmail || "Deleted user";
                    const detail = auditDetailText(
                      event.action,
                      event.details,
                      event.expiresAt,
                      session.user.timezone,
                    );

                    return (
                      <tr key={event.id}>
                        <td>
                          {formatDateTime(event.createdAt, session.user.timezone)}
                        </td>
                        <td>
                          {AUDIT_ACTION_LABELS[
                            event.action as keyof typeof AUDIT_ACTION_LABELS
                          ] ?? event.action}
                        </td>
                        <td>
                          {event.keyName}
                          <br />
                          <code>
                            {formatApiKeyDisplay(environment, event.keyPublicId)}
                          </code>
                        </td>
                        <td>
                          {actor}
                          {event.viaApiKeyId ? (
                            <>
                              <br />
                              <span className="page-sub">via API key</span>
                            </>
                          ) : null}
                        </td>
                        <td>{detail}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
