import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { webhookApiServices } from "@/lib/webhook-api-services";
import {
  handleConfigureWebhookRequest,
  handleCreateWebhookRequest,
  handleListWebhooksRequest,
} from "@/lib/webhook-http";

const dependencies = {
  authenticate: authenticateApiRequest,
  services: webhookApiServices,
};

export function GET(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleListWebhooksRequest(request, scoped));
}

export function POST(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleCreateWebhookRequest(request, scoped));
}

export function PUT(request: Request) {
  return withApiLog(request, dependencies, async (scoped) => handleConfigureWebhookRequest(request, scoped));
}
