import { customEventApiServices } from "@/lib/custom-event-http";
import type { PaperBoyMcpEventServices } from "@/mcp/event-tools";

export const paperBoyMcpEventServices: PaperBoyMcpEventServices = {
  create: (principal, input) =>
    customEventApiServices.create(principal, {
      name: input["name"],
      schema: input["schema"] ?? null,
    }) as ReturnType<PaperBoyMcpEventServices["create"]>,
  delete: customEventApiServices.delete,
  get: customEventApiServices.get,
  list: customEventApiServices.list,
  send: (principal, input) =>
    customEventApiServices.send(principal, {
      ...(input["contact_id"] === undefined ? {} : { contact_id: input["contact_id"] }),
      ...(input["email"] === undefined ? {} : { email: input["email"] }),
      event: input["event"],
      ...(input["payload"] === undefined ? {} : { payload: input["payload"] }),
    }) as ReturnType<PaperBoyMcpEventServices["send"]>,
  update: (principal, identifier, input) =>
    customEventApiServices.update(principal, identifier, {
      ...(input["name"] === undefined ? {} : { name: input["name"] }),
      ...(input["schema"] === undefined ? {} : { schema: input["schema"] }),
    }) as ReturnType<PaperBoyMcpEventServices["update"]>,
};
