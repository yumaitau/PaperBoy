import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { handleSendEmailBatchRequest } from "@/lib/email-batch-http";
import { queueEmailBatch } from "@/lib/messages";

export async function POST(request: Request) {
  return withApiLog(
    request,
    { authenticate: authenticateApiRequest },
    async (scoped) =>
      handleSendEmailBatchRequest(request, {
        authenticate: scoped.authenticate,
        queueBatch: queueEmailBatch,
      }),
  );
}
