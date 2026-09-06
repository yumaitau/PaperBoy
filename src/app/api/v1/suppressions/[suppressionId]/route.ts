import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { suppressionApiServices } from "@/lib/suppression-api-services";
import {
  handleDeleteSuppressionRequest,
  handleGetSuppressionRequest,
  handleUpdateSuppressionRequest,
} from "@/lib/suppression-http";

type SuppressionRouteContext = {
  params: Promise<{ suppressionId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: suppressionApiServices,
};

export async function GET(request: Request, context: SuppressionRouteContext) {
  const { suppressionId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetSuppressionRequest(request, suppressionId, scoped));
}

export async function PATCH(request: Request, context: SuppressionRouteContext) {
  const { suppressionId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateSuppressionRequest(request, suppressionId, scoped));
}

export async function DELETE(request: Request, context: SuppressionRouteContext) {
  const { suppressionId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteSuppressionRequest(request, suppressionId, scoped));
}
