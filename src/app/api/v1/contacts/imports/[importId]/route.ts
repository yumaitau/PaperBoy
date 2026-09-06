import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleGetContactImportRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type ContactImportRouteContext = {
  params: Promise<{ importId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(request: Request, context: ContactImportRouteContext) {
  const { importId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetContactImportRequest(request, importId, scoped));
}
