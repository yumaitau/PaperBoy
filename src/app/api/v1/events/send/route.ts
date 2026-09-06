import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  customEventApiServices,
  handleSendEventRequest,
} from "@/lib/custom-event-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: customEventApiServices,
};

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleSendEventRequest(request, scoped));
}
