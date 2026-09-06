import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleDeleteSegmentRequest,
  handleGetSegmentRequest,
  handleUpdateSegmentRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type SegmentRouteContext = {
  params: Promise<{ segmentId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(request: Request, context: SegmentRouteContext) {
  const { segmentId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetSegmentRequest(request, segmentId, scoped));
}

export async function PATCH(request: Request, context: SegmentRouteContext) {
  const { segmentId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateSegmentRequest(request, segmentId, scoped));
}

export async function DELETE(request: Request, context: SegmentRouteContext) {
  const { segmentId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteSegmentRequest(request, segmentId, scoped));
}
