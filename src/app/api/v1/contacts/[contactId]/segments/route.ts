import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleListContactSegmentsRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type ContactSegmentsRouteContext = {
  params: Promise<{ contactId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(
  request: Request,
  context: ContactSegmentsRouteContext,
) {
  const { contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListContactSegmentsRequest(request, decodeURIComponent(contactId), scoped));
}
