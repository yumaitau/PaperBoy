import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { broadcastApiServices } from "@/lib/broadcast-api-services";
import {
  handleCreateBroadcastRequest,
  handleListBroadcastsRequest,
} from "@/lib/broadcast-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: broadcastApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListBroadcastsRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateBroadcastRequest(request, scoped));
}
