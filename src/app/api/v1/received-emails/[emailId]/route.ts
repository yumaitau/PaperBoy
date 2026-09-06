import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleGetReceivedEmailRequest } from "@/lib/inbound-http";

type ReceivedEmailRouteContext = {
  params: Promise<{ emailId: string }>;
};

export async function GET(request: Request, context: ReceivedEmailRouteContext) {
  const { emailId } = await context.params;
  return withApiLog(request, { authenticate: authenticateApiRequest }, async (scoped) =>
    handleGetReceivedEmailRequest(request, emailId, scoped),
  );
}
