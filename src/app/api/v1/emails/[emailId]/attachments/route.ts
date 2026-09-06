import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { messageApiServices } from "@/lib/message-api-services";
import { handleListMessageAttachmentsRequest } from "@/lib/message-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

type AttachmentsRouteContext = {
  params: Promise<{ emailId: string }>;
};

export async function GET(request: Request, context: AttachmentsRouteContext) {
  const { emailId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListMessageAttachmentsRequest(request, emailId, scoped));
}
