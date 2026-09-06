import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  automationApiServices,
  handleListAutomationRunsRequest,
} from "@/lib/automation-http";

type AutomationRunsRouteContext = {
  params: Promise<{ automationId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: automationApiServices,
};

export async function GET(
  request: Request,
  context: AutomationRunsRouteContext,
) {
  const { automationId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListAutomationRunsRequest(request, automationId, scoped));
}
