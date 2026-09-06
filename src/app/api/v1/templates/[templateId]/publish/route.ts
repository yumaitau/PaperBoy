import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import { templateApiServices } from "@/lib/template-api-services";
import { handlePublishTemplateRequest } from "@/lib/template-http";

type TemplatePublishRouteContext = {
  params: Promise<{ templateId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: templateApiServices,
};

export async function POST(
  request: Request,
  context: TemplatePublishRouteContext,
) {
  const { templateId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handlePublishTemplateRequest(request, templateId, scoped));
}
