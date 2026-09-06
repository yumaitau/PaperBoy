import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleAddContactToSegmentRequest,
  handleRemoveContactFromSegmentRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type ContactSegmentRouteContext = {
  params: Promise<{ contactId: string; segmentId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function POST(
  request: Request,
  context: ContactSegmentRouteContext,
) {
  const { contactId, segmentId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleAddContactToSegmentRequest(request, decodeURIComponent(contactId), segmentId, scoped));
}

export async function DELETE(
  request: Request,
  context: ContactSegmentRouteContext,
) {
  const { contactId, segmentId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleRemoveContactFromSegmentRequest(request, decodeURIComponent(contactId), segmentId, scoped));
}
