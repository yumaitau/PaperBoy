import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleReceiveInboundEmailRequest } from "@/lib/inbound-http";

export async function POST(request: Request) {
  return withApiLog(
    request,
    { authenticate: authenticateApiRequest },
    (scoped) => handleReceiveInboundEmailRequest(request, scoped),
  );
}
