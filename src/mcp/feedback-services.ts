import { requireKeyScope } from "@/lib/authorization";
import { ingestFeedbackReport } from "@/lib/feedback";
import type { PaperBoyMcpFeedbackServices } from "@/mcp/feedback-tools";

export const paperBoyMcpFeedbackServices: PaperBoyMcpFeedbackServices = {
  ingest: (principal, raw) => {
    requireKeyScope(principal.scopes, "feedback.ingest");
    return ingestFeedbackReport({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      raw,
    });
  },
};
