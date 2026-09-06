import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { broadcastApiServices } from "@/lib/broadcast-api-services";
import { handleListBroadcastClickedLinksRequest } from "@/lib/broadcast-http";

type BroadcastRouteContext = {
  params: Promise<{ broadcastId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: broadcastApiServices,
};

export async function GET(request: Request, context: BroadcastRouteContext) {
  const { broadcastId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListBroadcastClickedLinksRequest(request, broadcastId, scoped));
}
