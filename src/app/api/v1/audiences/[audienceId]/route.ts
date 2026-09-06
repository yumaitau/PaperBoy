import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { audienceApiServices } from "@/lib/audience-api-services";
import {
  handleDeleteAudienceRequest,
  handleGetAudienceRequest,
  handleUpdateAudienceRequest,
} from "@/lib/audience-http";

type Context = { params: Promise<{ audienceId: string }> };
const dependencies = { authenticate: authenticateApiRequest, services: audienceApiServices };

export async function GET(request: Request, context: Context) {
  return withApiLog(request, dependencies, async (scoped) => handleGetAudienceRequest(request, (await context.params).audienceId, scoped));
}

export async function PATCH(request: Request, context: Context) {
  return withApiLog(request, dependencies, async (scoped) => handleUpdateAudienceRequest(request, (await context.params).audienceId, scoped));
}

export async function DELETE(request: Request, context: Context) {
  return withApiLog(request, dependencies, async (scoped) => handleDeleteAudienceRequest(request, (await context.params).audienceId, scoped));
}
