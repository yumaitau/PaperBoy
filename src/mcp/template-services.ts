import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { templateApiServices } from "@/lib/template-api-services";
import type { PaperBoyMcpTemplateServices } from "@/mcp/template-tools";

function servicePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const input = payload as Record<string, unknown>;

  if (!Object.hasOwn(input, "requiredVariables")) {
    return input;
  }

  const mapped: Record<string, unknown> = {
    ...input,
    required_variables: input.requiredVariables,
  };
  delete mapped.requiredVariables;
  return mapped;
}

export const paperBoyMcpTemplateServices: PaperBoyMcpTemplateServices = {
  create: (principal, payload) =>
    templateApiServices.create(principal, servicePayload(payload)),
  delete: templateApiServices.delete,
  duplicate: templateApiServices.duplicate,
  publish: templateApiServices.publish,
  get: templateApiServices.get,
  list: templateApiServices.list,
  preview: templateApiServices.preview,
  update: (principal, templateId, payload) =>
    templateApiServices.update(
      principal,
      templateId,
      servicePayload(payload),
    ),
};
