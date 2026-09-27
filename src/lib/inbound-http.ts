import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { isKeyScopeGranted, type OrgPermission } from "@/lib/authorization";
import { DomainError } from "@/lib/domain-core";
import {
  describeEmailFailure,
  emailJson,
} from "@/lib/email-http";
import {
  inboundEmailApiBody,
  isDiscardedInboundEmail,
  type DiscardedInboundEmail,
} from "@/lib/inbound-core";
import type {
  ReceivedEmailAttachmentRecord,
  ReceivedEmailRecord,
} from "@/lib/inbound";
import { MessageStatusError } from "@/lib/message-status-core";

export type InboundHttpDependencies = {
  authenticate: (request: Request) => Promise<ApiKeyPrincipal | null>;
  get?: (
    principal: ApiKeyPrincipal,
    receivedEmailId: string,
  ) => Promise<ReceivedEmailRecord>;
  listAttachments?: (
    principal: ApiKeyPrincipal,
    receivedEmailId: string,
  ) => Promise<ReceivedEmailAttachmentRecord[]>;
  getAttachment?: (
    principal: ApiKeyPrincipal,
    receivedEmailId: string,
    attachmentId: string,
  ) => Promise<ReceivedEmailAttachmentRecord>;
  receive?: (
    principal: ApiKeyPrincipal,
    payload: unknown,
  ) => Promise<ReceivedEmailRecord | DiscardedInboundEmail>;
};

function scopeDenied(principal: ApiKeyPrincipal, permission: OrgPermission): Response | null {
  if (isKeyScopeGranted(principal.scopes, permission)) return null;
  return emailJson(
    {
      error: {
        code: "forbidden",
        message: `This API key is not granted the ${permission} scope required for received email.`,
      },
    },
    403,
  );
}

function unauthorized(): Response {
  return emailJson(
    {
      error: {
        code: "unauthorized",
        message: "A valid PaperBoy API key is required.",
      },
    },
    401,
    { "WWW-Authenticate": 'Bearer realm="PaperBoy"' },
  );
}

function inboundFailure(error: unknown): Response {
  if (error instanceof MessageStatusError && error.code === "MESSAGE_NOT_FOUND") {
    return emailJson(
      {
        error: {
          code: "email_not_found",
          message: "No received email with that ID exists in this environment.",
        },
      },
      404,
    );
  }

  if (error instanceof DomainError) {
    const invalid = error.code === "INVALID_DOMAIN";
    return emailJson(
      {
        error: {
          code: invalid ? "invalid_to_domain" : "domain_not_verified",
          message: invalid
            ? "The inbound recipient must use a valid organization domain."
            : "Verify the inbound recipient domain before receiving with a live API key.",
        },
      },
      422,
    );
  }

  const failure = describeEmailFailure(error);
  return emailJson(failure.body, failure.status, failure.headers);
}

export async function handleReceiveInboundEmailRequest(
  request: Request,
  dependencies: InboundHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);
  if (!principal) return unauthorized();
  const denied = scopeDenied(principal, "feedback.ingest");
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return emailJson(
      {
        error: {
          code: "invalid_json",
          message: "Provide a valid JSON request body.",
        },
      },
      400,
    );
  }

  try {
    const receive =
      dependencies.receive ??
      (async (actor, body) => {
        const { receiveInboundEmail, requireInboundActor } = await import("@/lib/inbound");
        await requireInboundActor(actor, "feedback.ingest");
        return receiveInboundEmail({ payload: body, principal: actor });
      });
    const email = await receive(principal, payload);
    if (isDiscardedInboundEmail(email)) {
      return emailJson(
        {
          discarded: true,
          object: "email",
          reason: email.reason,
        },
        202,
      );
    }
    return emailJson({ id: email.id, object: "email" }, email.replayed ? 200 : 201);
  } catch (error) {
    return inboundFailure(error);
  }
}

