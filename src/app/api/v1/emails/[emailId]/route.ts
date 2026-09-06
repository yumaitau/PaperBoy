import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { messageApiServices } from "@/lib/message-api-services";
import {
  handleGetMessageRequest,
  handleRescheduleMessageRequest,
} from "@/lib/message-http";

type EmailRouteContext = {
  params: Promise<{ emailId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

export async function GET(request: Request, context: EmailRouteContext) {
  const { emailId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetMessageRequest(request, emailId, scoped));
}

export async function PATCH(request: Request, context: EmailRouteContext) {
  const { emailId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleRescheduleMessageRequest(request, emailId, scoped));
}
