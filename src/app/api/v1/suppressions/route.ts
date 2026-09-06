import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { suppressionApiServices } from "@/lib/suppression-api-services";
import {
  handleCreateSuppressionRequest,
  handleListSuppressionsRequest,
} from "@/lib/suppression-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: suppressionApiServices,
};

export async function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListSuppressionsRequest(request, scoped));
}

export async function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateSuppressionRequest(request, scoped));
}
