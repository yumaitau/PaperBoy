import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleListLogsRequest, logApiServices } from "@/lib/log-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: logApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListLogsRequest(request, scoped));
}
