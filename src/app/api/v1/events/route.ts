import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  customEventApiServices,
  handleCreateEventRequest,
  handleListEventsRequest,
} from "@/lib/custom-event-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: customEventApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListEventsRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateEventRequest(request, scoped));
}
