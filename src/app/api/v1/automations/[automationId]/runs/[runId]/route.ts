import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  automationApiServices,
  handleGetAutomationRunRequest,
} from "@/lib/automation-http";

type AutomationRunRouteContext = {
  params: Promise<{ automationId: string; runId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: automationApiServices,
};

export async function GET(
  request: Request,
  context: AutomationRunRouteContext,
) {
  const { automationId, runId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetAutomationRunRequest(request, automationId, runId, scoped));
}
