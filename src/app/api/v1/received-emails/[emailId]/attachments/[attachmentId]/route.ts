import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleGetReceivedEmailAttachmentRequest } from "@/lib/inbound-http";

type ReceivedAttachmentRouteContext = {
  params: Promise<{ attachmentId: string; emailId: string }>;
};

export async function GET(
  request: Request,
  context: ReceivedAttachmentRouteContext,
) {
  const { attachmentId, emailId } = await context.params;
  return withApiLog(request, { authenticate: authenticateApiRequest }, async (scoped) => handleGetReceivedEmailAttachmentRequest(request, emailId, attachmentId, scoped));
}
