import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  apiKeyApiServices,
  handleCreateApiKeyRequest,
  handleListApiKeysRequest,
} from "@/lib/api-key-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: apiKeyApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListApiKeysRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateApiKeyRequest(request, scoped));
}
