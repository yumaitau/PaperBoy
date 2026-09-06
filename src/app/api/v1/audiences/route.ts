import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { audienceApiServices } from "@/lib/audience-api-services";
import {
  handleCreateAudienceRequest,
  handleListAudiencesRequest,
} from "@/lib/audience-http";

const dependencies = { authenticate: authenticateApiRequest, services: audienceApiServices };

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListAudiencesRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateAudienceRequest(request, scoped));
}
