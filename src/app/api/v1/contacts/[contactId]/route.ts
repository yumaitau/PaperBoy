import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleDeleteContactRequest,
  handleGetContactRequest,
  handleUpdateContactRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type ContactRouteContext = {
  params: Promise<{ contactId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(request: Request, context: ContactRouteContext) {
  const { contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetContactRequest(request, decodeURIComponent(contactId), scoped));
}

export async function PATCH(request: Request, context: ContactRouteContext) {
  const { contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateContactRequest(request, decodeURIComponent(contactId), scoped));
}

export async function DELETE(request: Request, context: ContactRouteContext) {
  const { contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteContactRequest(request, decodeURIComponent(contactId), scoped));
}
