import { authenticateApiRequest } from "@/lib/api-key-request";
import { withApiLog } from "@/lib/request-logs";
import {
  handleDeleteTopicRequest,
  handleGetTopicRequest,
  handleUpdateTopicRequest,
  segmentApiServices,
} from "@/lib/segment-http";

type TopicRouteContext = {
  params: Promise<{ topicId: string }>;
};

const dependencies = {
  authenticate: authenticateApiRequest,
  services: segmentApiServices,
};

export async function GET(request: Request, context: TopicRouteContext) {
  const { topicId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleGetTopicRequest(request, topicId, scoped));
}

export async function PATCH(request: Request, context: TopicRouteContext) {
  const { topicId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleUpdateTopicRequest(request, topicId, scoped));
}

export async function DELETE(request: Request, context: TopicRouteContext) {
  const { topicId } = await context.params;
  return withApiLog(request, dependencies, async (scoped) => handleDeleteTopicRequest(request, topicId, scoped));
}
