import { notFound, redirect } from "next/navigation";
import { BroadcastPreviewWorkspace } from "@/components/broadcasts/broadcast-preview-workspace";
import { AuthorizationError, can } from "@/lib/authorization";
import { getAudience, listAudiences } from "@/lib/audiences";
import { BroadcastError } from "@/lib/broadcast-core";
import { getBroadcast } from "@/lib/broadcasts";
import { naturalLanguageScheduleInput } from "@/lib/natural-language-schedule";
import { requireOrganization } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

type BroadcastPreviewPageProps = {
  params: Promise<{ broadcastId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function BroadcastPreviewPage({
  params,
  searchParams,
}: BroadcastPreviewPageProps) {
  const [{ organization, session }, { broadcastId }, status] = await Promise.all([
    requireOrganization(),
    params,
    searchParams,
  ]);
  let broadcast: Awaited<ReturnType<typeof getBroadcast>>;
  try {
    broadcast = await getBroadcast({
      actorUserId: session.user.id,
      broadcastId,
      orgId: organization.id,
    });
  } catch (error) {
    if (error instanceof BroadcastError && error.code === "BROADCAST_NOT_FOUND") {
      notFound();
    }
    if (
      error instanceof AuthorizationError ||
      (error instanceof BroadcastError && error.code === "MEMBERSHIP_REQUIRED")
    ) {
      redirect("/app/broadcasts?error=forbidden");
    }
    throw error;
  }
  const audience = broadcast.sourceAudienceId
    ? await getAudience({
        actorUserId: session.user.id,
        audienceId: broadcast.sourceAudienceId,
        orgId: organization.id,
      }).catch(() => null)
    : null;
  const canControl = can(organization.role, "broadcasts.control");
  const canEdit = canControl && broadcast.status === "scheduled";
  const canSend = can(organization.role, "messages.send");
  const audiences = canEdit
    ? await listAudiences({
        actorUserId: session.user.id,
        orgId: organization.id,
      })
    : [];
  const eventDate = broadcast.scheduledFor ?? broadcast.createdAt;
  const scheduledLabel = `${broadcast.scheduledFor ? "on " : "since "}${formatDateTime(
    eventDate,
    session.user.timezone,
  )}`;

  return (
    <BroadcastPreviewWorkspace
      key={broadcast.id}
      audienceName={audience?.name ?? `${broadcast.progress.total} recipients`}
      audiences={audiences.map((item) => ({
        activeContactCount: item.activeContactCount,
        id: item.id,
        name: item.name,
      }))}
      broadcastId={broadcast.id}
      canCancel={canControl && ["scheduled", "running", "paused"].includes(broadcast.status)}
      canEdit={canEdit}
      canSend={canSend}
      error={status.error}
      from={broadcast.from}
      html={broadcast.templateHtml}
      name={broadcast.name}
      scheduledLabel={scheduledLabel}
      status={broadcast.status}
      subject={broadcast.templateSubject}
      success={status.success}
      scheduleInput={broadcast.scheduledFor
        ? naturalLanguageScheduleInput(
            broadcast.scheduledFor,
            session.user.timezone,
          )
        : ""}
      referenceTime={new Date().toISOString()}
      sourceAudienceId={broadcast.sourceAudienceId}
      text={broadcast.templateText ?? ""}
      timeZone={session.user.timezone}
      userEmail={session.user.email}
      userInitial={(session.user.name || session.user.email).trim().charAt(0).toUpperCase()}
    />
  );
}
