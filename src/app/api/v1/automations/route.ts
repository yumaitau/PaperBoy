import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  automationApiServices,
  handleCreateAutomationRequest,
  handleListAutomationsRequest,
} from "@/lib/automation-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: automationApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListAutomationsRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateAutomationRequest(request, scoped));
}
