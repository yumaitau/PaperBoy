import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { webhookApiServices } from "@/lib/webhook-api-services";
import { handleListWebhookEventAttemptsRequest } from "@/lib/webhook-http";

type WebhookAttemptsRouteContext = {
  params: Promise<{ eventId: string; webhookId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: webhookApiServices,
};

export async function GET(
  request: Request,
  context: WebhookAttemptsRouteContext,
) {
  const { eventId, webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListWebhookEventAttemptsRequest(request, webhookId, eventId, scoped));
}
