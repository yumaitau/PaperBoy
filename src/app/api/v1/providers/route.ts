import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { outboundProviderApiServices } from "@/lib/outbound-provider-api-services";
import {
  handleGetOutboundProvidersRequest,
  handleUpdateOutboundProvidersRequest,
} from "@/lib/outbound-provider-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: outboundProviderApiServices,
};

export function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleGetOutboundProvidersRequest(request, scoped));
}

export function PATCH(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleUpdateOutboundProvidersRequest(request, scoped));
}
