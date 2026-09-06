import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { outboundProviderApiServices } from "@/lib/outbound-provider-api-services";
import { handleIngestOutboundProviderEventRequest } from "@/lib/outbound-provider-event-http";

export function POST(request: Request) {
  return withApiLog(
    request,
    { authenticate: authenticateApiRequest },
    async (scoped) =>
      handleIngestOutboundProviderEventRequest(request, "aws-ses", {
        authenticate: scoped.authenticate,
        ingest: outboundProviderApiServices.ingest,
      }),
  );
}
