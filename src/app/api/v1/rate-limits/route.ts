import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { rateLimitApiServices } from "@/lib/rate-limit-api-services";
import {
  handleGetRateLimitsRequest,
  handleUpdateRateLimitsRequest,
} from "@/lib/rate-limit-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: rateLimitApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleGetRateLimitsRequest(request, scoped));
}

export async function PATCH(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleUpdateRateLimitsRequest(request, scoped));
}
