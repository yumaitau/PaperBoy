import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  automationApiServices,
  handleDuplicateAutomationRequest,
} from "@/lib/automation-http";

type AutomationRouteContext = {
  params: Promise<{ automationId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: automationApiServices,
};

export async function POST(request: Request, context: AutomationRouteContext) {
  const { automationId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDuplicateAutomationRequest(request, automationId, scoped));
}
