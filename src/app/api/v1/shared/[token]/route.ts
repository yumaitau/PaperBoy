import { getSharedEmail } from "@/lib/message-sharing";
import { handleGetSharedEmailRequest } from "@/lib/message-http";

type SharedRouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: SharedRouteContext) {
  const { token } = await context.params;
  return handleGetSharedEmailRequest(token, (value) =>
    getSharedEmail({ token: value }),
  );
}
