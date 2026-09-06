import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleListContactTopicsRequest,
  handleUpdateContactTopicsRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type ContactTopicsRouteContext = {
  params: Promise<{ contactId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(request: Request, context: ContactTopicsRouteContext) {
  const { contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListContactTopicsRequest(request, decodeURIComponent(contactId), scoped));
}

export async function PATCH(
  request: Request,
  context: ContactTopicsRouteContext,
) {
  const { contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateContactTopicsRequest(request, decodeURIComponent(contactId), scoped));
}
