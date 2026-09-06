import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { messageApiServices } from "@/lib/message-api-services";
import { handleListMessageEventsRequest } from "@/lib/message-http";

type EmailEventsRouteContext = {
  params: Promise<{ emailId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

export async function GET(request: Request, context: EmailEventsRouteContext) {
  const { emailId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListMessageEventsRequest(request, emailId, scoped));
}
