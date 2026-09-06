import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { messageApiServices } from "@/lib/message-api-services";
import { handleGetMessageAttachmentRequest } from "@/lib/message-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

type AttachmentRouteContext = {
  params: Promise<{ attachmentId: string; emailId: string }>;
};

export async function GET(request: Request, context: AttachmentRouteContext) {
  const { attachmentId, emailId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetMessageAttachmentRequest(request, emailId, attachmentId, scoped));
}
