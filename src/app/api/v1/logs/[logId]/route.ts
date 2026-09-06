import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleGetLogRequest, logApiServices } from "@/lib/log-http";

type LogRouteContext = {
  params: Promise<{ logId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: logApiServices,
};

export async function GET(request: Request, context: LogRouteContext) {
  const { logId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetLogRequest(request, logId, scoped));
}
