import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleListReceivedEmailAttachmentsRequest } from "@/lib/inbound-http";

type ReceivedAttachmentsRouteContext = {
  params: Promise<{ emailId: string }>;
};

export async function GET(
  request: Request,
  context: ReceivedAttachmentsRouteContext,
) {
  const { emailId } = await context.params;
  return withApiLog(request, { authenticate: authenticateApiRequest }, async (scoped) =>
    handleListReceivedEmailAttachmentsRequest(request, emailId, scoped),
  );
}
