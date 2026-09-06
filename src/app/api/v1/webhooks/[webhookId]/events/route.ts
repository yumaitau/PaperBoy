import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { webhookApiServices } from "@/lib/webhook-api-services";
import { handleListWebhookEventsRequest } from "@/lib/webhook-http";

type WebhookEventsRouteContext = {
  params: Promise<{ webhookId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: webhookApiServices,
};

export async function GET(
  request: Request,
  context: WebhookEventsRouteContext,
) {
  const { webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleListWebhookEventsRequest(request, webhookId, scoped));
}
