import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { audienceApiServices } from "@/lib/audience-api-services";
import {
  handleDeleteContactRequest,
  handleGetContactRequest,
  handleUpdateContactRequest,
} from "@/lib/audience-http";

type Context = { params: Promise<{ audienceId: string; contactId: string }> };
const dependencies = { authenticate: authenticateApiRequest, services: audienceApiServices };

export async function GET(request: Request, context: Context) {
  const { audienceId, contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetContactRequest(request, audienceId, contactId, scoped));
}

export async function PATCH(request: Request, context: Context) {
  const { audienceId, contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateContactRequest(request, audienceId, contactId, scoped));
}

export async function DELETE(request: Request, context: Context) {
  const { audienceId, contactId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteContactRequest(request, audienceId, contactId, scoped));
}
