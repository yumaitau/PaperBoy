import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { outboundProviderApiServices } from "@/lib/outbound-provider-api-services";
import { handleTestOutboundProviderRequest } from "@/lib/outbound-provider-http";

export function POST(request: Request) {
  return withApiLog(
    request,
    {
      authenticate: authenticateApiRequest,
      services: outboundProviderApiServices,
    },
    (scoped) => handleTestOutboundProviderRequest(request, scoped),
  );
}
