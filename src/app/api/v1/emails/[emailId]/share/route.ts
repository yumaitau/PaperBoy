import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { messageApiServices } from "@/lib/message-api-services";
import { handleShareEmailRequest } from "@/lib/message-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

type ShareRouteContext = {
  params: Promise<{ emailId: string }>;
};

export async function POST(request: Request, context: ShareRouteContext) {
  const { emailId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleShareEmailRequest(request, emailId, scoped));
}
