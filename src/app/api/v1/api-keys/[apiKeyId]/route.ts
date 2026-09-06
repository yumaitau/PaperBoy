import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  apiKeyApiServices,
  handleGetApiKeyRequest,
  handleRevokeApiKeyRequest,
  handleUpdateApiKeyRequest,
} from "@/lib/api-key-http";

type ApiKeyRouteContext = {
  params: Promise<{ apiKeyId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: apiKeyApiServices,
};

export async function GET(request: Request, context: ApiKeyRouteContext) {
  const { apiKeyId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetApiKeyRequest(request, apiKeyId, scoped));
}

export async function PATCH(request: Request, context: ApiKeyRouteContext) {
  const { apiKeyId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateApiKeyRequest(request, apiKeyId, scoped));
}

export async function DELETE(request: Request, context: ApiKeyRouteContext) {
  const { apiKeyId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleRevokeApiKeyRequest(request, apiKeyId, scoped));
}
