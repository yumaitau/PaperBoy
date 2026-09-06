import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { broadcastApiServices } from "@/lib/broadcast-api-services";
import {
  handleDeleteBroadcastRequest,
  handleGetBroadcastRequest,
  handleUpdateBroadcastRequest,
} from "@/lib/broadcast-http";

type BroadcastRouteContext = {
  params: Promise<{ broadcastId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: broadcastApiServices,
};

export async function GET(request: Request, context: BroadcastRouteContext) {
  const { broadcastId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetBroadcastRequest(request, broadcastId, scoped));
}

export async function PATCH(request: Request, context: BroadcastRouteContext) {
  const { broadcastId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateBroadcastRequest(request, broadcastId, scoped));
}

export async function DELETE(request: Request, context: BroadcastRouteContext) {
  const { broadcastId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteBroadcastRequest(request, broadcastId, scoped));
}
