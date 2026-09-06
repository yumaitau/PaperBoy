import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { webhookApiServices } from "@/lib/webhook-api-services";
import { handleGetWebhookEventRequest } from "@/lib/webhook-http";

type WebhookEventRouteContext = {
  params: Promise<{ eventId: string; webhookId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: webhookApiServices,
};

export async function GET(request: Request, context: WebhookEventRouteContext) {
  const { eventId, webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetWebhookEventRequest(request, webhookId, eventId, scoped));
}
