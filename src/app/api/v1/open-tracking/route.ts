import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { openTrackingApiServices } from "@/lib/open-tracking-api-services";
import {
  handleGetOpenTrackingRequest,
  handleUpdateOpenTrackingRequest,
} from "@/lib/open-tracking-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: openTrackingApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleGetOpenTrackingRequest(request, scoped));
}

export async function PATCH(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleUpdateOpenTrackingRequest(request, scoped));
}
