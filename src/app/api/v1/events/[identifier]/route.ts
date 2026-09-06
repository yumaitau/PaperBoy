import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  customEventApiServices,
  handleDeleteEventRequest,
  handleGetEventRequest,
  handleUpdateEventRequest,
} from "@/lib/custom-event-http";

type EventRouteContext = {
  params: Promise<{ identifier: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: customEventApiServices,
};

export async function GET(request: Request, context: EventRouteContext) {
  const { identifier } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetEventRequest(request, decodeURIComponent(identifier), scoped));
}

export async function PATCH(request: Request, context: EventRouteContext) {
  const { identifier } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateEventRequest(request, decodeURIComponent(identifier), scoped));
}

export async function DELETE(request: Request, context: EventRouteContext) {
  const { identifier } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteEventRequest(request, decodeURIComponent(identifier), scoped));
}
