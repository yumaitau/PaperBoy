import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { templateApiServices } from "@/lib/template-api-services";
import {
  handleDeleteTemplateRequest,
  handleGetTemplateRequest,
  handleUpdateTemplateRequest,
} from "@/lib/template-http";

type TemplateRouteContext = {
  params: Promise<{ templateId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: templateApiServices,
};

export async function GET(request: Request, context: TemplateRouteContext) {
  const { templateId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetTemplateRequest(request, templateId, scoped));
}

export async function PATCH(request: Request, context: TemplateRouteContext) {
  const { templateId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateTemplateRequest(request, templateId, scoped));
}

export async function DELETE(request: Request, context: TemplateRouteContext) {
  const { templateId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteTemplateRequest(request, templateId, scoped));
}
