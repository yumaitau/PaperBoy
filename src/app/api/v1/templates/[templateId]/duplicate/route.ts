import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { templateApiServices } from "@/lib/template-api-services";
import { handleDuplicateTemplateRequest } from "@/lib/template-http";

type TemplateDuplicateRouteContext = {
  params: Promise<{ templateId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: templateApiServices,
};

export async function POST(
  request: Request,
  context: TemplateDuplicateRouteContext,
) {
  const { templateId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDuplicateTemplateRequest(request, templateId, scoped));
}
