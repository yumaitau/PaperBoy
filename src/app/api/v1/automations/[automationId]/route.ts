import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  automationApiServices,
  handleDeleteAutomationRequest,
  handleGetAutomationRequest,
  handleUpdateAutomationRequest,
} from "@/lib/automation-http";

type AutomationRouteContext = {
  params: Promise<{ automationId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: automationApiServices,
};

export async function GET(request: Request, context: AutomationRouteContext) {
  const { automationId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetAutomationRequest(request, automationId, scoped));
}

export async function PATCH(request: Request, context: AutomationRouteContext) {
  const { automationId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateAutomationRequest(request, automationId, scoped));
}

export async function DELETE(
  request: Request,
  context: AutomationRouteContext,
) {
  const { automationId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteAutomationRequest(request, automationId, scoped));
}
