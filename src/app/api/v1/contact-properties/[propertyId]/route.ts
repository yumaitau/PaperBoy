import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleDeleteContactPropertyRequest,
  handleGetContactPropertyRequest,
  handleUpdateContactPropertyRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type ContactPropertyRouteContext = {
  params: Promise<{ propertyId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(
  request: Request,
  context: ContactPropertyRouteContext,
) {
  const { propertyId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetContactPropertyRequest(request, propertyId, scoped));
}

export async function PATCH(
  request: Request,
  context: ContactPropertyRouteContext,
) {
  const { propertyId } = await context.params;
  return handleUpdateContactPropertyRequest(
    request,
    propertyId,
    dependencies,
  );
}

export async function DELETE(
  request: Request,
  context: ContactPropertyRouteContext,
) {
  const { propertyId } = await context.params;
  return handleDeleteContactPropertyRequest(
    request,
    propertyId,
    dependencies,
  );
}
