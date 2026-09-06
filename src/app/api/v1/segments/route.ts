import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleCreateSegmentRequest,
  handleListSegmentsRequest,
  segmentApiServices,
} from "@/lib/segment-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListSegmentsRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateSegmentRequest(request, scoped));
}
