import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { webhookApiServices } from "@/lib/webhook-api-services";
import { handleReplayWebhookEventRequest } from "@/lib/webhook-http";

type WebhookReplayRouteContext = {
  params: Promise<{ eventId: string; webhookId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: webhookApiServices,
};

export async function POST(
  request: Request,
  context: WebhookReplayRouteContext,
) {
  const { eventId, webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleReplayWebhookEventRequest(request, webhookId, eventId, scoped));
}
