import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { messageApiServices } from "@/lib/message-api-services";
import { handleGetEmailMetricsRequest } from "@/lib/message-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: messageApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleGetEmailMetricsRequest(request, scoped));
}
