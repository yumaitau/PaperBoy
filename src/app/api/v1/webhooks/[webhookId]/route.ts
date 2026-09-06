import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { webhookApiServices } from "@/lib/webhook-api-services";
import {
  handleDeleteWebhookRequest,
  handleGetWebhookByIdRequest,
  handleUpdateWebhookRequest,
} from "@/lib/webhook-http";

type WebhookRouteContext = {
  params: Promise<{ webhookId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: webhookApiServices,
};

export async function GET(request: Request, context: WebhookRouteContext) {
  const { webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetWebhookByIdRequest(request, webhookId, scoped));
}

export async function PATCH(request: Request, context: WebhookRouteContext) {
  const { webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateWebhookRequest(request, webhookId, scoped));
}

export async function DELETE(request: Request, context: WebhookRouteContext) {
  const { webhookId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteWebhookRequest(request, webhookId, scoped));
}
