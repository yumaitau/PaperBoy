import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleSendEmailRequest } from "@/lib/email-http";
import { messageApiServices } from "@/lib/message-api-services";
import { handleListMessagesRequest } from "@/lib/message-http";
import { queueEmail } from "@/lib/messages";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListMessagesRequest(request, scoped));
}

export async function POST(request: Request) {
  return handleSendEmailRequest(request, {
    authenticate: authenticateApiRequest,
    queue: queueEmail,
  });
}