export async function handleGetReceivedEmailRequest(
  request: Request,
  receivedEmailId: string,
  dependencies: InboundHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);
  if (!principal) return unauthorized();
  const denied = scopeDenied(principal, "messages.read");
  if (denied) return denied;

  try {
    const get =
      dependencies.get ??
      (async (actor, id) => {
        const { getReceivedEmail, requireInboundActor } = await import("@/lib/inbound");
        await requireInboundActor(actor, "messages.read");
        return getReceivedEmail({
          environment: actor.environment,
          orgId: actor.orgId,
          receivedEmailId: id,
        });
      });
    const email = await get(principal, receivedEmailId);
    return emailJson(inboundEmailApiBody(email), 200);
  } catch (error) {
    return inboundFailure(error);
  }
}

function serializeReceivedAttachment(
  attachment: ReceivedEmailAttachmentRecord,
  downloadUrl: string,
) {
  return {
    content_id: attachment.contentId,
    content_type: attachment.contentType,
    download_url: downloadUrl,
    filename: attachment.filename,
    id: attachment.id,
  };
}

async function receivedAttachmentUrl(
  principal: ApiKeyPrincipal,
  receivedEmailId: string,
  attachmentId: string,
  origin: string,
): Promise<string> {
  const { receivedAttachmentDownloadUrl: downloadUrl } = await import(
    "@/lib/message-sharing"
  );
  return (
    await downloadUrl({
      attachmentId,
      baseUrl: origin,
      environment: principal.environment,
      orgId: principal.orgId,
      receivedEmailId,
    })
  ).url;
}

export async function handleListReceivedEmailAttachmentsRequest(
  request: Request,
  receivedEmailId: string,
  dependencies: InboundHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);
  if (!principal) return unauthorized();
  const denied = scopeDenied(principal, "messages.read");
  if (denied) return denied;

  try {
    const list =
      dependencies.listAttachments ??
      (async (actor, id) => {
        const { listReceivedEmailAttachments, requireInboundActor } = await import("@/lib/inbound");
        await requireInboundActor(actor, "messages.read");
        return listReceivedEmailAttachments({
          environment: actor.environment,
          orgId: actor.orgId,
          receivedEmailId: id,
        });
      });
    const attachments = await list(principal, receivedEmailId);
    const origin = new URL(request.url).origin;
    const data = await Promise.all(
      attachments.map(async (attachment) =>
        serializeReceivedAttachment(
          attachment,
          await receivedAttachmentUrl(
            principal,
            receivedEmailId,
            attachment.id,
            origin,
          ),
        ),
      ),
    );
    return emailJson({ data, object: "list" }, 200);
  } catch (error) {
    return inboundFailure(error);
  }
}

export async function handleGetReceivedEmailAttachmentRequest(
  request: Request,
  receivedEmailId: string,
  attachmentId: string,
  dependencies: InboundHttpDependencies,
): Promise<Response> {
  const principal = await dependencies.authenticate(request);
  if (!principal) return unauthorized();
  const denied = scopeDenied(principal, "messages.read");
  if (denied) return denied;

  try {
    const get =
      dependencies.getAttachment ??
      (async (actor, id, attachment) => {
        const { getReceivedEmailAttachment, requireInboundActor } = await import("@/lib/inbound");
        await requireInboundActor(actor, "messages.read");
        return getReceivedEmailAttachment({
          attachmentId: attachment,
          environment: actor.environment,
          orgId: actor.orgId,
          receivedEmailId: id,
        });
      });
    const attachment = await get(principal, receivedEmailId, attachmentId);
    const origin = new URL(request.url).origin;
    return emailJson(
      serializeReceivedAttachment(
        attachment,
        await receivedAttachmentUrl(
          principal,
          receivedEmailId,
          attachment.id,
          origin,
        ),
      ),
      200,
    );
  } catch (error) {
    return inboundFailure(error);
  }
}
